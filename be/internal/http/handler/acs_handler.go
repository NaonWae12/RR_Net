package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"rrnet/internal/auth"
	"rrnet/internal/service"
)

type ACSHandler struct {
	acsService *service.ACSService
}

func NewACSHandler(acsService *service.ACSService) *ACSHandler {
	return &ACSHandler{acsService: acsService}
}

// ListDevices returns list of ONT devices belonging to the authenticated tenant.
func (h *ACSHandler) ListDevices(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"unauthorized: tenant context missing"}`, http.StatusUnauthorized)
		return
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

// ListUnassignedDevices returns devices detected by GenieACS that haven't been claimed by any tenant yet.
func (h *ACSHandler) ListUnassignedDevices(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"unauthorized: tenant context missing"}`, http.StatusUnauthorized)
		return
	}

	devices, err := h.acsService.ListUnassignedDevices(r.Context(), tenantID)
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

type ClaimDeviceRequest struct {
	DeviceID     string     `json:"device_id"`
	SerialNumber string     `json:"serial_number"`
	Label        string     `json:"label"`
	ClientID     *uuid.UUID `json:"client_id"`
}

// ClaimDevice registers/claims an ONT device to the tenant.
func (h *ACSHandler) ClaimDevice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"unauthorized: tenant context missing"}`, http.StatusUnauthorized)
		return
	}

	var req ClaimDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"format request tidak valid"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.DeviceID) == "" {
		http.Error(w, `{"error":"device_id wajib diisi"}`, http.StatusBadRequest)
		return
	}

	if err := h.acsService.ClaimDevice(r.Context(), tenantID, req.DeviceID, req.SerialNumber, req.Label, req.ClientID); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "Perangkat ONT berhasil didaftarkan ke tenant Anda",
	})
}

// UnclaimDevice unregisters a device from the tenant.
func (h *ACSHandler) UnclaimDevice(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"unauthorized: tenant context missing"}`, http.StatusUnauthorized)
		return
	}

	// Path: /api/v1/acs/devices/{id} or /api/v1/acs/devices/{id}/claim or /api/v1/acs/devices/{id}/unregister
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/acs/devices/")
	deviceID := strings.TrimSuffix(path, "/claim")
	deviceID = strings.TrimSuffix(deviceID, "/unregister")
	deviceID = strings.TrimSpace(deviceID)

	if deviceID == "" {
		http.Error(w, `{"error":"device_id wajib disertakan"}`, http.StatusBadRequest)
		return
	}

	if err := h.acsService.UnclaimDevice(r.Context(), tenantID, deviceID); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "Perangkat ONT berhasil dilepas dari tenant",
	})
}

type UpdateMetadataRequest struct {
	SerialNumber string     `json:"serial_number"`
	Label        string     `json:"label"`
	ClientID     *uuid.UUID `json:"client_id"`
}

// UpdateMetadata updates label or client binding for a device.
func (h *ACSHandler) UpdateMetadata(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"unauthorized: tenant context missing"}`, http.StatusUnauthorized)
		return
	}

	// Path: /api/v1/acs/devices/{id}/metadata
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/acs/devices/")
	deviceID := strings.TrimSuffix(path, "/metadata")
	deviceID = strings.TrimSpace(deviceID)

	var req UpdateMetadataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"format request tidak valid"}`, http.StatusBadRequest)
		return
	}

	if err := h.acsService.UpdateMetadata(r.Context(), tenantID, deviceID, req.SerialNumber, req.Label, req.ClientID); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "Data perangkat ONT berhasil diperbarui",
	})
}

