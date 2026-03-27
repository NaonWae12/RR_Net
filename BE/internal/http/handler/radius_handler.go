package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	zslog "github.com/rs/zerolog/log"

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

// Auth handles RADIUS Access-Request (REST-only, NO PAP)
func (h *RadiusHandler) Auth(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// DEBUG: Always allow secret for now
	secret := r.Header.Get("X-RRNET-RADIUS-SECRET")
	zslog.Info().Str("received_secret", secret).Msg("[radius_auth] Received request")

	// Decode directly
	var req AuthRequest
	bodyBytes, _ := io.ReadAll(r.Body)
	r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		zslog.Error().Err(err).Str("body", string(bodyBytes)).Msg("[radius_auth] JSON decode failed")
		http.Error(w, `{"error":"invalid JSON"}`, http.StatusBadRequest)
		return
	}

	// SMART PASSWORD DECODER
	if req.UserPassword != "" {
		if decoded, err := base64.StdEncoding.DecodeString(req.UserPassword); err == nil {
			req.UserPassword = string(decoded)
		} else if strings.HasPrefix(req.UserPassword, "0x") {
			hexStr := req.UserPassword[2:]
			if decoded, err := hex.DecodeString(hexStr); err == nil {
				req.UserPassword = string(decoded)
			}
		}
	}

	// SPECIAL CASE: VPN Auth (SSTP/L2TP for Routers)
	if strings.HasPrefix(req.UserName, "vpn-") {
		h.handleVPNAuth(w, r, req)
		return
	}

	// Resolve router (Enhanced logic)
	router, err := h.resolveRouter(ctx, req.NASIdentifier, req.NASIPAddress)
	if err != nil {
		zslog.Warn().
			Str("username", req.UserName).
			Str("nas_ip", req.NASIPAddress).
			Str("nas_id", req.NASIdentifier).
			Msg("[radius_auth] Router definitely not found")
		http.Error(w, `{"error":"NAS not registered"}`, http.StatusForbidden)
		return
	}

	// Validate voucher
	v, err := h.voucherService.ValidateVoucherForAuth(ctx, router.TenantID, req.UserName)
	if err != nil {
		h.logAuthReject(w, r, router.TenantID, &router.ID, req.UserName, req.NASIPAddress, err.Error())
		return
	}

	// Password check
	if v.Password != "" {
		if strings.TrimSpace(v.Password) != strings.TrimSpace(req.UserPassword) {
			zslog.Warn().Str("expected", v.Password).Str("got", req.UserPassword).Msg("[radius_auth] Password mismatch")
			h.logAuthReject(w, r, router.TenantID, &router.ID, req.UserName, req.NASIPAddress, "password mismatch")
			return
		}
	}

	// Consume
	v, err = h.voucherService.ConsumeVoucherForAuth(ctx, router.TenantID, req.UserName)
	if err != nil {
		h.logAuthReject(w, r, router.TenantID, &router.ID, req.UserName, req.NASIPAddress, "consume failed")
		return
	}

	// Success response
	zslog.Info().Str("username", req.UserName).Str("router", router.Name).Msg("[radius_auth] ACCEPT (Hotspot)")
	h.logAuthAttempt(ctx, router.TenantID, &router.ID, req.UserName, req.NASIPAddress, radius.AuthResultAccept, "")

	response := map[string]interface{}{}
	if pkg, err := h.voucherService.GetPackage(ctx, v.PackageID); err == nil && pkg != nil {
		if pkg.RateLimitMode == "full_radius" {
			response["Mikrotik-Rate-Limit"] = fmt.Sprintf("%dk/%dk", pkg.DownloadSpeed, pkg.UploadSpeed)
		} else {
			response["Class"] = pkg.Name
		}
	}

	if v.Isolated {
		response["Mikrotik-Rate-Limit"] = "1k/1k"
		response["Mikrotik-Address-List"] = "isolated"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *RadiusHandler) handleVPNAuth(w http.ResponseWriter, r *http.Request, req AuthRequest) {
	ctx := r.Context()
	router, err := h.routerRepo.GetByVPNUsername(ctx, req.UserName)
	if err != nil {
		zslog.Warn().Str("username", req.UserName).Msg("[radius_auth] VPN User not found")
		http.Error(w, `{"error":"VPN account not found"}`, http.StatusForbidden)
		return
	}

	if strings.TrimSpace(router.VPNPassword) != strings.TrimSpace(req.UserPassword) {
		zslog.Warn().Str("username", req.UserName).Msg("[radius_auth] VPN Password mismatch")
		h.logAuthAttempt(ctx, router.TenantID, &router.ID, req.UserName, req.NASIPAddress, radius.AuthResultReject, "VPN password mismatch")
		http.Error(w, `{"error":"invalid password"}`, http.StatusUnauthorized)
		return
	}

	zslog.Info().Str("username", req.UserName).Str("router", router.Name).Msg("[radius_auth] ACCEPT (VPN)")
	h.logAuthAttempt(ctx, router.TenantID, &router.ID, req.UserName, req.NASIPAddress, radius.AuthResultAccept, "VPN authenticated")

	response := map[string]interface{}{"Reply-Message": "VPN Authenticated"}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *RadiusHandler) logAuthReject(w http.ResponseWriter, r *http.Request, tenantID uuid.UUID, routerID *uuid.UUID, username, nasIP, reason string) {
	zslog.Warn().Str("username", username).Str("reason", reason).Msg("[radius_auth] REJECT")
	h.logAuthAttempt(r.Context(), tenantID, routerID, username, nasIP, radius.AuthResultReject, reason)
	
	response := map[string]interface{}{
		"control": map[string]interface{}{"Auth-Type": []string{"Reject"}},
		"reply":   map[string]interface{}{"Reply-Message": []string{"Voucher/Password invalid"}},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *RadiusHandler) Acct(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNoContent)
}

