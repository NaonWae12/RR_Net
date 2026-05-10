package handler

import (
	"encoding/json"
	"net/http"

	"rrnet/internal/auth"
	"rrnet/internal/service"

	"github.com/google/uuid"
)

// TenantHandler handles tenant HTTP endpoints
type TenantHandler struct {
	tenantService *service.TenantService
}

// NewTenantHandler creates a new tenant handler
func NewTenantHandler(tenantService *service.TenantService) *TenantHandler {
	return &TenantHandler{tenantService: tenantService}
}

// RegisterTenant handles POST /api/v1/tenants/register
func (h *TenantHandler) RegisterTenant(w http.ResponseWriter, r *http.Request) {
	var req service.RegisterTenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	response, err := h.tenantService.RegisterTenant(r.Context(), &req)
	if err != nil {
		switch err {
		case service.ErrSlugTaken:
			sendError(w, http.StatusConflict, "Slug already taken")
		case service.ErrInvalidPhoneNumber:
			sendError(w, http.StatusBadRequest, "Nomor WhatsApp tidak valid atau tidak terdaftar. Pastikan nomor dimulai dengan 62 (contoh: 628123456789)")
		case auth.ErrPasswordTooShort:
			sendError(w, http.StatusBadRequest, "Password must be at least 8 characters")
		default:
			sendError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	sendJSON(w, http.StatusCreated, response)
}

// VerifyOTP handles POST /api/v1/tenants/verify-otp
func (h *TenantHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req service.VerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.tenantService.VerifyOTP(r.Context(), &req); err != nil {
		if err == service.ErrInvalidOTP {
			sendError(w, http.StatusUnauthorized, err.Error())
			return
		}
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Email berhasil diverifikasi"})
}

// ResendOTP handles POST /api/v1/tenants/resend-otp
func (h *TenantHandler) ResendOTP(w http.ResponseWriter, r *http.Request) {
	var req service.ResendOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.tenantService.ResendOTP(r.Context(), &req); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "OTP baru telah dikirim"})
}

// ApproveTenant handles PATCH /api/v1/superadmin/tenants/:id/approve
func (h *TenantHandler) ApproveTenant(w http.ResponseWriter, r *http.Request) {
	tenantIDStr := getPathParam(r, "id")
	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	if err := h.tenantService.ApproveTenant(r.Context(), tenantID); err != nil {
		if err == service.ErrTenantNotFound {
			sendError(w, http.StatusNotFound, "Tenant not found")
			return
		}
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Tenant approved successfully"})
}

// RejectTenant handles PATCH /api/v1/superadmin/tenants/:id/reject
func (h *TenantHandler) RejectTenant(w http.ResponseWriter, r *http.Request) {
	tenantIDStr := getPathParam(r, "id")
	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Reason is optional
		req.Reason = "No reason provided"
	}

	if err := h.tenantService.RejectTenant(r.Context(), tenantID, req.Reason); err != nil {
		if err == service.ErrTenantNotFound {
			sendError(w, http.StatusNotFound, "Tenant not found")
			return
		}
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Tenant rejected successfully"})
}

// GetPendingInvoice handles GET /api/v1/tenants/pending-invoice
func (h *TenantHandler) GetPendingInvoice(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	invoice, err := h.tenantService.GetPendingRegistrationInvoice(r.Context(), tenantID)
	if err != nil {
		sendError(w, http.StatusNotFound, "Pending invoice not found")
		return
	}

	sendJSON(w, http.StatusOK, invoice)
}

// UpdateRegistrationPlan handles PATCH /api/v1/tenants/update-plan
func (h *TenantHandler) UpdateRegistrationPlan(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		PlanCode     string `json:"plan_code"`
		BillingCycle string `json:"billing_cycle"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	invoice, err := h.tenantService.UpdateRegistrationPlan(r.Context(), tenantID, req.PlanCode, req.BillingCycle)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, invoice)
}

// GetMidtransConfig handles GET /api/v1/tenant/settings/midtrans
func (h *TenantHandler) GetMidtransConfig(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	config, err := h.tenantService.GetMidtransConfig(r.Context(), tenantID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, config)
}

// UpdateMidtransConfig handles PATCH /api/v1/tenant/settings/midtrans
func (h *TenantHandler) UpdateMidtransConfig(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var config service.MidtransConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.tenantService.UpdateMidtransConfig(r.Context(), tenantID, &config); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, config)
}
