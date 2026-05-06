package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/domain/billing"
	"rrnet/internal/service"
)

type PlatformBillingHandler struct {
	service *service.PlatformBillingService
}

func NewPlatformBillingHandler(service *service.PlatformBillingService) *PlatformBillingHandler {
	return &PlatformBillingHandler{service: service}
}

// ========== Tenant Endpoints ==========

func (h *PlatformBillingHandler) GetMyInvoices(w http.ResponseWriter, r *http.Request) {
	tenantID, _ := auth.GetTenantID(r.Context())
	invoices, err := h.service.GetTenantInvoices(r.Context(), tenantID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if invoices == nil {
		invoices = []*billing.PlatformInvoice{}
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data":  invoices,
		"total": len(invoices),
	})
}

func (h *PlatformBillingHandler) SubmitPayment(w http.ResponseWriter, r *http.Request) {
	tenantID, _ := auth.GetTenantID(r.Context())
	var req struct {
		InvoiceID     uuid.UUID `json:"invoice_id"`
		Method        string    `json:"method"`
		Reference     string    `json:"reference"`
		ProofImageURL string    `json:"proof_image_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	payment, err := h.service.SubmitPayment(r.Context(), tenantID, req.InvoiceID, req.Method, req.Reference, req.ProofImageURL)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sendJSON(w, http.StatusCreated, payment)
}

func (h *PlatformBillingHandler) ApplyDiscount(w http.ResponseWriter, r *http.Request) {
	var req struct {
		InvoiceID uuid.UUID `json:"invoice_id"`
		Code      string    `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	if err := h.service.ApplyDiscountToInvoice(r.Context(), req.InvoiceID, req.Code); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Fetch updated invoice to return
	updatedInv, err := h.service.GetInvoice(r.Context(), req.InvoiceID)
	if err != nil {
		sendJSON(w, http.StatusOK, map[string]string{"message": "Discount applied successfully"})
		return
	}

	sendJSON(w, http.StatusOK, updatedInv)
}

func (h *PlatformBillingHandler) RemoveDiscount(w http.ResponseWriter, r *http.Request) {
	var req struct {
		InvoiceID uuid.UUID `json:"invoice_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	if err := h.service.RemoveDiscountFromInvoice(r.Context(), req.InvoiceID); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Fetch updated invoice to return
	updatedInv, err := h.service.GetInvoice(r.Context(), req.InvoiceID)
	if err != nil {
		sendJSON(w, http.StatusOK, map[string]string{"message": "Discount removed successfully"})
		return
	}

	sendJSON(w, http.StatusOK, updatedInv)
}

func (h *PlatformBillingHandler) CancelSubmission(w http.ResponseWriter, r *http.Request) {
	tenantID, _ := auth.GetTenantID(r.Context())
	var req struct {
		InvoiceID uuid.UUID `json:"invoice_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	log.Info().Str("tenant_id", tenantID.String()).Str("invoice_id", req.InvoiceID.String()).Msg("Attempting to cancel payment submission")

	if err := h.service.CancelPaymentSubmission(r.Context(), tenantID, req.InvoiceID); err != nil {
		log.Error().Err(err).Str("invoice_id", req.InvoiceID.String()).Msg("Failed to cancel payment submission")
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	log.Info().Str("invoice_id", req.InvoiceID.String()).Msg("Payment submission cancelled successfully")

	// Fetch updated invoice to return
	updatedInv, err := h.service.GetInvoice(r.Context(), req.InvoiceID)
	if err != nil {
		sendJSON(w, http.StatusOK, map[string]string{"message": "Submission cancelled successfully"})
		return
	}

	sendJSON(w, http.StatusOK, updatedInv)
}

func (h *PlatformBillingHandler) ListAllInvoices(w http.ResponseWriter, r *http.Request) {
	invoices, err := h.service.ListAllInvoices(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if invoices == nil {
		invoices = []*billing.PlatformInvoice{}
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data":  invoices,
		"total": len(invoices),
	})
}

func (h *PlatformBillingHandler) ListAllPayments(w http.ResponseWriter, r *http.Request) {
	payments, err := h.service.ListAllPayments(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if payments == nil {
		payments = []*billing.PlatformPayment{}
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data":  payments,
		"total": len(payments),
	})
}

func (h *PlatformBillingHandler) VerifyPayment(w http.ResponseWriter, r *http.Request) {
	userID, _ := auth.GetUserID(r.Context())
	idStr := getPathParam(r, "id")
	paymentID, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid payment ID")
		return
	}

	var req struct {
		Approved bool `json:"approved"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	if err := h.service.VerifyPayment(r.Context(), paymentID, userID, req.Approved); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sendJSON(w, http.StatusOK, map[string]string{"message": "Payment verified"})
}

func (h *PlatformBillingHandler) GenerateInvoices(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID    *uuid.UUID `json:"tenant_id"`
		Month       *string    `json:"month"` // Format: YYYY-MM (for batch)
		PeriodStart *string    `json:"period_start"`
		PeriodEnd   *string    `json:"period_end"`
		DueDate     *string    `json:"due_date"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var targetMonth *time.Time
	if req.Month != nil && *req.Month != "" {
		t, err := time.Parse("2006-01", *req.Month)
		if err != nil {
			sendError(w, http.StatusBadRequest, "Invalid month format. Use YYYY-MM")
			return
		}
		targetMonth = &t
	}

	// Handle specific dates if provided (only for single tenant)
	var pStart, pEnd, dDate *time.Time
	if req.PeriodStart != nil && *req.PeriodStart != "" {
		t, _ := time.Parse("2006-01-02", *req.PeriodStart)
		pStart = &t
	}
	if req.PeriodEnd != nil && *req.PeriodEnd != "" {
		t, _ := time.Parse("2006-01-02", *req.PeriodEnd)
		pEnd = &t
	}
	if req.DueDate != nil && *req.DueDate != "" {
		t, _ := time.Parse("2006-01-02", *req.DueDate)
		dDate = &t
	}

	if err := h.service.GenerateTenantInvoices(r.Context(), req.TenantID, targetMonth, pStart, pEnd, dDate); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	
	sendJSON(w, http.StatusOK, map[string]string{"message": "Invoices generated successfully"})
}
