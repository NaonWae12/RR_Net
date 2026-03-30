package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/service"
)

type PayrollHandler struct {
	payrollService *service.PayrollService
}

func NewPayrollHandler(payrollService *service.PayrollService) *PayrollHandler {
	return &PayrollHandler{payrollService: payrollService}
}

type CreatePayrollRunRequest struct {
	Period string `json:"period"` // YYYY-MM
}

func (h *PayrollHandler) CreateRun(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req CreatePayrollRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Period == "" {
		sendError(w, http.StatusBadRequest, "Period is required")
		return
	}

	run, err := h.payrollService.CreatePayrollRun(ctx(r), tenantID, req.Period)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, run)
}

func (h *PayrollHandler) ListRuns(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	runs, err := h.payrollService.ListPayrollRuns(ctx(r), tenantID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data": runs,
	})
}

func (h *PayrollHandler) GetRun(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	run, err := h.payrollService.GetPayrollRun(ctx(r), id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, run)
}

func (h *PayrollHandler) GetPreview(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	userIDStr := r.URL.Query().Get("user_id")
	period := r.URL.Query().Get("period")

	if userIDStr == "" || period == "" {
		sendError(w, http.StatusBadRequest, "user_id and period are required")
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid user_id")
		return
	}

	preview, err := h.payrollService.GetPayslipPreview(ctx(r), tenantID, userID, period)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, preview)
}

func (h *PayrollHandler) UpsertPayslip(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req service.UpsertPayslipInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	ps, err := h.payrollService.UpsertPayslip(ctx(r), tenantID, req)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, ps)
}

func (h *PayrollHandler) PayPayslip(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var req struct {
		PaymentMethodID  *uuid.UUID `json:"payment_method_id"`
		PaymentReference *string    `json:"payment_reference"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.payrollService.PayPayslip(ctx(r), id, req.PaymentMethodID, req.PaymentReference); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{
		"message": "Payslip marked as paid",
	})
}

func (h *PayrollHandler) ListMyPayslips(w http.ResponseWriter, r *http.Request) {
	id, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	payslips, err := h.payrollService.ListMyPayslips(ctx(r), id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data": payslips,
	})
}

func (h *PayrollHandler) GetMyPayslip(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	ps, err := h.payrollService.GetPayslipDetails(ctx(r), id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if ps.UserID != userID {
		sendError(w, http.StatusForbidden, "Forbidden")
		return
	}

	sendJSON(w, http.StatusOK, ps)
}

func (h *PayrollHandler) DownloadMyPayslip(w http.ResponseWriter, r *http.Request) {
	// For now, return JSON as a placeholder or use GetMyPayslip
	// Real PDF generation would go here
	h.GetMyPayslip(w, r)
}

func (h *PayrollHandler) PayRun(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	var req struct {
		PaymentMethodID  *uuid.UUID `json:"payment_method_id"`
		PaymentReference *string    `json:"payment_reference"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.payrollService.PayRun(ctx(r), id, req.PaymentMethodID, req.PaymentReference); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{
		"message": "Payroll run marked as paid",
	})
}

// Helper for context
func ctx(r *http.Request) context.Context {
	return r.Context()
}

// Fixed helper imports if needed
