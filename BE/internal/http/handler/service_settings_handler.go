package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/service"
)

type ServiceSettingsHandler struct {
	svc *service.ServiceSettingsService
}

func NewServiceSettingsHandler(svc *service.ServiceSettingsService) *ServiceSettingsHandler {
	return &ServiceSettingsHandler{svc: svc}
}

func (h *ServiceSettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}
	out, err := h.svc.Get(r.Context(), tenantID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to get service settings")
		return
	}
	sendJSON(w, http.StatusOK, out)
}

func (h *ServiceSettingsHandler) UpdateDiscount(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}
	var req service.ServiceDiscountSetting
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	out, err := h.svc.UpdateDiscount(r.Context(), tenantID, req)
	if err != nil {
		switch err {
		case service.ErrDiscountTypeInvalid, service.ErrDiscountValueInvalid:
			sendError(w, http.StatusBadRequest, err.Error())
		default:
			sendError(w, http.StatusInternalServerError, "Failed to update discount")
		}
		return
	}
	sendJSON(w, http.StatusOK, out)
}


