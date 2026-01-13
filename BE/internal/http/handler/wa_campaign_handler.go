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

type WACampaignHandler struct {
	svc *service.WACampaignService
}

func NewWACampaignHandler(svc *service.WACampaignService) *WACampaignHandler {
	return &WACampaignHandler{svc: svc}
}

func (h *WACampaignHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var req struct {
		Name    string `json:"name"`
		Message string `json:"message"`
		GroupID string `json:"group_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	groupID, err := uuid.Parse(strings.TrimSpace(req.GroupID))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid group_id")
		return
	}

	c, err := h.svc.CreateAndEnqueue(r.Context(), tenantID, req.Name, req.Message, groupID)
	if err != nil {
		switch err {
		case service.ErrWACampaignNameRequired:
			sendError(w, http.StatusBadRequest, "Name is required")
		case service.ErrWACampaignMessageRequired:
			sendError(w, http.StatusBadRequest, "Message is required")
		case service.ErrWACampaignGroupRequired:
			sendError(w, http.StatusBadRequest, "Client group is required")
		case service.ErrWACampaignNoRecipients:
			sendError(w, http.StatusBadRequest, "No recipients found in group (missing phone?)")
		default:
			log.Error().Err(err).Msg("Failed to create wa campaign")
			sendError(w, http.StatusInternalServerError, "Failed to create campaign")
		}
		return
	}

	sendJSON(w, http.StatusCreated, c)
}

func (h *WACampaignHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	items, err := h.svc.List(r.Context(), tenantID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list wa campaigns")
		sendError(w, http.StatusInternalServerError, "Failed to list campaigns")
		return
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{"data": items})
}

func (h *WACampaignHandler) Detail(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid campaign id")
		return
	}

	c, recs, err := h.svc.Detail(r.Context(), tenantID, id)
	if err != nil {
		if err == repository.ErrWACampaignNotFound {
			sendError(w, http.StatusNotFound, "Campaign not found")
			return
		}
		log.Error().Err(err).Msg("Failed to get wa campaign detail")
		sendError(w, http.StatusInternalServerError, "Failed to load campaign")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"campaign":   c,
		"recipients": recs,
	})
}

func (h *WACampaignHandler) RetryFailed(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid campaign id")
		return
	}

	n, err := h.svc.RetryFailed(r.Context(), tenantID, id)
	if err != nil {
		if err == repository.ErrWACampaignNotFound {
			sendError(w, http.StatusNotFound, "Campaign not found")
			return
		}
		log.Error().Err(err).Msg("Failed to retry wa campaign")
		sendError(w, http.StatusInternalServerError, "Failed to retry failed recipients")
		return
	}
	sendJSON(w, http.StatusOK, map[string]interface{}{
		"retried": n,
	})
}


