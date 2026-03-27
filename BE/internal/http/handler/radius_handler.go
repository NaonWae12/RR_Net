package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	zslog "github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/domain/network"
	"rrnet/internal/domain/radius"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

type RadiusHandler struct {
	routerRepo     *repository.RouterRepository
	voucherService *service.VoucherService
	radiusRepo     *repository.RadiusRepository
	sharedSecret   string
	ipUpdateMutex  sync.Mutex // Serialize NAS-IP self-healing updates
}

func NewRadiusHandler(
	routerRepo *repository.RouterRepository,
	voucherService *service.VoucherService,
	radiusRepo *repository.RadiusRepository,
	sharedSecret string,
) *RadiusHandler {
	return &RadiusHandler{
		routerRepo:     routerRepo,
		voucherService: voucherService,
		radiusRepo:     radiusRepo,
		sharedSecret:   sharedSecret,
	}
}

// AuthRequest represents FreeRADIUS rlm_rest JSON body for Access-Request
type AuthRequest struct {
	UserName         string `json:"User-Name"`
	UserPassword     string `json:"User-Password"`
	NASIdentifier    string `json:"NAS-Identifier"`
	NASIPAddress     string `json:"NAS-IP-Address"`
	NASPortID        string `json:"NAS-Port-Id"`
	CallingStationID string `json:"Calling-Station-Id"`
	CalledStationID  string `json:"Called-Station-Id"`
}

// AuthResponse is returned to FreeRADIUS with reply attributes
type AuthResponse map[string]interface{}

// Note: FreeRADIUS rlm_rest expects array values for attributes
// Format: {"control": {"Auth-Type": ["Accept"]}, "reply": {"Reply-Message": ["message"]}}

