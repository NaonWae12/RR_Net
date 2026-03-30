package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	timeoff "rrnet/internal/domain/time_off"
	"rrnet/internal/service"
)

type HRHandler struct {
	hrService *service.HRService
}

func NewHRHandler(hrService *service.HRService) *HRHandler {
	return &HRHandler{hrService: hrService}
}

func (h *HRHandler) ListReimbursements(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	status := r.URL.Query().Get("status")
	var statusPtr *string
	if status != "" {
		statusPtr = &status
	}

	// Check if user wants their own reimbursements or all (for HR)
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr != "" {
		userID, err := uuid.Parse(userIDStr)
		if err == nil {
			rbs, err := h.hrService.ListReimbursementsByUser(r.Context(), userID, statusPtr)
			if err != nil {
				http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"data": rbs, "total": len(rbs)})
			return
		}
	}

	// Default: list all for tenant (HR view)
	rbs, err := h.hrService.ListReimbursementsByTenant(r.Context(), tenantID, statusPtr)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"data": rbs, "total": len(rbs)})
}

func (h *HRHandler) GetReimbursement(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	rb, err := h.hrService.GetReimbursement(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rb)
}

func (h *HRHandler) CreateReimbursement(w http.ResponseWriter, r *http.Request) {
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

	var req service.CreateReimbursementRequest

	// Handle multipart/form-data for file uploads
	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "multipart/form-data") {
		err := r.ParseMultipartForm(10 << 20) // 10MB limit
		if err != nil {
			fmt.Printf("[ERROR] Multipart parse error: %v\n", err)
			http.Error(w, `{"error":"Failed to parse multipart form"}`, http.StatusBadRequest)
			return
		}

		amount, _ := strconv.ParseFloat(r.FormValue("amount"), 64)
		category := r.FormValue("category")
		description := r.FormValue("description")
		dateStr := r.FormValue("date")

		// Try parsing date in popular formats
		var date time.Time
		var parseErr error
		formats := []string{"2006-01-02", time.RFC3339}
		for _, f := range formats {
			date, parseErr = time.Parse(f, dateStr)
			if parseErr == nil {
				break
			}
		}

		req = service.CreateReimbursementRequest{
			Amount:      amount,
			Category:    category,
			Date:        date,
			Description: description,
		}

		// Handle file upload
		file, _, err := r.FormFile("attachment")
		if err == nil {
			defer file.Close()
			// Mock URL for now
			placeholderURL := "/uploads/reimbursements/placeholder_receipt.jpg"
			req.AttachmentURL = &placeholderURL
		}
	} else {
		// Fallback to JSON
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			fmt.Printf("[ERROR] Reimbursement JSON decode error: %v\n", err)
			http.Error(w, `{"error":"Invalid request body: `+err.Error()+`"}`, http.StatusBadRequest)
			return
		}
	}

	rb, err := h.hrService.CreateReimbursement(r.Context(), tenantID, userID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(rb)
}

func (h *HRHandler) ApproveReimbursement(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	hrID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	rb, err := h.hrService.ApproveReimbursement(r.Context(), id, hrID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rb)
}

func (h *HRHandler) RejectReimbursement(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	hrID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	rb, err := h.hrService.RejectReimbursement(r.Context(), id, hrID, req.Reason)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rb)
}

