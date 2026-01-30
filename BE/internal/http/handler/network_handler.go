package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

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

	// If not provisioning/VPN, host is required. But in our new wizard,
	// the host will be provided by FE from Step 2.
	if req.Name == "" || req.Username == "" || req.Password == "" {
		http.Error(w, `{"error":"Name, username and password are required"}`, http.StatusBadRequest)
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

func (h *NetworkHandler) ProvisionRouter(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	res, err := h.networkService.ProvisionRouter(r.Context(), tenantID, req.Name)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
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

// ========== Isolir Handlers ==========

// InstallIsolirFirewall installs the firewall rule to block isolated users on a router
func (h *NetworkHandler) InstallIsolirFirewall(w http.ResponseWriter, r *http.Request) {
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

	// Verify router belongs to tenant
	router, err := h.networkService.GetRouter(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"Router not found"}`, http.StatusNotFound)
		return
	}
	if router.TenantID != tenantID {
		http.Error(w, `{"error":"Router not found"}`, http.StatusNotFound)
		return
	}

	// Install firewall
	if err := h.networkService.InstallIsolirFirewall(r.Context(), id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Isolir firewall installed successfully",
	})
}

// GetIsolirStatus checks if isolir firewall is installed on a router
func (h *NetworkHandler) GetIsolirStatus(w http.ResponseWriter, r *http.Request) {
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

	// Verify router belongs to tenant
	router, err := h.networkService.GetRouter(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"Router not found"}`, http.StatusNotFound)
		return
	}
	if router.TenantID != tenantID {
		http.Error(w, `{"error":"Router not found"}`, http.StatusNotFound)
		return
	}

	// Get isolir status
	status, err := h.networkService.GetIsolirStatus(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(status)
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

func (h *NetworkHandler) ToggleRemoteAccess(w http.ResponseWriter, r *http.Request) {
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

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
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

	updatedRouter, err := h.networkService.ToggleRemoteAccess(r.Context(), id, req.Enabled)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	updatedRouter.Password = ""
	updatedRouter.RadiusSecret = ""

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updatedRouter)
}

// SyncProfileToRouter syncs a network profile to a specific MikroTik router
func (h *NetworkHandler) SyncProfileToRouter(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	profileID, ok := getUUIDParam(r, "id")
	if !ok {
		http.Error(w, `{"error":"Invalid profile ID"}`, http.StatusBadRequest)
		return
	}

	routerIDStr := r.URL.Query().Get("router_id")
	if routerIDStr == "" {
		http.Error(w, `{"error":"router_id query parameter is required"}`, http.StatusBadRequest)
		return
	}

	routerID, err := uuid.Parse(routerIDStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid router_id"}`, http.StatusBadRequest)
		return
	}

	// Verify profile belongs to tenant
	profile, err := h.networkService.GetProfile(r.Context(), profileID)
	if err != nil {
		http.Error(w, `{"error":"Profile not found"}`, http.StatusNotFound)
		return
	}
	if profile.TenantID != tenantID {
		http.Error(w, `{"error":"Profile not found"}`, http.StatusNotFound)
		return
	}

	// Sync profile to router
	if err := h.networkService.SyncProfileToRouter(r.Context(), profileID, routerID); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Profile synced to router successfully",
	})
}

// ListProfilesFromRouter lists all PPPoE profiles from a MikroTik router
func (h *NetworkHandler) ListProfilesFromRouter(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	routerIDStr := r.URL.Query().Get("router_id")
	if routerIDStr == "" {
		http.Error(w, `{"error":"router_id query parameter is required"}`, http.StatusBadRequest)
		return
	}

	routerID, err := uuid.Parse(routerIDStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid router_id"}`, http.StatusBadRequest)
		return
	}

	// Verify router belongs to tenant
	router, err := h.networkService.GetRouter(r.Context(), routerID)
	if err != nil {
		http.Error(w, `{"error":"Router not found"}`, http.StatusNotFound)
		return
	}
	if router.TenantID != tenantID {
		http.Error(w, `{"error":"Router not found"}`, http.StatusNotFound)
		return
	}

	// List profiles from router
	profiles, err := h.networkService.ListProfilesFromRouter(r.Context(), routerID)
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

// ImportProfileFromRouter imports a PPPoE profile from MikroTik router to ERP
func (h *NetworkHandler) ImportProfileFromRouter(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	routerIDStr := r.URL.Query().Get("router_id")
	if routerIDStr == "" {
		http.Error(w, `{"error":"router_id query parameter is required"}`, http.StatusBadRequest)
		return
	}

	routerID, err := uuid.Parse(routerIDStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid router_id"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		ProfileName string `json:"profile_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.ProfileName == "" {
		http.Error(w, `{"error":"profile_name is required"}`, http.StatusBadRequest)
		return
	}

	// Import profile from router
	profile, err := h.networkService.ImportProfileFromRouter(r.Context(), tenantID, routerID, req.ProfileName)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(profile)
}