// Auth handles RADIUS Access-Request (REST-only, NO PAP)
// FreeRADIUS sends User-Password as-is (backend handles all validation)
func (h *RadiusHandler) Auth(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Validate shared secret â€” hard reject on mismatch
	secret := r.Header.Get("X-RRNET-RADIUS-SECRET")
	if secret != h.sharedSecret {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Read raw body for debugging on failure
	bodyBytes, _ := io.ReadAll(r.Body)
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	// Decode into map first to handle raw attributes flexibly
	var raw map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &raw); err != nil {
		zslog.Error().Err(err).Str("body", string(bodyBytes)).Msg("[radius_auth] ERROR: JSON unmarshal failed")
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	// Helper to extract string from potential array/string
	getString := func(key string) string {
		val, ok := raw[key]
		if !ok || val == nil {
			return ""
		}
		// If it's a slice (FreeRADIUS often sends arrays), take the first element
		if slice, ok := val.([]interface{}); ok && len(slice) > 0 {
			if s, ok := slice[0].(string); ok {
				return s
			}
		}
		// If it's already a string
		if s, ok := val.(string); ok {
			return s
		}
		return fmt.Sprintf("%v", val)
	}

	req := AuthRequest{
		UserName:         getString("User-Name"),
		UserPassword:     getString("User-Password"),
		NASIdentifier:    getString("NAS-Identifier"),
		NASIPAddress:     getString("NAS-IP-Address"),
		NASPortID:        getString("NAS-Port-Id"),
		CallingStationID: getString("Calling-Station-Id"),
		CalledStationID:  getString("Called-Station-Id"),
	}

	// Detect if this is a Router VPN connection instead of a Client Voucher
	if strings.HasPrefix(req.UserName, "vpn-") {
		router, err := h.routerRepo.GetByVPNUsername(ctx, req.UserName)
		if err != nil || router == nil {
			zslog.Debug().Msgf("[radius_auth] REJECT VPN: username=%q nas_ip=%s reason=router_not_found", req.UserName, req.NASIPAddress)
			http.Error(w, `{"error":"router not found"}`, http.StatusForbidden)
			return
		}

		if strings.TrimSpace(router.VPNPassword) != strings.TrimSpace(req.UserPassword) {
			zslog.Debug().Msgf("[radius_auth] REJECT VPN: username=%q nas_ip=%s reason=password_mismatch", req.UserName, req.NASIPAddress)
			http.Error(w, `{"error":"invalid password"}`, http.StatusUnauthorized)
			return
		}

		response := map[string]interface{}{
			"Reply-Message":     "VPN Router Accepted",
			"Framed-IP-Address": router.Host, // Force Static IP expected by ERP Backend
		}
		
		zslog.Info().Msgf("[radius_auth_vpn] ACCEPT: username=%q forced_ip=%s nas_ip=%s", req.UserName, router.Host, req.NASIPAddress)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Resolve tenant/router via NAS-IP-Address for standard Hotspot Vouchers
	router, err := h.resolveRouter(ctx, req.NASIdentifier, req.NASIPAddress)
	if err != nil {
		zslog.Debug().Msgf("[radius_auth] REJECT: username=%q nas_ip=%s reason=router_not_found", req.UserName, req.NASIPAddress)
		h.logAuthAttempt(ctx, uuid.Nil, nil, req.UserName, req.NASIPAddress, radius.AuthResultError, "router not found")
		http.Error(w, `{"error":"NAS not registered"}`, http.StatusForbidden)
		return
	}
	tenantID := router.TenantID
	routerID := router.ID

	// Step 1: Validate voucher (read-only check, doesn't consume)
	v, err := h.voucherService.ValidateVoucherForAuth(ctx, tenantID, req.UserName)
	if err != nil {
		zslog.Debug().Msgf("[radius_auth] REJECT: username=%q nas_ip=%s reason=%v", req.UserName, req.NASIPAddress, err)
		h.logAuthAttempt(ctx, tenantID, &routerID, req.UserName, req.NASIPAddress, radius.AuthResultReject, err.Error())
		response := map[string]interface{}{
			"control": map[string]interface{}{
				"Auth-Type": []string{"Reject"},
			},
			"reply": map[string]interface{}{
				"Reply-Message": []string{fmt.Sprintf("Voucher invalid: %s", err.Error())},
			},
		}
		responseJSON, _ := json.MarshalIndent(response, "", "  ")
		zslog.Debug().Msgf("[radius_auth] DEBUG: Response JSON:\n%s", string(responseJSON))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Step 2: Validate password (BEFORE consuming voucher to prevent burning on wrong password)
	// User-Password is already plaintext from FreeRADIUS (no base64 decode needed)
	if v.Password != "" {
		dbPass := strings.TrimSpace(v.Password)
		reqPass := strings.TrimSpace(req.UserPassword)

		if dbPass != reqPass {
			zslog.Debug().Msgf("[radius_auth] REJECT: username=%q nas_ip=%s reason=password_mismatch", req.UserName, req.NASIPAddress)
			h.logAuthAttempt(ctx, tenantID, &routerID, req.UserName, req.NASIPAddress, radius.AuthResultReject, "password mismatch")
			response := map[string]interface{}{
				"control": map[string]interface{}{
					"Auth-Type": []string{"Reject"},
				},
				"reply": map[string]interface{}{
					"Reply-Message": []string{"Voucher accepted but password incorrect"},
				},
			}
			responseJSON, _ := json.MarshalIndent(response, "", "  ")
			zslog.Debug().Msgf("[radius_auth] DEBUG: Response JSON:\n%s", string(responseJSON))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(response)
			return
		}
	}

	// Step 3: Consume voucher atomically (COMMIT POINT - voucher is marked as used here)
	v, err = h.voucherService.ConsumeVoucherForAuth(ctx, tenantID, req.UserName)
	if err != nil {
		zslog.Debug().Msgf("[radius_auth] REJECT: username=%q nas_ip=%s reason=voucher_consume_failed err=%v", req.UserName, req.NASIPAddress, err)
		h.logAuthAttempt(ctx, tenantID, &routerID, req.UserName, req.NASIPAddress, radius.AuthResultReject, fmt.Sprintf("voucher consume failed: %s", err.Error()))
		response := map[string]interface{}{
			"control": map[string]interface{}{
				"Auth-Type": []string{"Reject"},
			},
			"reply": map[string]interface{}{
				"Reply-Message": []string{fmt.Sprintf("Voucher already used or expired: %s", err.Error())},
			},
		}
		responseJSON, _ := json.MarshalIndent(response, "", "  ")
		zslog.Debug().Msgf("[radius_auth] DEBUG: Response JSON:\n%s", string(responseJSON))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Success: log accept
	zslog.Debug().Msgf("[radius_auth] ACCEPT: username=%q nas_ip=%s", req.UserName, req.NASIPAddress)
	h.logAuthAttempt(ctx, tenantID, &routerID, req.UserName, req.NASIPAddress, radius.AuthResultAccept, "")

	// Return ACCEPT with reply attributes (FreeRADIUS rlm_rest format)
	// IMPORTANT: For ACCEPT, DO NOT send "control" with "Auth-Type" - rlm_rest will auto-accept on HTTP 200
	// Setting Auth-Type=Accept in control causes FreeRADIUS to short-circuit and may skip processing reply attributes
	// TESTING: Flat format - attributes at root level (no "reply" wrapper)
	// MikroTik expects rate-limit format: "2048k/1024k" (Kbps with 'k' suffix) - more stable via RADIUS
	response := map[string]interface{}{
		"Reply-Message": "Voucher accepted",
	}

	// Add rate limit ONLY if package mode is "full_radius"
	// For "radius_auth_only" mode, rate limit is handled via MikroTik Hotspot profiles
	if pkg, err := h.voucherService.GetPackage(ctx, v.PackageID); err == nil && pkg != nil {
		switch pkg.RateLimitMode {
		case "full_radius":
			// Use "k" format (Kbps) for better MikroTik compatibility via RADIUS
			// Format: "1024k/2048k" (Upload/Download) 
			mikrotikRateLimit := fmt.Sprintf("%dk/%dk", pkg.UploadSpeed, pkg.DownloadSpeed)
			response["Mikrotik-Rate-Limit"] = mikrotikRateLimit
			zslog.Debug().Msgf("[radius_auth] full_radius mode: Sending rate limit '%s'", mikrotikRateLimit)
		case "radius_auth_only":
			// For "radius_auth_only" mode, assign user to Hotspot profile via Class attribute
			// NOTE: Mikrotik-Group is marked as "unused" in FreeRADIUS dictionary and doesn't work
			// Class is the standard RADIUS attribute that MikroTik uses for Hotspot profile assignment
			// Profile must exist on MikroTik with matching name and rate-limit configured
			response["Class"] = pkg.Name // Package name must match MikroTik profile name
			zslog.Debug().Msgf("[radius_auth] radius_auth_only mode: Assigning user to profile '%s' via Class attribute", pkg.Name)
		}
	}

	// â³ ENFORCE TIME LIMITS (Fix "Bablas" Issue)
	// ⏳ ENFORCE DUAL TIME LIMITS (Wall-clock + Uptime limit)
	minRemainingSeconds := -1

	// Get package to check expiration mode
	pkg, _ := h.voucherService.GetPackage(ctx, v.PackageID)
	
	// 1. Wall-clock expiration (fixed end date) - Always applied if set
	if v.ExpiresAt != nil {
		remaining := time.Until(*v.ExpiresAt)
		minRemainingSeconds = int(remaining.Seconds())
	}

	// 2. Play/Pause Uptime limit (Cumulative usage) - Only if mode is uptime_limit
	if pkg != nil && pkg.ExpirationMode == "uptime_limit" && pkg.MaxUptimeSeconds != nil {
		remainingUptime := *pkg.MaxUptimeSeconds - v.TotalUptimeSeconds
		// If uptime limit is tighter than wall-clock, use it
		if minRemainingSeconds == -1 || remainingUptime < minRemainingSeconds {
			minRemainingSeconds = remainingUptime
		}
	}

	if minRemainingSeconds != -1 {
		// Safety check: if expired but somehow reached here, set 1 second to force logout shortly
		if minRemainingSeconds <= 0 {
			minRemainingSeconds = 1
		}

		// Session-Timeout: How long the user can stay online in THIS session
		response["Session-Timeout"] = minRemainingSeconds
		zslog.Debug().Msgf("[radius_auth] Combined Session-Timeout (Mode: %s): %d seconds", pkg.ExpirationMode, minRemainingSeconds)
	}

	// ðŸ“¡ LIVE MONITORING (Fix "Optimal Log" Issue)
	// Use router-specific InterimInterval if set, otherwise default to 60s
	interimInterval := 60
	if router.InterimInterval > 0 {
		interimInterval = router.InterimInterval
	}
	response["Acct-Interim-Interval"] = interimInterval
	
	// 🕰️ IDLE TIMEOUT: Convert HOURS (Router setting) to SECONDS (RADIUS expect)
	// Default to 48 hours (172800 seconds) if not set
	idleTimeout := 48 * 3600
	if router.IdleTimeout > 0 {
		idleTimeout = router.IdleTimeout * 3600
	}
	response["Idle-Timeout"] = idleTimeout

	// ðŸ”¥ NINJA ISOLATION OVERRIDE: If account is isolated, handcuff them!
	if v.Isolated {
		zslog.Debug().Msgf("[radius_auth] WARN: User '%s' is ISOLATED. Applying handcuffs (Rate=0/0, List=isolated)", req.UserName)
		response["Mikrotik-Rate-Limit"] = "1k/1k"      // Near zero speed to keep them quiet
		response["Mikrotik-Address-List"] = "isolated" // Force into firewall redirection list
		response["Reply-Message"] = "Account suspended - Contact admin"

		// Note: We leave 'Class' if it exists, so Mikrotik still sees it as a Hotspot user,
		// but Address-List 'isolated' in Firewall will override everything.
	}

	responseJSON, _ := json.MarshalIndent(response, "", "  ")
	zslog.Debug().Msgf("[radius_auth] DEBUG: Response JSON (FLAT FORMAT TEST):\n%s", string(responseJSON))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// AcctRequest represents FreeRADIUS rlm_rest JSON body for Accounting-Request
type AcctRequest struct {
	AcctStatusType     string `json:"Acct-Status-Type"`
	AcctSessionID      string `json:"Acct-Session-Id"`
	UserName           string `json:"User-Name"`
	NASIdentifier      string `json:"NAS-Identifier"`
	NASIPAddress       string `json:"NAS-IP-Address"`
	NASPortID          string `json:"NAS-Port-Id"`
	FramedIPAddress    string `json:"Framed-IP-Address"`
	CallingStationID   string `json:"Calling-Station-Id"`
	CalledStationID    string `json:"Called-Station-Id"`
	AcctSessionTime    *int   `json:"Acct-Session-Time,omitempty"`
	AcctInputOctets    *int64 `json:"Acct-Input-Octets,omitempty"`
	AcctOutputOctets   *int64 `json:"Acct-Output-Octets,omitempty"`
	AcctInputPackets   *int64 `json:"Acct-Input-Packets,omitempty"`
	AcctOutputPackets  *int64 `json:"Acct-Output-Packets,omitempty"`
	AcctTerminateCause string `json:"Acct-Terminate-Cause"`
}

// UnmarshalJSON custom unmarshaler to handle empty strings from FreeRADIUS
// FreeRADIUS sends empty strings ("") for missing integer fields, which Go's
// default JSON decoder cannot unmarshal into *int or *int64 pointers.
// This function converts empty strings to nil and parses non-empty strings to integers.
func (a *AcctRequest) UnmarshalJSON(data []byte) error {
	// First, unmarshal into a map to handle empty strings properly
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	// Set string fields directly
	if v, ok := raw["Acct-Status-Type"].(string); ok {
		a.AcctStatusType = v
	}
	if v, ok := raw["Acct-Session-Id"].(string); ok {
		a.AcctSessionID = v
	}
	if v, ok := raw["User-Name"].(string); ok {
		a.UserName = v
	}
	if v, ok := raw["NAS-Identifier"].(string); ok {
		a.NASIdentifier = v
	}
	if v, ok := raw["NAS-IP-Address"].(string); ok {
		a.NASIPAddress = v
	}
	if v, ok := raw["NAS-Port-Id"].(string); ok {
		a.NASPortID = v
	}
	if v, ok := raw["Framed-IP-Address"].(string); ok {
		a.FramedIPAddress = v
	}
	if v, ok := raw["Calling-Station-Id"].(string); ok {
		a.CallingStationID = v
	}
	if v, ok := raw["Called-Station-Id"].(string); ok {
		a.CalledStationID = v
	}
	if v, ok := raw["Acct-Terminate-Cause"].(string); ok {
		a.AcctTerminateCause = v
	}

	// Parse integer fields: empty string = nil, otherwise parse
	if v, ok := raw["Acct-Session-Time"].(string); ok && v != "" {
		val, err := strconv.Atoi(v)
		if err != nil {
			return fmt.Errorf("invalid Acct-Session-Time: %w", err)
		}
		a.AcctSessionTime = &val
	} else if v, ok := raw["Acct-Session-Time"].(float64); ok {
		// Handle numeric value (in case FreeRADIUS sends number)
		val := int(v)
		a.AcctSessionTime = &val
	}

	if v, ok := raw["Acct-Input-Octets"].(string); ok && v != "" {
		val, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return fmt.Errorf("invalid Acct-Input-Octets: %w", err)
		}
		a.AcctInputOctets = &val
	} else if v, ok := raw["Acct-Input-Octets"].(float64); ok {
		// Handle numeric value
		val := int64(v)
		a.AcctInputOctets = &val
	}

	if v, ok := raw["Acct-Output-Octets"].(string); ok && v != "" {
		val, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return fmt.Errorf("invalid Acct-Output-Octets: %w", err)
		}
		a.AcctOutputOctets = &val
	} else if v, ok := raw["Acct-Output-Octets"].(float64); ok {
		// Handle numeric value
		val := int64(v)
		a.AcctOutputOctets = &val
	}

	if v, ok := raw["Acct-Input-Packets"].(string); ok && v != "" {
		val, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return fmt.Errorf("invalid Acct-Input-Packets: %w", err)
		}
		a.AcctInputPackets = &val
	} else if v, ok := raw["Acct-Input-Packets"].(float64); ok {
		// Handle numeric value
		val := int64(v)
		a.AcctInputPackets = &val
	}

	if v, ok := raw["Acct-Output-Packets"].(string); ok && v != "" {
		val, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return fmt.Errorf("invalid Acct-Output-Packets: %w", err)
		}
		a.AcctOutputPackets = &val
	} else if v, ok := raw["Acct-Output-Packets"].(float64); ok {
		// Handle numeric value
		val := int64(v)
		a.AcctOutputPackets = &val
	}

	return nil
}

// Acct handles RADIUS Accounting-Request (Start/Interim-Update/Stop)
func (h *RadiusHandler) Acct(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Validate shared secret â€” hard reject on mismatch
	secret := r.Header.Get("X-RRNET-RADIUS-SECRET")
	if secret != h.sharedSecret {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Read body first for debugging
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		zslog.Debug().Msgf("[radius_acct] ERROR: Failed to read body: %v", err)
		http.Error(w, `{"error":"failed to read body"}`, http.StatusBadRequest)
		return
	}
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	zslog.Debug().Msgf("[radius_acct] DEBUG: Received body: %s", string(bodyBytes))

	var req AcctRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		zslog.Debug().Msgf("[radius_acct] ERROR: JSON Decode failed: %v", err)
		zslog.Debug().Msgf("[radius_acct] ERROR: Body content: %s", string(bodyBytes))
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	// Ignore accounting for VPN Routers (We only need auth for static IPs)
	if strings.HasPrefix(req.UserName, "vpn-") {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Resolve tenant/router via NAS-IP-Address for standard Hotspot Clients
	router, err := h.resolveRouter(ctx, req.NASIdentifier, req.NASIPAddress)
	if err != nil {
		zslog.Debug().Msgf("[radius_acct] ERROR: acct_status=%s acct_session_id=%s nas_ip=%s reason=router_not_found", req.AcctStatusType, req.AcctSessionID, req.NASIPAddress)
		http.Error(w, `{"error":"NAS not registered"}`, http.StatusForbidden)
		return
	}
	tenantID := router.TenantID
	routerID := router.ID

	// Find voucher by username
	var voucherID *uuid.UUID
	v, err := h.voucherService.GetVoucherByCode(ctx, tenantID, req.UserName)
	if err == nil {
		voucherID = &v.ID
	}

	// Find existing session by acct_session_id (reuse ID if exists)
	existingSession, err := h.radiusRepo.GetSessionByAcctSessionID(ctx, req.AcctSessionID)
	var sessionID uuid.UUID
	if err == nil && existingSession != nil {
		sessionID = existingSession.ID // Reuse existing ID
	} else {
		sessionID = uuid.New() // New session
	}

	// Upsert session based on Acct-Status-Type
	now := time.Now()
	session := &radius.Session{
		ID:               sessionID, // Reuse or new
		TenantID:         tenantID,
		RouterID:         &routerID,
		VoucherID:        voucherID,
		AcctSessionID:    req.AcctSessionID,
		Username:         req.UserName,
		NASIPAddress:     req.NASIPAddress,
		NASPortID:        req.NASPortID,
		FramedIPAddress:  req.FramedIPAddress,
		CallingStationID: req.CallingStationID,
		CalledStationID:  req.CalledStationID,
		SessionStatus:    radius.SessionStatusActive,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	// Handle pointer fields for octets/packets (check for nil before dereferencing)
	if req.AcctInputOctets != nil {
		session.AcctInputOctets = *req.AcctInputOctets
	}
	if req.AcctOutputOctets != nil {
		session.AcctOutputOctets = *req.AcctOutputOctets
	}
	if req.AcctInputPackets != nil {
		session.AcctInputPackets = *req.AcctInputPackets
	}
	if req.AcctOutputPackets != nil {
		session.AcctOutputPackets = *req.AcctOutputPackets
	}

	switch req.AcctStatusType {
	case "Start":
		session.AcctStartTime = &now
		session.SessionStatus = radius.SessionStatusActive
		// Note: Voucher is already consumed in Auth handler
		// Accounting only tracks session data (bandwidth, time, etc.)

	case "Interim-Update":
		if req.AcctSessionTime != nil {
			sessionTime := *req.AcctSessionTime
			session.AcctSessionTime = &sessionTime
		}

	case "Stop":
		stopTime := now
		session.AcctStopTime = &stopTime
		if req.AcctSessionTime != nil {
			sessionTime := *req.AcctSessionTime
			session.AcctSessionTime = &sessionTime
		}
		session.AcctTerminateCause = req.AcctTerminateCause
		session.SessionStatus = radius.SessionStatusStopped
	}

	if err := h.radiusRepo.UpsertSession(ctx, session); err != nil {
		zslog.Debug().Msgf("[radius_acct] ERROR: acct_status=%s acct_session_id=%s nas_ip=%s reason=upsert_failed err=%v", req.AcctStatusType, req.AcctSessionID, req.NASIPAddress, err)
		http.Error(w, `{"error":"failed to record session"}`, http.StatusInternalServerError)
		return
	}

	zslog.Debug().Msgf("[radius_acct] OK: acct_status=%s acct_session_id=%s nas_ip=%s", req.AcctStatusType, req.AcctSessionID, req.NASIPAddress)
	w.WriteHeader(http.StatusNoContent)
}

// ListAuthAttempts returns paginated auth attempts (tenant scoped)
func (h *RadiusHandler) ListAuthAttempts(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	attempts, err := h.radiusRepo.ListAuthAttempts(r.Context(), tenantID, limit, offset)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":   attempts,
		"total":  len(attempts),
		"limit":  limit,
		"offset": offset,
	})
}

// ListActiveSessions returns active RADIUS sessions (tenant scoped)
func (h *RadiusHandler) ListActiveSessions(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	sessions, err := h.radiusRepo.ListActiveSessions(r.Context(), tenantID, limit, offset)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":   sessions,
		"total":  len(sessions),
		"limit":  limit,
		"offset": offset,
	})
}