func (h *HRHandler) MarkAsPaid(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		PaymentMethodID  *uuid.UUID `json:"payment_method_id"`
		PaymentReference *string    `json:"payment_reference"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	rb, err := h.hrService.MarkAsPaid(r.Context(), id, req.PaymentMethodID, req.PaymentReference)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rb)
}

func (h *HRHandler) SetPayWithPayroll(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	rb, err := h.hrService.SetPayWithPayroll(r.Context(), id, req.Enabled)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rb)
}

func (h *HRHandler) UpdateReimbursement(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	var req service.CreateReimbursementRequest

	// Handle multipart/form-data
	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "multipart/form-data") {
		err := r.ParseMultipartForm(10 << 20)
		if err != nil {
			http.Error(w, `{"error":"Failed to parse multipart form"}`, http.StatusBadRequest)
			return
		}

		amount, _ := strconv.ParseFloat(r.FormValue("amount"), 64)
		category := r.FormValue("category")
		description := r.FormValue("description")
		dateStr := r.FormValue("date")

		var date time.Time
		formats := []string{"2006-01-02", time.RFC3339}
		for _, f := range formats {
			if d, err := time.Parse(f, dateStr); err == nil {
				date = d
				break
			}
		}

		req = service.CreateReimbursementRequest{
			Amount:      amount,
			Category:    category,
			Date:        date,
			Description: description,
		}

		file, _, err := r.FormFile("attachment")
		if err == nil {
			defer file.Close()
			placeholderURL := "/uploads/reimbursements/updated_receipt.jpg"
			req.AttachmentURL = &placeholderURL
		}
	} else {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
			return
		}
	}

	rb, err := h.hrService.UpdateReimbursement(r.Context(), id, userID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rb)
}

// ========== Time Off ==========

func (h *HRHandler) ListTimeOffs(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	status := r.URL.Query().Get("status")
	var statusPtr *string
	if status != "" {
		statusPtr = &status
	}

	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr != "" {
		userID, err := uuid.Parse(userIDStr)
		if err == nil {
			tos, err := h.hrService.ListTimeOffsByUser(r.Context(), userID, statusPtr)
			if err != nil {
				http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"data": tos, "total": len(tos)})
			return
		}
	}

	tos, err := h.hrService.ListTimeOffsByTenant(r.Context(), tenantID, statusPtr)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"data": tos, "total": len(tos)})
}

func (h *HRHandler) GetTimeOff(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	to, err := h.hrService.GetTimeOff(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(to)
}

func (h *HRHandler) CreateTimeOff(w http.ResponseWriter, r *http.Request) {
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

	var req service.CreateTimeOffRequest

	// Handle multipart/form-data
	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "multipart/form-data") {
		err := r.ParseMultipartForm(10 << 20)
		if err != nil {
			http.Error(w, `{"error":"Failed to parse multipart form"}`, http.StatusBadRequest)
			return
		}

		timeOffType := timeoff.Type(r.FormValue("type"))
		reason := r.FormValue("reason")
		startDateStr := r.FormValue("start_date")
		endDateStr := r.FormValue("end_date")

		var startDate, endDate time.Time
		formats := []string{"2006-01-02", time.RFC3339}
		for _, f := range formats {
			if d, err := time.Parse(f, startDateStr); err == nil {
				startDate = d
				break
			}
		}
		for _, f := range formats {
			if d, err := time.Parse(f, endDateStr); err == nil {
				endDate = d
				break
			}
		}

		req = service.CreateTimeOffRequest{
			Type:      timeOffType,
			StartDate: startDate,
			EndDate:   endDate,
			Reason:    reason,
		}

		file, _, err := r.FormFile("attachment")
		if err == nil {
			defer file.Close()
			placeholderURL := "/uploads/time-off/placeholder_attachment.jpg"
			req.AttachmentURL = &placeholderURL
		}
	} else {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
			return
		}
	}

	to, err := h.hrService.CreateTimeOff(r.Context(), tenantID, userID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(to)
}

func (h *HRHandler) ApproveTimeOff(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	hrID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	to, err := h.hrService.ApproveTimeOff(r.Context(), id, hrID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(to)
}

func (h *HRHandler) RejectTimeOff(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	hrID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	to, err := h.hrService.RejectTimeOff(r.Context(), id, hrID, req.Reason)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(to)
}

func (h *HRHandler) UpdateTimeOff(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	var req service.CreateTimeOffRequest
	// Handle multipart/form-data or JSON (similar to CreateTimeOff)
	// For simplicity, let's assume JSON for update for now or add multipart logic
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	to, err := h.hrService.UpdateTimeOff(r.Context(), id, userID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(to)
}

func (h *HRHandler) DeleteTimeOff(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	if err := h.hrService.DeleteTimeOff(r.Context(), id, userID); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *HRHandler) GetEmployeeStats(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	stats, err := h.hrService.GetEmployeeStats(r.Context(), tenantID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
