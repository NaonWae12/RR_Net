package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/domain/addon"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

// AddonHandler handles addon-related HTTP requests
type AddonHandler struct {
	addonService *service.AddonService
}

// NewAddonHandler creates a new addon handler
func NewAddonHandler(addonService *service.AddonService) *AddonHandler {
	return &AddonHandler{
		addonService: addonService,
	}
}

// List returns all addons
func (h *AddonHandler) List(w http.ResponseWriter, r *http.Request) {
	// Parse query params
	activeOnly := r.URL.Query().Get("active") == "true"
	var addonType *addon.AddonType
	if typeStr := r.URL.Query().Get("type"); typeStr != "" {
		t := addon.AddonType(typeStr)
		addonType = &t
	}

	addons, err := h.addonService.List(r.Context(), activeOnly, addonType)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to list addons")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"addons": addons,
		"total":  len(addons),
	})
}

// Get returns a single addon by ID
func (h *AddonHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Addon ID is required")
		return
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid addon ID")
		return
	}

	a, err := h.addonService.GetByID(r.Context(), id)
	if err != nil {
		if err == repository.ErrAddonNotFound {
			sendError(w, http.StatusNotFound, "Addon not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to get addon")
		return
	}

	sendJSON(w, http.StatusOK, a)
}

// Create creates a new addon
func (h *AddonHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req service.CreateAddonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	a, err := h.addonService.Create(r.Context(), &req)
	if err != nil {
		switch err {
		case service.ErrAddonCodeRequired:
			sendError(w, http.StatusBadRequest, "Addon code is required")
		case service.ErrAddonNameRequired:
			sendError(w, http.StatusBadRequest, "Addon name is required")
		case repository.ErrAddonCodeTaken:
			sendError(w, http.StatusConflict, "Addon code already exists")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to create addon")
		}
		return
	}

	sendJSON(w, http.StatusCreated, a)
}

// Update updates an addon
func (h *AddonHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Addon ID is required")
		return
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid addon ID")
		return
	}

	var req service.UpdateAddonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	a, err := h.addonService.Update(r.Context(), id, &req)
	if err != nil {
		if err == repository.ErrAddonNotFound {
			sendError(w, http.StatusNotFound, "Addon not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to update addon")
		return
	}

	sendJSON(w, http.StatusOK, a)
}

// Delete deletes an addon
func (h *AddonHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Addon ID is required")
		return
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid addon ID")
		return
	}

	if err := h.addonService.Delete(r.Context(), id); err != nil {
		if err == repository.ErrAddonNotFound {
			sendError(w, http.StatusNotFound, "Addon not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to delete addon")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Addon deleted"})
}

// AssignToTenant assigns an addon to a tenant
func (h *AddonHandler) AssignToTenant(w http.ResponseWriter, r *http.Request) {
	tenantIDStr := getPathParam(r, "tenant_id")
	if tenantIDStr == "" {
		sendError(w, http.StatusBadRequest, "Tenant ID is required")
		return
	}

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	var req struct {
		AddonID   string `json:"addon_id"`
		ExpiresAt string `json:"expires_at,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	addonID, err := uuid.Parse(req.AddonID)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid addon ID")
		return
	}

	var expiresAt *time.Time
	if req.ExpiresAt != "" {
		t, err := time.Parse(time.RFC3339, req.ExpiresAt)
		if err != nil {
			sendError(w, http.StatusBadRequest, "Invalid expires_at format (use RFC3339)")
			return
		}
		expiresAt = &t
	}

	if err := h.addonService.AssignToTenant(r.Context(), tenantID, addonID, expiresAt); err != nil {
		switch err {
		case service.ErrAddonNotForPlan:
			sendError(w, http.StatusBadRequest, "Addon not available for tenant's plan")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to assign addon")
		}
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Addon assigned to tenant"})
}

// RemoveFromTenant removes an addon from a tenant
func (h *AddonHandler) RemoveFromTenant(w http.ResponseWriter, r *http.Request) {
	tenantIDStr := getPathParam(r, "tenant_id")
	if tenantIDStr == "" {
		sendError(w, http.StatusBadRequest, "Tenant ID is required")
		return
	}

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	addonIDStr := getPathParam(r, "addon_id")
	if addonIDStr == "" {
		sendError(w, http.StatusBadRequest, "Addon ID is required")
		return
	}

	addonID, err := uuid.Parse(addonIDStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid addon ID")
		return
	}

	if err := h.addonService.RemoveFromTenant(r.Context(), tenantID, addonID); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to remove addon")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Addon removed from tenant"})
}

// GetTenantAddons returns all addons for the current tenant
func (h *AddonHandler) GetTenantAddons(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	addons, err := h.addonService.GetTenantAddons(r.Context(), tenantID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to get tenant addons")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"addons": addons,
		"total":  len(addons),
	})
}

