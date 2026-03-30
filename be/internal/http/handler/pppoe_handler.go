package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/http/middleware"
	"rrnet/internal/service"
)

type PPPoEHandler struct {
	pppoeService *service.PPPoEService
}

func NewPPPoEHandler(pppoeService *service.PPPoEService) *PPPoEHandler {
	return &PPPoEHandler{pppoeService: pppoeService}
}

func (h *PPPoEHandler) CreatePPPoESecret(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var req service.CreatePPPoESecretRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Username == "" {
		sendError(w, http.StatusBadRequest, "username is required")
		return
	}
	if req.Password == "" {
		sendError(w, http.StatusBadRequest, "password is required")
		return
	}
	if req.ClientID == uuid.Nil {
		sendError(w, http.StatusBadRequest, "client_id is required")
		return
	}
	if req.RouterID == uuid.Nil {
		sendError(w, http.StatusBadRequest, "router_id is required")
		return
	}
	if req.ProfileID == uuid.Nil {
		sendError(w, http.StatusBadRequest, "profile_id is required")
		return
	}

	secret, err := h.pppoeService.CreatePPPoESecret(r.Context(), tenantID, req)
	if err != nil {
		// Check for specific error types and return appropriate status codes
		switch errMsg := err.Error(); errMsg {
		case "username already exists":
			sendError(w, http.StatusConflict, errMsg)
		case "router not found", "profile not found", "client not found":
			sendError(w, http.StatusNotFound, errMsg)
		default:
			sendError(w, http.StatusInternalServerError, "Failed to create PPPoE secret")
		}
		return
	}

	// Use sendJSON helper for consistent response format
	sendJSON(w, http.StatusCreated, secret)
}

func (h *PPPoEHandler) ListPPPoESecrets(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	var routerID *uuid.UUID
	if routerIDStr := r.URL.Query().Get("router_id"); routerIDStr != "" {
		if id, err := uuid.Parse(routerIDStr); err == nil {
			routerID = &id
		}
	}

	var clientID *uuid.UUID
	if clientIDStr := r.URL.Query().Get("client_id"); clientIDStr != "" {
		if id, err := uuid.Parse(clientIDStr); err == nil {
			clientID = &id
		}
	}

	var disabled *bool
	if disabledStr := r.URL.Query().Get("disabled"); disabledStr != "" {
		val := disabledStr == "true"
		disabled = &val
	}

	secrets, total, err := h.pppoeService.ListPPPoESecrets(r.Context(), tenantID, routerID, clientID, disabled, limit, offset)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to list PPPoE secrets")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data":   secrets,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *PPPoEHandler) GetPPPoESecret(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid PPPoE secret ID")
		return
	}

	secret, err := h.pppoeService.GetPPPoESecret(r.Context(), tenantID, id)
	if err != nil {
		sendError(w, http.StatusNotFound, "PPPoE secret not found")
		return
	}

	sendJSON(w, http.StatusOK, secret)
}

func (h *PPPoEHandler) UpdatePPPoESecret(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid PPPoE secret ID")
		return
	}

	var req service.UpdatePPPoESecretRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	secret, err := h.pppoeService.UpdatePPPoESecret(r.Context(), tenantID, id, req)
	if err != nil {
		switch errMsg := err.Error(); errMsg {
		case "PPPoE secret not found":
			sendError(w, http.StatusNotFound, errMsg)
		case "username already exists":
			sendError(w, http.StatusConflict, errMsg)
		default:
			sendError(w, http.StatusInternalServerError, "Failed to update PPPoE secret")
		}
		return
	}

	sendJSON(w, http.StatusOK, secret)
}

