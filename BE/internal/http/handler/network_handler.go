package handler

import (
	"encoding/json"
	"net/http"

	"rrnet/internal/auth"
	"rrnet/internal/service"
)

type NetworkHandler struct {
	networkService *service.NetworkService
}

func NewNetworkHandler(networkService *service.NetworkService) *NetworkHandler {
	return &NetworkHandler{networkService: networkService}
}

// ========== Router Handlers ==========

func (h *NetworkHandler) ListRouters(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	routers, err := h.networkService.ListRouters(r.Context(), tenantID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  routers,
		"total": len(routers),
	})
}

func (h *NetworkHandler) GetRouter(w http.ResponseWriter, r *http.Request) {
	id, ok := getUUIDParam(r, "id")
	if !ok {
		http.Error(w, `{"error":"Invalid router ID"}`, http.StatusBadRequest)
		return
	}

	router, err := h.networkService.GetRouter(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	// Clear password before sending
	router.Password = ""
	router.RadiusSecret = ""

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(router)
}

func (h *NetworkHandler) CreateRouter(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	var req service.CreateRouterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Host == "" || req.Username == "" || req.Password == "" {
		http.Error(w, `{"error":"Name, host, username and password are required"}`, http.StatusBadRequest)
		return
	}

	router, err := h.networkService.CreateRouter(r.Context(), tenantID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	router.Password = ""
	router.RadiusSecret = ""

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(router)
}

func (h *NetworkHandler) UpdateRouter(w http.ResponseWriter, r *http.Request) {
	id, ok := getUUIDParam(r, "id")
	if !ok {
		http.Error(w, `{"error":"Invalid router ID"}`, http.StatusBadRequest)
		return
	}

	var req service.UpdateRouterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	router, err := h.networkService.UpdateRouter(r.Context(), id, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	router.Password = ""
	router.RadiusSecret = ""

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(router)
}

func (h *NetworkHandler) DeleteRouter(w http.ResponseWriter, r *http.Request) {
	id, ok := getUUIDParam(r, "id")
	if !ok {
		http.Error(w, `{"error":"Invalid router ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.networkService.DeleteRouter(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// TestRouterConnection attempts to connect/login to the router's management API.
// This is tenant-scoped (requires JWT); it does NOT expose any secrets.
func (h *NetworkHandler) TestRouterConnection(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	id, ok := getUUIDParam(r, "id")
	if !ok {
		http.Error(w, `{"error":"Invalid router ID"}`, http.StatusBadRequest)
		return
	}

	router, err := h.networkService.GetRouter(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"Router not found"}`, http.StatusNotFound)
		return
	}
	if router.TenantID != tenantID {
		http.Error(w, `{"error":"Router not found"}`, http.StatusNotFound)
		return
	}

	result, err := h.networkService.TestRouterConnection(r.Context(), router)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ok":    false,
			"error": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

// TestRouterConfig tests connection with temporary config (before saving router).
// This allows users to test connection before creating/updating router.
func (h *NetworkHandler) TestRouterConfig(w http.ResponseWriter, r *http.Request) {
	var req service.TestRouterConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Host == "" || req.Username == "" || req.Password == "" {
		http.Error(w, `{"error":"Host, username and password are required"}`, http.StatusBadRequest)
		return
	}

	result, err := h.networkService.TestRouterConfig(r.Context(), req)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ok":    false,
			"error": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

func (h *NetworkHandler) DisconnectRouter(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	id, ok := getUUIDParam(r, "id")
	if !ok {
		http.Error(w, `{"error":"Invalid router ID"}`, http.StatusBadRequest)
		return
	}

	// Verify router belongs to tenant exists
	router, err := h.networkService.GetRouter(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"Router not found"}`, http.StatusNotFound)
		return
	}
	if router.TenantID != tenantID {
		http.Error(w, `{"error":"Router not found"}`, http.StatusNotFound)
		return
	}

	if err := h.networkService.DisconnectRouter(r.Context(), id); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"ok":    false,
			"error": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"ok": true,
	})
}

// ========== Network Profile Handlers ==========

func (h *NetworkHandler) ListProfiles(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	activeOnly := r.URL.Query().Get("active") == "true"

	profiles, err := h.networkService.ListProfiles(r.Context(), tenantID, activeOnly)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  profiles,
		"total": len(profiles),
	})
}

func (h *NetworkHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	id, ok := getUUIDParam(r, "id")
	if !ok {
		http.Error(w, `{"error":"Invalid profile ID"}`, http.StatusBadRequest)
		return
	}

	profile, err := h.networkService.GetProfile(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(profile)
}

func (h *NetworkHandler) CreateProfile(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	var req service.CreateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.DownloadSpeed <= 0 || req.UploadSpeed <= 0 {
		http.Error(w, `{"error":"Name, download_speed and upload_speed are required"}`, http.StatusBadRequest)
		return
	}

	profile, err := h.networkService.CreateProfile(r.Context(), tenantID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(profile)
}

func (h *NetworkHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	id, ok := getUUIDParam(r, "id")
	if !ok {
		http.Error(w, `{"error":"Invalid profile ID"}`, http.StatusBadRequest)
		return
	}

	var req service.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	profile, err := h.networkService.UpdateProfile(r.Context(), id, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(profile)
}

func (h *NetworkHandler) DeleteProfile(w http.ResponseWriter, r *http.Request) {
	id, ok := getUUIDParam(r, "id")
	if !ok {
		http.Error(w, `{"error":"Invalid profile ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.networkService.DeleteProfile(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