// resolveRouter looks up the router by NAS-Identifier (preferred) or NAS-IP
// It automatically updates NAS-IP in DB if it changed (Self-Healing)
// resolveRouter looks up the router by NAS-Identifier (preferred) or NAS-IP
// It automatically updates NAS-IP in DB if it changed (Self-Healing)
// StartStaleSessionCleaner runs a one-shot cleanup at startup then periodically
// (every 10 minutes) marks ghost/zombie RADIUS sessions as stopped.
// Ghost sessions are 'active' sessions that never received an Acct-Stop because
// FreeRADIUS/backend restarted mid-session and the Stop packet was lost.
// Threshold = 15 minutes = conservative enough to avoid false positives
// (default Acct-Interim-Interval = 60s, so 15 min = 15x the interval).
// Cost: a single DB UPDATE per tick, zero external connections.
func (h *RadiusHandler) StartStaleSessionCleaner(ctx context.Context) {
	const staleThreshold = 15 * time.Minute

	cleanup := func() {
		cleaned, err := h.radiusRepo.MarkStaleSessionsStopped(context.Background(), staleThreshold)
		if err != nil {
			zslog.Error().Err(err).Msg("[StaleSessionCleaner] Failed to clean stale sessions")
			return
		}
		if cleaned > 0 {
			zslog.Warn().Int64("cleaned", cleaned).Dur("threshold", staleThreshold).
				Msg("[StaleSessionCleaner] Marked stale RADIUS sessions as stopped")
		}
	}

	// One-shot at startup: immediately fix any ghost sessions from the previous run
	cleanup()

	// Periodic: every 10 minutes (same rhythm as router health-check)
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				cleanup()
			}
		}
	}()
}

