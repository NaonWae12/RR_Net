package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

type BillingTempoTemplateHandler struct {
	svc *service.BillingTempoTemplateService
}

func NewBillingTempoTemplateHandler(svc *service.BillingTempoTemplateService) *BillingTempoTemplateHandler {
	return &BillingTempoTemplateHandler{svc: svc}
}

func (h *BillingTempoTemplateHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	items, err := h.svc.List(r.Context(), tenantID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list tempo templates")
		sendError(w, http.StatusInternalServerError, "Failed to list tempo templates")
		return
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{"data": items})
}

func (h *BillingTempoTemplateHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var req service.CreateTempoTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	item, err := h.svc.Create(r.Context(), tenantID, &req)
	if err != nil {
		switch err {
		case service.ErrTempoTemplateNameRequired:
			sendError(w, http.StatusBadRequest, "Name is required")
		case service.ErrTempoTemplateDueDayInvalid:
			sendError(w, http.StatusBadRequest, "Due day must be between 1 and 31")
		case repository.ErrTempoTemplateNameTaken:
			sendError(w, http.StatusConflict, "Template name already exists")
		default:
			log.Error().Err(err).Msg("Failed to create tempo template")
			sendError(w, http.StatusInternalServerError, "Failed to create tempo template")
		}
		return
	}
	sendJSON(w, http.StatusCreated, item)
}

func (h *BillingTempoTemplateHandler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Template ID is required")
		return
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	var req service.UpdateTempoTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	item, err := h.svc.Update(r.Context(), tenantID, id, &req)
	if err != nil {
		switch err {
		case service.ErrTempoTemplateNameRequired:
			sendError(w, http.StatusBadRequest, "Name is required")
		case service.ErrTempoTemplateDueDayInvalid:
			sendError(w, http.StatusBadRequest, "Due day must be between 1 and 31")
		case repository.ErrTempoTemplateNameTaken:
			sendError(w, http.StatusConflict, "Template name already exists")
		case repository.ErrTempoTemplateNotFound:
			sendError(w, http.StatusNotFound, "Template not found")
		default:
			log.Error().Err(err).Msg("Failed to update tempo template")
			sendError(w, http.StatusInternalServerError, "Failed to update tempo template")
		}
		return
	}
	sendJSON(w, http.StatusOK, item)
}

func (h *BillingTempoTemplateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Template ID is required")
		return
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid template ID")
		return
	}

	if err := h.svc.Delete(r.Context(), tenantID, id); err != nil {
		if err == repository.ErrTempoTemplateNotFound {
			sendError(w, http.StatusNotFound, "Template not found")
			return
		}
		log.Error().Err(err).Msg("Failed to delete tempo template")
		sendError(w, http.StatusInternalServerError, "Failed to delete tempo template")
		return
	}
	sendJSON(w, http.StatusOK, map[string]bool{"ok": true})
}


