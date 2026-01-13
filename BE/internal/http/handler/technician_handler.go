package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/service"
)

type TechnicianHandler struct {
	technicianService *service.TechnicianService
}

func NewTechnicianHandler(technicianService *service.TechnicianService) *TechnicianHandler {
	return &TechnicianHandler{technicianService: technicianService}
}

// ========== Task Handlers ==========

func (h *TechnicianHandler) ListTasks(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	technicianID := r.URL.Query().Get("technician_id")
	if technicianID != "" {
		id, err := uuid.Parse(technicianID)
		if err == nil {
			tasks, err := h.technicianService.ListTasksByTechnician(r.Context(), id)
			if err != nil {
				http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"data":  tasks,
				"total": len(tasks),
			})
			return
		}
	}

	tasks, err := h.technicianService.ListTasks(r.Context(), tenantID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  tasks,
		"total": len(tasks),
	})
}

func (h *TechnicianHandler) GetTask(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid task ID"}`, http.StatusBadRequest)
		return
	}

	task, err := h.technicianService.GetTask(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

func (h *TechnicianHandler) CreateTask(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	assignedBy, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	var req service.CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Title == "" || req.TechnicianID == uuid.Nil {
		http.Error(w, `{"error":"title and technician_id are required"}`, http.StatusBadRequest)
		return
	}

	task, err := h.technicianService.CreateTask(r.Context(), tenantID, assignedBy, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(task)
}

func (h *TechnicianHandler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid task ID"}`, http.StatusBadRequest)
		return
	}

	var req service.UpdateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	task, err := h.technicianService.UpdateTask(r.Context(), id, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

func (h *TechnicianHandler) StartTask(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid task ID"}`, http.StatusBadRequest)
		return
	}

	technicianID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	task, err := h.technicianService.StartTask(r.Context(), id, technicianID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

func (h *TechnicianHandler) CompleteTask(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid task ID"}`, http.StatusBadRequest)
		return
	}

	technicianID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		ActualHours *float64 `json:"actual_hours,omitempty"`
		Notes       string   `json:"notes,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	task, err := h.technicianService.CompleteTask(r.Context(), id, technicianID, req.ActualHours, req.Notes)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

func (h *TechnicianHandler) CancelTask(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid task ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.technicianService.CancelTask(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *TechnicianHandler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid task ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.technicianService.DeleteTask(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *TechnicianHandler) GetTaskSummary(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	var technicianID *uuid.UUID
	if techIDStr := r.URL.Query().Get("technician_id"); techIDStr != "" {
		if id, err := uuid.Parse(techIDStr); err == nil {
			technicianID = &id
		}
	}

	summary, err := h.technicianService.GetTaskSummary(r.Context(), tenantID, technicianID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

// ========== Activity Log Handlers ==========

func (h *TechnicianHandler) LogActivity(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	technicianID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	var req service.LogActivityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.ActivityType == "" || req.Description == "" {
		http.Error(w, `{"error":"activity_type and description are required"}`, http.StatusBadRequest)
		return
	}

	log, err := h.technicianService.LogActivity(r.Context(), tenantID, technicianID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(log)
}

func (h *TechnicianHandler) ListActivityLogs(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	var technicianID *uuid.UUID
	if techIDStr := r.URL.Query().Get("technician_id"); techIDStr != "" {
		if id, err := uuid.Parse(techIDStr); err == nil {
			technicianID = &id
		}
	}

	limit := 50
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	logs, err := h.technicianService.ListActivityLogs(r.Context(), tenantID, technicianID, limit)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  logs,
		"total": len(logs),
	})
}

func (h *TechnicianHandler) GetTaskActivityLogs(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "task_id")
	taskID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid task ID"}`, http.StatusBadRequest)
		return
	}

	logs, err := h.technicianService.ListActivityLogsByTask(r.Context(), taskID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  logs,
		"total": len(logs),
	})
}

