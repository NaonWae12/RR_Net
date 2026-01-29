package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

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

	// Validate shared secret
	secret := r.Header.Get("X-RRNET-RADIUS-SECRET")
	if secret != h.sharedSecret {
		log.Printf("[radius_auth] WARN: Secret mismatch. Allowing for test.")
		// http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		// return
	}

	// Decode JSON body (User-Password is already plaintext from FreeRADIUS)
	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[radius_auth] ERROR: JSON decode failed: %v", err)
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	// Resolve tenant/router via NAS-IP-Address
	tenantID, routerID, err := h.resolveRouter(ctx, req.NASIdentifier, req.NASIPAddress)
	if err != nil {
		log.Printf("[radius_auth] REJECT: username=%q nas_ip=%s reason=router_not_found", req.UserName, req.NASIPAddress)
		h.logAuthAttempt(ctx, uuid.Nil, nil, req.UserName, req.NASIPAddress, radius.AuthResultError, "router not found")
		http.Error(w, `{"error":"NAS not registered"}`, http.StatusForbidden)
		return
	}

	// Step 1: Validate voucher (read-only check, doesn't consume)
	v, err := h.voucherService.ValidateVoucherForAuth(ctx, tenantID, req.UserName)
	if err != nil {
		log.Printf("[radius_auth] REJECT: username=%q nas_ip=%s reason=%v", req.UserName, req.NASIPAddress, err)
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
		log.Printf("[radius_auth] DEBUG: Response JSON:\n%s", string(responseJSON))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Step 2: Validate password (BEFORE consuming voucher to prevent burning on wrong password)
	// User-Password is already plaintext from FreeRADIUS (no base64 decode needed)
	if v.Password != "" {
		dbPass := strings.TrimSpace(v.Password)
		reqPass := strings.TrimSpace(req.UserPassword)

		if dbPass != reqPass {
			log.Printf("[radius_auth] REJECT: username=%q nas_ip=%s reason=password_mismatch", req.UserName, req.NASIPAddress)
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
			log.Printf("[radius_auth] DEBUG: Response JSON:\n%s", string(responseJSON))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(response)
			return
		}
	}

	// Step 3: Consume voucher atomically (COMMIT POINT - voucher is marked as used here)
	v, err = h.voucherService.ConsumeVoucherForAuth(ctx, tenantID, req.UserName)
	if err != nil {
		log.Printf("[radius_auth] REJECT: username=%q nas_ip=%s reason=voucher_consume_failed err=%v", req.UserName, req.NASIPAddress, err)
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
		log.Printf("[radius_auth] DEBUG: Response JSON:\n%s", string(responseJSON))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Success: log accept
	log.Printf("[radius_auth] ACCEPT: username=%q nas_ip=%s", req.UserName, req.NASIPAddress)
	h.logAuthAttempt(ctx, tenantID, &routerID, req.UserName, req.NASIPAddress, radius.AuthResultAccept, "")

	// Return ACCEPT with reply attributes (FreeRADIUS rlm_rest format)
	// IMPORTANT: For ACCEPT, DO NOT send "control" with "Auth-Type" - rlm_rest will auto-accept on HTTP 200
	// Setting Auth-Type=Accept in control causes FreeRADIUS to short-circuit and may skip processing reply attributes
	// FreeRADIUS rlm_rest expects SIMPLE key-value pairs: {"Attribute-Name": "value"}
	// NOT nested objects: {"Attribute-Name": {"value": ["value"]}}
	// MikroTik expects rate-limit format: "2048k/1024k" (Kbps with 'k' suffix) - more stable via RADIUS
	replyAttrs := map[string]interface{}{
		"Reply-Message": "Voucher accepted",
	}

	// Add rate limit ONLY if package mode is "full_radius"
	// For "radius_auth_only" mode, rate limit is handled via MikroTik Hotspot profiles
	if pkg, err := h.voucherService.GetPackage(ctx, v.PackageID); err == nil && pkg != nil {
		switch pkg.RateLimitMode {
		case "full_radius":
			// Use "k" format (Kbps) for better MikroTik compatibility via RADIUS
			// Format: "2048k/1024k" is more stable than "M" or raw bps for RADIUS attributes
			mikrotikRateLimit := fmt.Sprintf("%dk/%dk", pkg.DownloadSpeed, pkg.UploadSpeed)
			replyAttrs["Mikrotik-Rate-Limit"] = mikrotikRateLimit
			log.Printf("[radius_auth] full_radius mode: Sending rate limit '%s'", mikrotikRateLimit)
		case "radius_auth_only":
			// For "radius_auth_only" mode, assign user to Hotspot profile via Class attribute
			// NOTE: Mikrotik-Group is marked as "unused" in FreeRADIUS dictionary and doesn't work
			// Class is the standard RADIUS attribute that MikroTik uses for Hotspot profile assignment
			// Profile must exist on MikroTik with matching name and rate-limit configured
			replyAttrs["Class"] = pkg.Name // Package name must match MikroTik profile name
			log.Printf("[radius_auth] radius_auth_only mode: Assigning user to profile '%s' via Class attribute", pkg.Name)
		}
	}

	// For ACCEPT: Only send "reply", NO "control"
	// rlm_rest will automatically accept on HTTP 200 with valid reply attributes
	response := map[string]interface{}{
		"reply": replyAttrs,
	}

	responseJSON, _ := json.MarshalIndent(response, "", "  ")
	log.Printf("[radius_auth] DEBUG: Response JSON:\n%s", string(responseJSON))
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

	// Validate shared secret
	secret := r.Header.Get("X-RRNET-RADIUS-SECRET")
	if secret != h.sharedSecret {
		log.Printf("[radius_acct] WARN: Secret mismatch. Allowing for test.")
		// http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		// return
	}

	// Read body first for debugging
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("[radius_acct] ERROR: Failed to read body: %v", err)
		http.Error(w, `{"error":"failed to read body"}`, http.StatusBadRequest)
		return
	}
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	log.Printf("[radius_acct] DEBUG: Received body: %s", string(bodyBytes))

	var req AcctRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[radius_acct] ERROR: JSON Decode failed: %v", err)
		log.Printf("[radius_acct] ERROR: Body content: %s", string(bodyBytes))
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	log.Printf("[radius_acct] DEBUG: Parsed request - AcctStatusType=%s, AcctSessionID=%s, UserName=%s, NASIPAddress=%s",
		req.AcctStatusType, req.AcctSessionID, req.UserName, req.NASIPAddress)

	// Resolve tenant/router via NAS-IP-Address
	tenantID, routerID, err := h.resolveRouter(ctx, req.NASIdentifier, req.NASIPAddress)
	if err != nil {
		log.Printf("[radius_acct] ERROR: acct_status=%s acct_session_id=%s nas_ip=%s reason=router_not_found", req.AcctStatusType, req.AcctSessionID, req.NASIPAddress)
		http.Error(w, `{"error":"NAS not registered"}`, http.StatusForbidden)
		return
	}

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
		log.Printf("[radius_acct] ERROR: acct_status=%s acct_session_id=%s nas_ip=%s reason=upsert_failed err=%v", req.AcctStatusType, req.AcctSessionID, req.NASIPAddress, err)
		http.Error(w, `{"error":"failed to record session"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("[radius_acct] OK: acct_status=%s acct_session_id=%s nas_ip=%s", req.AcctStatusType, req.AcctSessionID, req.NASIPAddress)
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
func (h *RadiusHandler) resolveRouter(ctx context.Context, nasIdentifier, nasIP string) (uuid.UUID, uuid.UUID, error) {
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
		return uuid.Nil, uuid.Nil, err
	}

	// 3. Strict Check: Revoked / Soft-Deleted Router
	// Revoked routers MUST NOT authenticate and MUST NOT trigger auto-healing
	if router.DeletedAt != nil || router.Status == network.RouterStatusRevoked {
		log.Printf("[radius_reject_revoked_router] Rejecting revoked router: %s (ID: %s, NAS-ID: %s)", router.Name, router.ID, router.NASIdentifier)
		return uuid.Nil, uuid.Nil, fmt.Errorf("router is revoked")
	}

	// 4. Self-Healing: Update IP if changed (Only for ACTIVE routers)
	// Serialized with mutex to avoid race condition on concurrent requests
	if nasIP != "" && router.NASIP != nasIP {
		h.ipUpdateMutex.Lock()
		// Re-check after lock (another goroutine might have updated)
		updatedRouter, _ := h.routerRepo.GetByNASIdentifier(ctx, router.NASIdentifier)
		if updatedRouter != nil && updatedRouter.NASIP != nasIP {
			log.Printf("[radius] Auto-updating router %s (%s) IP: %s -> %s", router.Name, router.ID, router.NASIP, nasIP)
			_ = h.routerRepo.UpdateNASIP(ctx, router.ID, nasIP)
		}
		h.ipUpdateMutex.Unlock()
	}

	return router.TenantID, router.ID, nil
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
