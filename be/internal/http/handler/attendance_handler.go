package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/domain/attendance"
	"rrnet/internal/service"
)

type AttendanceHandler struct {
	attendanceService *service.AttendanceService
}

func NewAttendanceHandler(attendanceService *service.AttendanceService) *AttendanceHandler {
	return &AttendanceHandler{attendanceService: attendanceService}
}

func (h *AttendanceHandler) CheckIn(w http.ResponseWriter, r *http.Request) {
	tenantID, _ := auth.GetTenantID(r.Context())
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	var req service.CheckInRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Logging
	fmt.Printf("[DEBUG] CheckIn Request - User: %s, Tenant: %s, Lat: %v, Lng: %v\n",
		userID, tenantID, req.Latitude, req.Longitude)

	att, err := h.attendanceService.CheckIn(r.Context(), tenantID, userID, req)
	if err != nil {
		fmt.Printf("[ERROR] CheckIn Error: %v\n", err)
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(att)
}

func (h *AttendanceHandler) CheckOut(w http.ResponseWriter, r *http.Request) {
	tenantID, _ := auth.GetTenantID(r.Context())
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	var req service.CheckOutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Logging
	fmt.Printf("[DEBUG] CheckOut Request - User: %s, Tenant: %s, Lat: %v, Lng: %v\n",
		userID, tenantID, req.Latitude, req.Longitude)

	att, err := h.attendanceService.CheckOut(r.Context(), tenantID, userID, req)
	if err != nil {
		fmt.Printf("[ERROR] CheckOut Error: %v\n", err)
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(att)
}

func (h *AttendanceHandler) GetToday(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	// Support user_id override if admin/hr
	if targetID := r.URL.Query().Get("user_id"); targetID != "" {
		if id, err := uuid.Parse(targetID); err == nil {
			userID = id
		}
	}

	att, err := h.attendanceService.GetTodayAttendance(r.Context(), userID)
	if err != nil {
		if err.Error() == "attendance record not found" {
			http.Error(w, `{"error":"Not found"}`, http.StatusNotFound)
		} else {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		}
		return
	}

	json.NewEncoder(w).Encode(att)
}

func (h *AttendanceHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No user context"}`, http.StatusBadRequest)
		return
	}

	if targetID := r.URL.Query().Get("user_id"); targetID != "" {
		if id, err := uuid.Parse(targetID); err == nil {
			userID = id
		}
	}

	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")

	if startDate == "" || endDate == "" {
		http.Error(w, `{"error":"start_date and end_date are required"}`, http.StatusBadRequest)
		return
	}

	atts, err := h.attendanceService.ListAttendance(r.Context(), userID, startDate, endDate)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"data": atts, "total": len(atts)})
}

func (h *AttendanceHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	tenantID, _ := auth.GetTenantID(r.Context())

	startDate := r.URL.Query().Get("start_date")
	endDate := r.URL.Query().Get("end_date")

	if startDate == "" || endDate == "" {
		http.Error(w, `{"error":"start_date and end_date are required"}`, http.StatusBadRequest)
		return
	}

	atts, err := h.attendanceService.ListAllAttendance(r.Context(), tenantID, startDate, endDate)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{"data": atts, "total": len(atts)})
}

// Settings Handlers

func (h *AttendanceHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	tenantID, _ := auth.GetTenantID(r.Context())
	settings, err := h.attendanceService.GetSettings(r.Context(), tenantID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(settings)
}

func (h *AttendanceHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	tenantID, _ := auth.GetTenantID(r.Context())
	userID, _ := auth.GetUserID(r.Context())

	var settings attendance.AttendanceSettings
	if err := json.NewDecoder(r.Body).Decode(&settings); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Debug logging
	settingsJSON, _ := json.MarshalIndent(settings, "", "  ")
	println("=== Updating Attendance Settings ===")
	println(string(settingsJSON))
	println("====================================")

	err := h.attendanceService.UpdateSettings(r.Context(), tenantID, userID, &settings)
	if err != nil {
		println("ERROR saving settings:", err.Error())
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
