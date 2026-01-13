package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

type WATemplateHandler struct {
	svc *service.WATemplateService
}

func NewWATemplateHandler(svc *service.WATemplateService) *WATemplateHandler {
	return &WATemplateHandler{svc: svc}
}

func (h *WATemplateHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	items, err := h.svc.List(r.Context(), tenantID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list wa templates")
		sendError(w, http.StatusInternalServerError, "Failed to list templates")
		return
	}
	sendJSON(w, http.StatusOK, map[string]any{"data": items})
}

func (h *WATemplateHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var req struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tpl, err := h.svc.Create(r.Context(), tenantID, req.Name, req.Content)
	if err != nil {
		switch err {
		case service.ErrWATemplateNameRequired:
			sendError(w, http.StatusBadRequest, "Name is required")
		case service.ErrWATemplateContentRequired:
			sendError(w, http.StatusBadRequest, "Content is required")
		case repository.ErrWATemplateNameTaken:
			sendError(w, http.StatusBadRequest, "Template name already exists")
		default:
			log.Error().Err(err).Msg("Failed to create wa template")
			sendError(w, http.StatusInternalServerError, "Failed to create template")
		}
		return
	}

	sendJSON(w, http.StatusCreated, tpl)
}

func (h *WATemplateHandler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := strings.TrimSpace(getPathParam(r, "id"))
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid template id")
		return
	}

	var req struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tpl, err := h.svc.Update(r.Context(), tenantID, id, req.Name, req.Content)
	if err != nil {
		switch err {
		case service.ErrWATemplateNameRequired:
			sendError(w, http.StatusBadRequest, "Name is required")
		case service.ErrWATemplateContentRequired:
			sendError(w, http.StatusBadRequest, "Content is required")
		case repository.ErrWATemplateNotFound:
			sendError(w, http.StatusNotFound, "Template not found")
		case repository.ErrWATemplateNameTaken:
			sendError(w, http.StatusBadRequest, "Template name already exists")
		default:
			log.Error().Err(err).Msg("Failed to update wa template")
			sendError(w, http.StatusInternalServerError, "Failed to update template")
		}
		return
	}

	sendJSON(w, http.StatusOK, tpl)
}

func (h *WATemplateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := strings.TrimSpace(getPathParam(r, "id"))
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid template id")
		return
	}

	if err := h.svc.Delete(r.Context(), tenantID, id); err != nil {
		if err == repository.ErrWATemplateNotFound {
			sendError(w, http.StatusNotFound, "Template not found")
			return
		}
		log.Error().Err(err).Msg("Failed to delete wa template")
		sendError(w, http.StatusInternalServerError, "Failed to delete template")
		return
	}

	sendJSON(w, http.StatusOK, map[string]any{"ok": true})
}