func (h *PPPoEHandler) DeletePPPoESecret(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid PPPoE secret ID")
		return
	}

	if err := h.pppoeService.DeletePPPoESecret(r.Context(), tenantID, id); err != nil {
		switch errMsg := err.Error(); errMsg {
		case "PPPoE secret not found":
			sendError(w, http.StatusNotFound, errMsg)
		default:
			sendError(w, http.StatusInternalServerError, "Failed to delete PPPoE secret")
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PPPoEHandler) ToggleStatus(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid PPPoE secret ID")
		return
	}

	secret, err := h.pppoeService.ToggleStatus(r.Context(), tenantID, id)
	if err != nil {
		switch errMsg := err.Error(); errMsg {
		case "PPPoE secret not found":
			sendError(w, http.StatusNotFound, errMsg)
		default:
			sendError(w, http.StatusInternalServerError, "Failed to toggle status")
		}
		return
	}

	sendJSON(w, http.StatusOK, secret)
}

func (h *PPPoEHandler) SyncToRouter(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid PPPoE secret ID")
		return
	}

	log.Info().
		Str("request_id", middleware.GetRequestID(r.Context())).
		Str("tenant_id", tenantID.String()).
		Str("secret_id", id.String()).
		Msg("PPPoE: Syncing secret to router")

	if err := h.pppoeService.SyncToRouter(r.Context(), tenantID, id); err != nil {
		errMsg := err.Error()

		// Log error with details
		log.Error().
			Str("request_id", middleware.GetRequestID(r.Context())).
			Str("tenant_id", tenantID.String()).
			Str("secret_id", id.String()).
			Err(err).
			Msg("PPPoE: Failed to sync secret to router")

		// Check for specific error types
		switch {
		case strings.Contains(errMsg, "PPPoE secret not found") ||
			strings.Contains(errMsg, "router not found") ||
			strings.Contains(errMsg, "profile not found"):
			sendError(w, http.StatusNotFound, errMsg)
		case strings.Contains(errMsg, "connection timeout") ||
			strings.Contains(errMsg, "unable to reach") ||
			strings.Contains(errMsg, "connection refused") ||
			strings.Contains(errMsg, "no route to host") ||
			strings.Contains(errMsg, "network is unreachable"):
			// Router connection errors - return 503 Service Unavailable
			sendError(w, http.StatusServiceUnavailable, "Router is unreachable. Please check router connection and network.")
		case strings.Contains(errMsg, "failed to connect") ||
			strings.Contains(errMsg, "failed to connect/login"):
			// Connection/auth errors - return 502 Bad Gateway
			sendError(w, http.StatusBadGateway, "Failed to connect to router. Please check router credentials and connectivity.")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to sync to router: "+errMsg)
		}
		return
	}

	log.Info().
		Str("request_id", middleware.GetRequestID(r.Context())).
		Str("tenant_id", tenantID.String()).
		Str("secret_id", id.String()).
		Msg("PPPoE: Secret synced to router successfully")

	w.WriteHeader(http.StatusNoContent)
}

func (h *PPPoEHandler) ListActiveConnections(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	routerIDStr := r.URL.Query().Get("router_id")
	if routerIDStr == "" {
		sendError(w, http.StatusBadRequest, "router_id is required")
		return
	}

	routerID, err := uuid.Parse(routerIDStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid router_id")
		return
	}

	connections, err := h.pppoeService.ListActiveConnections(r.Context(), tenantID, routerID)
	if err != nil {
		switch errMsg := err.Error(); errMsg {
		case "router not found":
			sendError(w, http.StatusNotFound, errMsg)
		default:
			sendError(w, http.StatusInternalServerError, "Failed to list active connections")
		}
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data": connections,
	})
}

func (h *PPPoEHandler) DisconnectSession(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	routerIDStr := r.URL.Query().Get("router_id")
	if routerIDStr == "" {
		sendError(w, http.StatusBadRequest, "router_id is required")
		return
	}

	routerID, err := uuid.Parse(routerIDStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid router_id")
		return
	}

	sessionID := getParam(r, "session_id")
	if sessionID == "" {
		sendError(w, http.StatusBadRequest, "session_id is required")
		return
	}

	if err := h.pppoeService.DisconnectSession(r.Context(), tenantID, routerID, sessionID); err != nil {
		switch errMsg := err.Error(); errMsg {
		case "router not found":
			sendError(w, http.StatusNotFound, errMsg)
		default:
			sendError(w, http.StatusInternalServerError, "Failed to disconnect session")
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
