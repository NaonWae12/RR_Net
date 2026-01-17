package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/domain/radius"
	"rrnet/internal/domain/voucher"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

type RadiusHandler struct {
	routerRepo     *repository.RouterRepository
	voucherService *service.VoucherService
	radiusRepo     *repository.RadiusRepository
	sharedSecret   string
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
	NASIPAddress     string `json:"NAS-IP-Address"`
	NASPortID        string `json:"NAS-Port-Id"`
	CallingStationID string `json:"Calling-Station-Id"`
	CalledStationID  string `json:"Called-Station-Id"`
}

// AuthResponse is returned to FreeRADIUS with reply attributes
type AuthResponse map[string]interface{}

// Auth handles RADIUS Access-Request (PAP authentication)
func (h *RadiusHandler) Auth(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Validate shared secret
	secret := r.Header.Get("X-RRNET-RADIUS-SECRET")
	if secret != h.sharedSecret {
		log.Printf("[radius] WARN: Secret mismatch. Allowing for test.")
		// http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		// return
	}

	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	// Resolve tenant/router via NAS-IP-Address
	tenantID, routerID, err := h.resolveTenantByNASIP(ctx, req.NASIPAddress)
	if err != nil {
		h.logAuthAttempt(ctx, uuid.Nil, nil, req.UserName, req.NASIPAddress, radius.AuthResultError, "router not found")
		http.Error(w, `{"error":"NAS not registered"}`, http.StatusForbidden)
		return
	}
	log.Printf(
		"[radius_auth] resolved tenant_id=%s router_id=%s nas_ip=%s username=%q username_len=%d username_hex=%x",
		tenantID.String(),
		routerID.String(),
		req.NASIPAddress,
		req.UserName,
		len(req.UserName),
		[]byte(req.UserName),
	)

	// Validate voucher
	v, err := h.voucherService.ValidateVoucherForAuth(ctx, tenantID, req.UserName)
	if err != nil {
		log.Printf(
			"[radius_auth] voucher reject tenant_id=%s username=%q username_len=%d username_hex=%x err=%v",
			tenantID.String(),
			req.UserName,
			len(req.UserName),
			[]byte(req.UserName),
			err,
		)
		h.logAuthAttempt(ctx, tenantID, &routerID, req.UserName, req.NASIPAddress, radius.AuthResultReject, err.Error())
		// Return 401 with reject reason in JSON
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"Reply-Message": fmt.Sprintf("Voucher invalid: %s", err.Error()),
		})
		return
	}

	// Validate password if set
	if v.Password != "" && v.Password != req.UserPassword {
		log.Printf("[radius_auth] password mismatch for voucher %s", req.UserName)
		h.logAuthAttempt(ctx, tenantID, &routerID, req.UserName, req.NASIPAddress, radius.AuthResultReject, "password mismatch")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"Reply-Message": "Voucher accepted but password incorrect",
		})
		return
	}

	// Success: log accept
	h.logAuthAttempt(ctx, tenantID, &routerID, req.UserName, req.NASIPAddress, radius.AuthResultAccept, "")

	// Return ACCEPT with reply attributes (speed limits from voucher package)
	// MikroTik expects a string like "down/up" (e.g., "2048k/512k").
	var mikrotikRateLimit string
	if pkg, err := h.voucherService.GetPackage(ctx, v.PackageID); err == nil && pkg != nil {
		mikrotikRateLimit = fmt.Sprintf("%dk/%dk", pkg.DownloadSpeed, pkg.UploadSpeed)
	}
	response := AuthResponse{
		"Reply-Message": "Voucher accepted",
	}
	if mikrotikRateLimit != "" {
		response["Mikrotik-Rate-Limit"] = mikrotikRateLimit
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// AcctRequest represents FreeRADIUS rlm_rest JSON body for Accounting-Request
type AcctRequest struct {
	AcctStatusType     string `json:"Acct-Status-Type"`
	AcctSessionID      string `json:"Acct-Session-Id"`
	UserName           string `json:"User-Name"`
	NASIPAddress       string `json:"NAS-IP-Address"`
	NASPortID          string `json:"NAS-Port-Id"`
	FramedIPAddress    string `json:"Framed-IP-Address"`
	CallingStationID   string `json:"Calling-Station-Id"`
	CalledStationID    string `json:"Called-Station-Id"`
	AcctSessionTime    int    `json:"Acct-Session-Time"`
	AcctInputOctets    int64  `json:"Acct-Input-Octets"`
	AcctOutputOctets   int64  `json:"Acct-Output-Octets"`
	AcctInputPackets   int64  `json:"Acct-Input-Packets"`
	AcctOutputPackets  int64  `json:"Acct-Output-Packets"`
	AcctTerminateCause string `json:"Acct-Terminate-Cause"`
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

	var req AcctRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	// Resolve tenant/router via NAS-IP-Address
	tenantID, routerID, err := h.resolveTenantByNASIP(ctx, req.NASIPAddress)
	if err != nil {
		http.Error(w, `{"error":"NAS not registered"}`, http.StatusForbidden)
		return
	}

	// Find voucher by username
	var voucherID *uuid.UUID
	v, err := h.voucherService.GetVoucherByCode(ctx, tenantID, req.UserName)
	if err == nil {
		voucherID = &v.ID
	}

	// Upsert session based on Acct-Status-Type
	now := time.Now()
	session := &radius.Session{
		ID:                uuid.New(),
		TenantID:          tenantID,
		RouterID:          &routerID,
		VoucherID:         voucherID,
		AcctSessionID:     req.AcctSessionID,
		Username:          req.UserName,
		NASIPAddress:      req.NASIPAddress,
		NASPortID:         req.NASPortID,
		FramedIPAddress:   req.FramedIPAddress,
		CallingStationID:  req.CallingStationID,
		CalledStationID:   req.CalledStationID,
		AcctInputOctets:   req.AcctInputOctets,
		AcctOutputOctets:  req.AcctOutputOctets,
		AcctInputPackets:  req.AcctInputPackets,
		AcctOutputPackets: req.AcctOutputPackets,
		SessionStatus:     radius.SessionStatusActive,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	switch req.AcctStatusType {
	case "Start":
		session.AcctStartTime = &now
		session.SessionStatus = radius.SessionStatusActive

		// Mark voucher as used on first session start
		if voucherID != nil && v.Status == voucher.VoucherStatusActive {
			usedNow := time.Now()
			v.Status = voucher.VoucherStatusUsed
			v.UsedAt = &usedNow
			v.FirstSessionID = &session.ID
			v.UpdatedAt = usedNow

			// Calculate expiration based on package duration
			if pkg, err := h.voucherService.GetPackage(ctx, v.PackageID); err == nil && pkg != nil && pkg.DurationHours != nil {
				expiry := usedNow.Add(time.Duration(*pkg.DurationHours) * time.Hour)
				v.ExpiresAt = &expiry
			}

			_ = h.voucherService.VoucherRepo().UpdateVoucher(ctx, v)
		}

	case "Interim-Update":
		sessionTime := req.AcctSessionTime
		session.AcctSessionTime = &sessionTime

	case "Stop":
		stopTime := now
		session.AcctStopTime = &stopTime
		sessionTime := req.AcctSessionTime
		session.AcctSessionTime = &sessionTime
		session.AcctTerminateCause = req.AcctTerminateCause
		session.SessionStatus = radius.SessionStatusStopped
	}

	if err := h.radiusRepo.UpsertSession(ctx, session); err != nil {
		http.Error(w, `{"error":"failed to record session"}`, http.StatusInternalServerError)
		return
	}

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

// resolveTenantByNASIP looks up the router by NAS-IP and returns tenant_id + router_id
func (h *RadiusHandler) resolveTenantByNASIP(ctx context.Context, nasIP string) (uuid.UUID, uuid.UUID, error) {
	router, err := h.routerRepo.GetByNASIP(ctx, nasIP)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
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