func (h *RadiusHandler) resolveRouter(ctx context.Context, nasIdentifier, nasIP string) (*network.Router, error) {
	var router *network.Router
	var err error

	// 1. Try Lookup by NAS-Identifier (Persistent Identity)
	if nasIdentifier != "" {
		router, err = h.routerRepo.GetByNASIdentifier(ctx, nasIdentifier)
	}

	// 2. Fallback to NAS-IP (Legacy or first time setup)
	if router == nil {
		router, err = h.routerRepo.GetByNASIP(ctx, nasIP)
	}

	if err != nil {
		return nil, err
	}

	// 3. Strict Check: Revoked / Soft-Deleted Router
	// Revoked routers MUST NOT authenticate and MUST NOT trigger auto-healing
	if router.DeletedAt != nil || router.Status == network.RouterStatusRevoked {
		zslog.Debug().Msgf("[radius_reject_revoked_router] Rejecting revoked router: %s (ID: %s, NAS-ID: %s)", router.Name, router.ID, router.NASIdentifier)
		return nil, fmt.Errorf("router is revoked")
	}

	// 4. Self-Healing: Update IP if changed (Only for ACTIVE routers)
	// Serialized with mutex to avoid race condition on concurrent requests
	if nasIP != "" && router.NASIP != nasIP {
		h.ipUpdateMutex.Lock()
		// Re-check after lock (another goroutine might have updated)
		updatedRouter, _ := h.routerRepo.GetByNASIdentifier(ctx, router.NASIdentifier)
		if updatedRouter != nil && updatedRouter.NASIP != nasIP {
			zslog.Debug().Msgf("[radius] Auto-updating router %s (%s) IP: %s -> %s", router.Name, router.ID, router.NASIP, nasIP)
			_ = h.routerRepo.UpdateNASIP(ctx, router.ID, nasIP)
		}
		h.ipUpdateMutex.Unlock()
	}

	return router, nil
}

func (h *RadiusHandler) logAuthAttempt(ctx context.Context, tenantID uuid.UUID, routerID *uuid.UUID, username, nasIP string, result radius.AuthResult, reason string) {
	attempt := &radius.AuthAttempt{
		ID:           uuid.New(),
		TenantID:     tenantID,
		RouterID:     routerID,
		Username:     username,
		NASIPAddress: nasIP,
		AuthResult:   result,
		RejectReason: reason,
		CreatedAt:    time.Now(),
	}
	_ = h.radiusRepo.CreateAuthAttempt(ctx, attempt)
}

