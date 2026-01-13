package handler

import (
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/domain/wa_log"
	"rrnet/internal/repository"
)

type WALogHandler struct {
	repo *repository.WALogRepository
}

func NewWALogHandler(repo *repository.WALogRepository) *WALogHandler {
	return &WALogHandler{repo: repo}
}

func (h *WALogHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	q := r.URL.Query()
	limit := repository.ParseLimit(q.Get("limit"), 50, 200)

	var status *wa_log.Status
	if v := strings.TrimSpace(q.Get("status")); v != "" {
		s := wa_log.Status(v)
		status = &s
	}

	var source *wa_log.Source
	if v := strings.TrimSpace(q.Get("source")); v != "" {
		s := wa_log.Source(v)
		source = &s
	}

	var campaignID *uuid.UUID
	if v := strings.TrimSpace(q.Get("campaign_id")); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			sendError(w, http.StatusBadRequest, "Invalid campaign_id")
			return
		}
		campaignID = &id
	}

	cursor, err := repository.ParseWALogCursor(q.Get("cursor"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid cursor")
		return
	}

	items, next, err := h.repo.List(r.Context(), tenantID, &repository.WALogListFilter{
		Search:     q.Get("search"),
		Status:     status,
		Source:     source,
		CampaignID: campaignID,
		Limit:      limit,
		Cursor:     cursor,
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to list wa logs")
		sendError(w, http.StatusInternalServerError, "Failed to list logs")
		return
	}

	var nextCursor *string
	if next != nil {
		s := next.String()
		nextCursor = &s
	}
	sendJSON(w, http.StatusOK, map[string]any{
		"data":        items,
		"next_cursor": nextCursor,
	})
}


