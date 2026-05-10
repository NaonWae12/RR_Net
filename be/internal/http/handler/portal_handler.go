package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/domain/billing"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

type PortalHandler struct {
	portalService *service.PortalService
}

func NewPortalHandler(portalService *service.PortalService) *PortalHandler {
	return &PortalHandler{
		portalService: portalService,
	}
}

func (h *PortalHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	data, err := h.portalService.GetDashboardData(r.Context(), tenantID, userID)
	if err != nil {
		if err == repository.ErrClientNotFound {
			sendError(w, http.StatusForbidden, "Akun Anda tidak terhubung dengan data pelanggan")
			return
		}
		log.Error().Err(err).Msg("Failed to get portal dashboard data")
		sendError(w, http.StatusInternalServerError, "Failed to get dashboard data")
		return
	}

	sendJSON(w, http.StatusOK, data)
}

func (h *PortalHandler) GetInvoices(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	invoices, err := h.portalService.GetClientInvoices(r.Context(), tenantID, userID)
	if err != nil {
		if err == repository.ErrClientNotFound {
			sendError(w, http.StatusForbidden, "Akun Anda tidak terhubung dengan data pelanggan")
			return
		}
		log.Error().Err(err).Msg("Failed to get client invoices")
		sendError(w, http.StatusInternalServerError, "Failed to get invoices")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"invoices": invoices,
	})
}

func (h *PortalHandler) GetInvoiceDetail(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get invoice ID from path parameter
	invoiceIDStr := getPathParam(r, "id")
	invoiceID, err := uuid.Parse(invoiceIDStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid invoice ID")
		return
	}

	invoice, err := h.portalService.GetInvoiceDetail(r.Context(), tenantID, userID, invoiceID)
	if err != nil {
		if err == repository.ErrClientNotFound {
			sendError(w, http.StatusForbidden, "Akun Anda tidak terhubung dengan data pelanggan")
			return
		}
		log.Error().Err(err).Msg("Failed to get invoice detail")
		sendError(w, http.StatusInternalServerError, "Failed to get invoice detail")
		return
	}

	sendJSON(w, http.StatusOK, invoice)
}

func (h *PortalHandler) RecordPayment(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get invoice ID from path parameter
	invoiceIDStr := getPathParam(r, "invoice_id")
	invoiceID, err := uuid.Parse(invoiceIDStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid invoice ID")
		return
	}

	// Parse request body
	var req struct {
		Amount    int64  `json:"amount"`
		Method    string `json:"method"`
		Reference string `json:"reference,omitempty"`
		Notes     string `json:"notes,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate method
	if req.Method != "cash" && req.Method != "collector" && req.Method != "midtrans" {
		sendError(w, http.StatusBadRequest, "Invalid payment method. Only 'cash', 'collector', and 'midtrans' are allowed")
		return
	}

	// Convert to billing.PaymentMethod
	method := billing.PaymentMethod(req.Method)

	// Prepare optional fields
	var reference, notes *string
	if req.Reference != "" {
		reference = &req.Reference
	}
	if req.Notes != "" {
		notes = &req.Notes
	}

	// Record payment
	payment, err := h.portalService.RecordPayment(r.Context(), tenantID, userID, invoiceID, req.Amount, method, reference, notes)
	if err != nil {
		log.Error().Err(err).Msg("Failed to record payment")
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, payment)
}

func (h *PortalHandler) GetSnapToken(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get invoice ID from path parameter
	invoiceIDStr := getPathParam(r, "id")
	invoiceID, err := uuid.Parse(invoiceIDStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid invoice ID")
		return
	}

	category := r.URL.Query().Get("category")
	token, err := h.portalService.GetSnapToken(r.Context(), tenantID, userID, invoiceID, category)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get snap token for portal invoice")
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"token": token})
}

func (h *PortalHandler) GetMidtransConfig(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	config, err := h.portalService.GetMidtransConfig(r.Context(), tenantID.String())
	if err != nil {
		log.Error().Err(err).Msg("Failed to get midtrans config for portal")
		sendError(w, http.StatusInternalServerError, "Failed to get payment config")
		return
	}

	sendJSON(w, http.StatusOK, config)
}

