package handler

import (
	// Added fmt
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/domain/finance"
	"rrnet/internal/service"
)

type ExpenseHandler struct {
	service *service.ExpenseService
}

func NewExpenseHandler(service *service.ExpenseService) *ExpenseHandler {
	return &ExpenseHandler{service: service}
}

func (h *ExpenseHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	filter := finance.ExpenseFilter{
		Status:   r.URL.Query().Get("status"),
		Category: r.URL.Query().Get("category"),
	}

	if isRecStr := r.URL.Query().Get("is_recurring"); isRecStr != "" {
		isRec, err := strconv.ParseBool(isRecStr)
		if err == nil {
			filter.IsRecurring = &isRec
		}
	}

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		filter.Limit, _ = strconv.Atoi(limitStr)
	}
	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		filter.Offset, _ = strconv.Atoi(offsetStr)
	}

	expenses, err := h.service.ListExpenses(r.Context(), tenantID, filter)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  expenses,
		"total": len(expenses), // Simplification
	})
}

func (h *ExpenseHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		fmt.Println("[ExpenseHandler] Create: Unauthorized - no tenant ID")
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var e finance.Expense
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		fmt.Printf("[ExpenseHandler] Create: JSON Decode Error: %v\n", err)
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	fmt.Printf("[ExpenseHandler] Creating expense for tenant %v: %+v\n", tenantID, e)

	if err := h.service.CreateExpense(r.Context(), tenantID, &e); err != nil {
		fmt.Printf("[ExpenseHandler] Create: Service Error: %v\n", err)
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	fmt.Printf("[ExpenseHandler] Expense created successfully. ID: %v\n", e.ID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(e); err != nil {
		fmt.Printf("[ExpenseHandler] Encode response error: %v\n", err)
	}
}

func (h *ExpenseHandler) MarkAsPaid(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		PaymentMethodID  uuid.UUID `json:"payment_method_id"`
		PaymentReference string    `json:"payment_reference"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if err := h.service.MarkAsPaid(r.Context(), id, req.PaymentMethodID, req.PaymentReference); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ExpenseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.service.DeleteExpense(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
