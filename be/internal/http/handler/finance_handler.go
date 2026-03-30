package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"rrnet/internal/auth"
	"rrnet/internal/service"
)

type FinanceHandler struct {
	financeService *service.FinanceService
}

func NewFinanceHandler(financeService *service.FinanceService) *FinanceHandler {
	return &FinanceHandler{
		financeService: financeService,
	}
}

func (h *FinanceHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	yearStr := r.URL.Query().Get("year")
	monthStr := r.URL.Query().Get("month")

	if yearStr != "" && monthStr != "" {
		year, _ := strconv.Atoi(yearStr)
		month, _ := strconv.Atoi(monthStr)
		summary, err := h.financeService.GetFilteredRevenueSummary(r.Context(), tenantID, year, month)
		if err != nil {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(summary)
		return
	}

	summary, err := h.financeService.GetRevenueSummary(r.Context(), tenantID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func (h *FinanceHandler) GetTrend(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	source := r.URL.Query().Get("source")

	trend, err := h.financeService.GetTrendData(r.Context(), tenantID, year, month, source)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(trend)
}

func (h *FinanceHandler) GetBalance(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	balance, err := h.financeService.GetBalance(r.Context(), tenantID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"balance": balance,
	})
}

func (h *FinanceHandler) ListTransactions(w http.ResponseWriter, r *http.Request) {
	_, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	// For now, this is a placeholder as we don't have a sophisticated filter in repository yet
	// But it follows the pattern
	http.Error(w, `{"error":"Method not fully implemented"}`, http.StatusNotImplemented)
}
