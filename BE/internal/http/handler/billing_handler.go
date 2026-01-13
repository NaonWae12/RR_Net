package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/domain/billing"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

type BillingHandler struct {
	billingService *service.BillingService
}

func NewBillingHandler(billingService *service.BillingService) *BillingHandler {
	return &BillingHandler{billingService: billingService}
}

// ========== Invoice Handlers ==========

func (h *BillingHandler) ListInvoices(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	filter := repository.InvoiceFilter{TenantID: tenantID}

	// Parse query params
	if clientID := r.URL.Query().Get("client_id"); clientID != "" {
		if id, err := uuid.Parse(clientID); err == nil {
			filter.ClientID = &id
		}
	}
	if clientName := r.URL.Query().Get("client_name"); clientName != "" {
		filter.ClientName = &clientName
	}
	if phone := r.URL.Query().Get("phone"); phone != "" {
		filter.ClientPhone = &phone
	}
	if address := r.URL.Query().Get("address"); address != "" {
		filter.ClientAddress = &address
	}
	if groupID := r.URL.Query().Get("group_id"); groupID != "" {
		if id, err := uuid.Parse(groupID); err == nil {
			filter.GroupID = &id
		}
	}
	if status := r.URL.Query().Get("status"); status != "" {
		s := billing.InvoiceStatus(status)
		filter.Status = &s
	}
	if page := r.URL.Query().Get("page"); page != "" {
		if p, err := strconv.Atoi(page); err == nil {
			filter.Page = p
		}
	}
	if pageSize := r.URL.Query().Get("page_size"); pageSize != "" {
		if ps, err := strconv.Atoi(pageSize); err == nil {
			filter.PageSize = ps
		}
	}

	invoices, total, err := h.billingService.ListInvoices(r.Context(), filter)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list invoices")
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  invoices,
		"total": total,
		"page":  filter.Page,
	})
}

func (h *BillingHandler) GetInvoice(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid invoice ID"}`, http.StatusBadRequest)
		return
	}

	invoice, err := h.billingService.GetInvoice(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invoice)
}

func (h *BillingHandler) CreateInvoice(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	var req service.CreateInvoiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.ClientID == uuid.Nil {
		http.Error(w, `{"error":"client_id is required"}`, http.StatusBadRequest)
		return
	}
	if len(req.Items) == 0 {
		http.Error(w, `{"error":"At least one item is required"}`, http.StatusBadRequest)
		return
	}

	invoice, err := h.billingService.CreateInvoice(r.Context(), tenantID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(invoice)
}

func (h *BillingHandler) CancelInvoice(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid invoice ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.billingService.CancelInvoice(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *BillingHandler) GetClientPendingInvoices(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "client_id")
	clientID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid client ID"}`, http.StatusBadRequest)
		return
	}

	invoices, err := h.billingService.GetClientPendingInvoices(r.Context(), clientID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  invoices,
		"total": len(invoices),
	})
}

func (h *BillingHandler) GetOverdueInvoices(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	invoices, err := h.billingService.GetOverdueInvoices(r.Context(), tenantID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  invoices,
		"total": len(invoices),
	})
}

func (h *BillingHandler) GenerateMonthlyInvoice(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	idStr := getPathParam(r, "client_id")
	clientID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid client ID"}`, http.StatusBadRequest)
		return
	}

	invoice, err := h.billingService.GenerateMonthlyInvoice(r.Context(), tenantID, clientID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(invoice)
}

// ========== Payment Handlers ==========

func (h *BillingHandler) ListPayments(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	filter := repository.PaymentFilter{TenantID: tenantID}

	if clientID := r.URL.Query().Get("client_id"); clientID != "" {
		if id, err := uuid.Parse(clientID); err == nil {
			filter.ClientID = &id
		}
	}
	if collectorID := r.URL.Query().Get("collector_id"); collectorID != "" {
		if id, err := uuid.Parse(collectorID); err == nil {
			filter.CollectorID = &id
		}
	}
	if method := r.URL.Query().Get("method"); method != "" {
		m := billing.PaymentMethod(method)
		filter.Method = &m
	}
	if page := r.URL.Query().Get("page"); page != "" {
		if p, err := strconv.Atoi(page); err == nil {
			filter.Page = p
		}
	}
	if pageSize := r.URL.Query().Get("page_size"); pageSize != "" {
		if ps, err := strconv.Atoi(pageSize); err == nil {
			filter.PageSize = ps
		}
	}

	payments, total, err := h.billingService.ListPayments(r.Context(), filter)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list payments")
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  payments,
		"total": total,
		"page":  filter.Page,
	})
}

func (h *BillingHandler) GetPayment(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid payment ID"}`, http.StatusBadRequest)
		return
	}

	payment, err := h.billingService.GetPayment(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payment)
}

func (h *BillingHandler) GetPaymentMatrix(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	// Parse query params
	year := time.Now().Year()
	if yearStr := r.URL.Query().Get("year"); yearStr != "" {
		if y, err := strconv.Atoi(yearStr); err == nil && y > 2000 && y < 2100 {
			year = y
		}
	}

	filter := service.PaymentMatrixFilter{
		TenantID: tenantID,
		Year:     year,
	}

	if clientName := r.URL.Query().Get("q"); clientName != "" {
		filter.ClientName = &clientName
	}
	if groupID := r.URL.Query().Get("group_id"); groupID != "" {
		if id, err := uuid.Parse(groupID); err == nil {
			filter.GroupID = &id
		}
	}
	if status := r.URL.Query().Get("status"); status != "" {
		filter.Status = &status
	}

	matrix, err := h.billingService.GetPaymentMatrix(r.Context(), filter)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get payment matrix")
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	years, err := h.billingService.GetInvoiceYears(r.Context(), tenantID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get invoice years")
		years = []int{year}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":            matrix,
		"year":            year,
		"available_years": years,
	})
}

func (h *BillingHandler) RecordPayment(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	var req service.RecordPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.InvoiceID == uuid.Nil {
		http.Error(w, `{"error":"invoice_id is required"}`, http.StatusBadRequest)
		return
	}
	if req.Amount <= 0 {
		http.Error(w, `{"error":"amount must be positive"}`, http.StatusBadRequest)
		return
	}

	payment, err := h.billingService.RecordPayment(r.Context(), tenantID, userID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(payment)
}

func (h *BillingHandler) GetInvoicePayments(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "invoice_id")
	invoiceID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid invoice ID"}`, http.StatusBadRequest)
		return
	}

	payments, err := h.billingService.GetInvoicePayments(r.Context(), invoiceID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  payments,
		"total": len(payments),
	})
}

// ========== Summary Handlers ==========

func (h *BillingHandler) GetBillingSummary(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	summary, err := h.billingService.GetBillingSummary(r.Context(), tenantID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