// GetDevice returns details of a single ONT device.
func (h *ACSHandler) GetDevice(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"unauthorized: tenant context missing"}`, http.StatusUnauthorized)
		return
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

	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"unauthorized: tenant context missing"}`, http.StatusUnauthorized)
		return
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
	Slot         int    `json:"slot"`
	SSID         string `json:"ssid"`
	Password     string `json:"password"`
	SecurityMode string `json:"security_mode,omitempty"`
	Encryption   string `json:"encryption,omitempty"`
	Enabled      *bool  `json:"enabled,omitempty"`
	Channel      *int   `json:"channel,omitempty"`
	TxPower      *int   `json:"tx_power,omitempty"`
}

// SetWiFi updates WiFi SSID, passphrase, and security settings.
func (h *ACSHandler) SetWiFi(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"unauthorized: tenant context missing"}`, http.StatusUnauthorized)
		return
	}

	// Path: /api/v1/acs/devices/{id}/wifi
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/acs/devices/")
	deviceID := strings.TrimSuffix(path, "/wifi")

	var req SetWiFiRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.Slot <= 0 {
		req.Slot = 1
	}

	payload := service.SetWiFiPayload{
		Slot:         req.Slot,
		SSID:         req.SSID,
		Password:     req.Password,
		SecurityMode: req.SecurityMode,
		Encryption:   req.Encryption,
		Enabled:      req.Enabled,
		Channel:      req.Channel,
		TxPower:      req.TxPower,
	}

	if err := h.acsService.SetWiFi(r.Context(), tenantID, deviceID, payload); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": fmt.Sprintf("Konfigurasi WiFi #%d berhasil dikirim ke antrean ONT via TR-069!", req.Slot),
	})
}

type SetWANRequest struct {
	Slot        int    `json:"slot"`
	Mode        string `json:"mode"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	VLANID      int    `json:"vlan_id"`
	ServiceList string `json:"service_list"`
	NATEnabled  *bool  `json:"nat_enabled"`
}

// SetWAN updates WAN connection settings (PPPoE, IPoE, or Bridge), credentials, and VLAN on ONT.
func (h *ACSHandler) SetWAN(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"unauthorized: tenant context missing"}`, http.StatusUnauthorized)
		return
	}

	// Path: /api/v1/acs/devices/{id}/wan
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/acs/devices/")
	deviceID := strings.TrimSuffix(path, "/wan")
	deviceID = strings.TrimSpace(deviceID)

	var req SetWANRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
		return
	}

	payload := service.SetWANPayload{
		Slot:        req.Slot,
		Mode:        req.Mode,
		Username:    req.Username,
		Password:    req.Password,
		VLANID:      req.VLANID,
		ServiceList: req.ServiceList,
		NATEnabled:  req.NATEnabled,
	}

	if err := h.acsService.SetWAN(r.Context(), tenantID, deviceID, payload); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "Konfigurasi WAN berhasil dikirim ke antrean ONT via TR-069!",
	})
}

// Refresh triggers parameter refresh.
func (h *ACSHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"unauthorized: tenant context missing"}`, http.StatusUnauthorized)
		return
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

type SetInformIntervalRequest struct {
	IntervalSeconds int `json:"interval_seconds"`
}

// SetInformInterval configures the TR-069 PeriodicInformInterval on the ONT device.
func (h *ACSHandler) SetInformInterval(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"unauthorized: tenant context missing"}`, http.StatusUnauthorized)
		return
	}

	// Path: /api/v1/acs/devices/{id}/inform-interval
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/acs/devices/")
	deviceID := strings.TrimSuffix(path, "/inform-interval")
	deviceID = strings.TrimSpace(deviceID)

	var req SetInformIntervalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.IntervalSeconds == 0 {
		http.Error(w, `{"error":"interval_seconds wajib diisi dan harus lebih dari 0"}`, http.StatusBadRequest)
		return
	}

	if err := h.acsService.SetInformInterval(r.Context(), tenantID, deviceID, req.IntervalSeconds); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"message":          fmt.Sprintf("Interval inform berhasil diset ke %d detik. Modem akan menerapkannya saat koneksi berikutnya.", req.IntervalSeconds),
		"interval_seconds": req.IntervalSeconds,
	})
}