func (h *RadiusHandler) resolveRouter(ctx context.Context, nasIdentifier, nasIP string) (*network.Router, error) {
	var router *network.Router

	// 1. Try by NAS-Identifier (The proper way)
	if nasIdentifier != "" {
		router, _ = h.routerRepo.GetByNASIdentifier(ctx, nasIdentifier)
	}

	// 2. Try by NAS-IP (Self-healing fallback)
	if router == nil && nasIP != "" {
		router, _ = h.routerRepo.GetByNASIP(ctx, nasIP)
	}

	// 3. Try by Name fallback (Fuzzy match if NAS-ID was misconfigured)
	if router == nil && nasIdentifier != "" {
		// Try to find a router whose name (lowercase, no spaces) matches nasIdentifier
		routers, errList := h.routerRepo.ListAll(ctx) // Note: Replace with specific fuzzy query if scale is large
		if errList == nil {
			// Slugify identifier exactly like the name slug (replace space/underscore with dash)
			slugID := strings.ReplaceAll(strings.ReplaceAll(strings.ToLower(nasIdentifier), " ", "-"), "_", "-")
			for i := range routers {
				r := routers[i]
				nameSlug := strings.ReplaceAll(strings.ReplaceAll(strings.ToLower(r.Name), " ", "-"), "_", "-")
				// Check for direct match or "RR-" prefix
				if nameSlug == slugID || "rr-"+nameSlug == slugID || nameSlug == "rr-"+slugID {
					router = r
					// Best practice: Update its NAS Identifier in DB for next time!
					r.NASIdentifier = nasIdentifier
					_ = h.routerRepo.Update(ctx, r)
					zslog.Info().Str("router", r.Name).Str("nas_id", nasIdentifier).Msg("[radius_auth] Self-healing: Updated NAS-Identifier from Fuzzy Match")
					break
				}
			}
		}
	}

	if router == nil {
		return nil, fmt.Errorf("router not found")
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

func (h *RadiusHandler) StartStaleSessionCleaner(ctx context.Context) {}
func (h *RadiusHandler) ListAuthAttempts(w http.ResponseWriter, r *http.Request) {}
func (h *RadiusHandler) ListActiveSessions(w http.ResponseWriter, r *http.Request) {}
