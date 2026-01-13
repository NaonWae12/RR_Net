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

type ClientGroupHandler struct {
	svc *service.ClientGroupService
}

func NewClientGroupHandler(svc *service.ClientGroupService) *ClientGroupHandler {
	return &ClientGroupHandler{svc: svc}
}

func (h *ClientGroupHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	items, err := h.svc.List(r.Context(), tenantID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list client groups")
		sendError(w, http.StatusInternalServerError, "Failed to list client groups")
		return
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{"data": items})
}

func (h *ClientGroupHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var req service.CreateClientGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	item, err := h.svc.Create(r.Context(), tenantID, &req)
	if err != nil {
		switch err {
		case service.ErrClientGroupNameRequired:
			sendError(w, http.StatusBadRequest, "Name is required")
		case repository.ErrClientGroupNameTaken:
			sendError(w, http.StatusConflict, "Group name already exists")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to create client group")
		}
		return
	}
	sendJSON(w, http.StatusCreated, item)
}

func (h *ClientGroupHandler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Client group ID is required")
		return
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid client group ID")
		return
	}

	var req service.UpdateClientGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	item, err := h.svc.Update(r.Context(), tenantID, id, &req)
	if err != nil {
		switch err {
		case repository.ErrClientGroupNotFound:
			sendError(w, http.StatusNotFound, "Client group not found")
		case service.ErrClientGroupNameRequired:
			sendError(w, http.StatusBadRequest, "Name is required")
		case repository.ErrClientGroupNameTaken:
			sendError(w, http.StatusConflict, "Group name already exists")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to update client group")
		}
		return
	}
	sendJSON(w, http.StatusOK, item)
}

func (h *ClientGroupHandler) Delete(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Client group ID is required")
		return
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid client group ID")
		return
	}

	if err := h.svc.Delete(r.Context(), tenantID, id); err != nil {
		if err == repository.ErrClientGroupNotFound {
			sendError(w, http.StatusNotFound, "Client group not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to delete client group")
		return
	}
	sendJSON(w, http.StatusOK, map[string]bool{"ok": true})
}


