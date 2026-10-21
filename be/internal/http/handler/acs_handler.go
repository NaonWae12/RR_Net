package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"rrnet/internal/service"
)

type ACSHandler struct {
	acsService *service.ACSService
}

func NewACSHandler(acsService *service.ACSService) *ACSHandler {
	return &ACSHandler{acsService: acsService}
}

// ListDevices returns list of all ONT devices.
func (h *ACSHandler) ListDevices(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := r.Context().Value("tenant_id").(uuid.UUID)
	if !ok {
		tenantID = uuid.Nil
	}

	devices, err := h.acsService.ListDevices(r.Context(), tenantID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  devices,
		"total": len(devices),
	})
}

// GetDevice returns details of a single ONT device.
func (h *ACSHandler) GetDevice(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := r.Context().Value("tenant_id").(uuid.UUID)
	if !ok {
		tenantID = uuid.Nil
	}

	deviceID := strings.TrimPrefix(r.URL.Path, "/api/v1/acs/devices/")
	deviceID = strings.TrimSpace(deviceID)
	if deviceID == "" {
		http.Error(w, `{"error":"device_id is required"}`, http.StatusBadRequest)
		return
	}

	device, err := h.acsService.GetDevice(r.Context(), tenantID, deviceID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"data": device,
	})
}

// Reboot triggers device restart.
func (h *ACSHandler) Reboot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	tenantID, ok := r.Context().Value("tenant_id").(uuid.UUID)
	if !ok {
		tenantID = uuid.Nil
	}

	// Path: /api/v1/acs/devices/{id}/reboot
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/acs/devices/")
	deviceID := strings.TrimSuffix(path, "/reboot")

	if err := h.acsService.Reboot(r.Context(), tenantID, deviceID); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "Reboot command sent successfully",
	})
}

type SetWiFiRequest struct {
	SSID     string `json:"ssid"`
	Password string `json:"password"`
}

// SetWiFi updates WiFi SSID and passphrase.
func (h *ACSHandler) SetWiFi(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	tenantID, ok := r.Context().Value("tenant_id").(uuid.UUID)
	if !ok {
		tenantID = uuid.Nil
	}

	// Path: /api/v1/acs/devices/{id}/wifi
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/acs/devices/")
	deviceID := strings.TrimSuffix(path, "/wifi")

	var req SetWiFiRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if err := h.acsService.SetWiFi(r.Context(), tenantID, deviceID, req.SSID, req.Password); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "WiFi configuration sent to ONT successfully",
	})
}

// Refresh triggers parameter refresh.
func (h *ACSHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	tenantID, ok := r.Context().Value("tenant_id").(uuid.UUID)
	if !ok {
		tenantID = uuid.Nil
	}

	// Path: /api/v1/acs/devices/{id}/refresh
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/acs/devices/")
	deviceID := strings.TrimSuffix(path, "/refresh")

	if err := h.acsService.Refresh(r.Context(), tenantID, deviceID); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "Parameter refresh task queued successfully",
	})
}
