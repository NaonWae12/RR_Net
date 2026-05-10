package handler

import (
	"encoding/json"
	"net/http"
	"rrnet/internal/auth"
	"rrnet/internal/service"
)

type IntegrationHandler struct {
	tenantService *service.TenantService
}

func NewIntegrationHandler(tenantService *service.TenantService) *IntegrationHandler {
	return &IntegrationHandler{
		tenantService: tenantService,
	}
}

// GetMidtransConfig returns the Midtrans configuration for the tenant
func (h *IntegrationHandler) GetMidtransConfig(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	config, err := h.tenantService.GetMidtransConfig(r.Context(), tenantID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to get Midtrans configuration")
		return
	}

	sendJSON(w, http.StatusOK, config)
}

// UpdateMidtransConfig updates the Midtrans configuration for the tenant
func (h *IntegrationHandler) UpdateMidtransConfig(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var config service.MidtransConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if err := h.tenantService.UpdateMidtransConfig(r.Context(), tenantID, &config); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to update Midtrans configuration")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Midtrans configuration updated successfully"})
}
