package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

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
	if err := h.service.GenerateTenantInvoices(r.Context()); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sendJSON(w, http.StatusOK, map[string]string{"message": "Invoices generated successfully"})
}
