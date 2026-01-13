package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/domain/client"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

// ClientHandler handles client-related HTTP requests
type ClientHandler struct {
	clientService *service.ClientService
}

// NewClientHandler creates a new client handler
func NewClientHandler(clientService *service.ClientService) *ClientHandler {
	return &ClientHandler{
		clientService: clientService,
	}
}

// List returns all clients for the current tenant
func (h *ClientHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	// Parse query params
	filter := &client.ClientListFilter{
		Search:   r.URL.Query().Get("search"),
		Page:     1,
		PageSize: 20,
	}

	if statusStr := r.URL.Query().Get("status"); statusStr != "" {
		status := client.Status(statusStr)
		filter.Status = &status
	}
	if catStr := r.URL.Query().Get("category"); catStr != "" {
		cat := client.Category(catStr)
		filter.Category = &cat
	}
	if pageStr := r.URL.Query().Get("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil {
			filter.Page = p
		}
	}
	if pageSizeStr := r.URL.Query().Get("page_size"); pageSizeStr != "" {
		if ps, err := strconv.Atoi(pageSizeStr); err == nil {
			filter.PageSize = ps
		}
	}

	clients, total, err := h.clientService.List(r.Context(), tenantID, filter)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list clients")
		sendError(w, http.StatusInternalServerError, "Failed to list clients")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"clients":   clients,
		"total":     total,
		"page":      filter.Page,
		"page_size": filter.PageSize,
	})
}

// Get returns a single client by ID
func (h *ClientHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Client ID is required")
		return
	}

	clientID, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid client ID")
		return
	}

	c, err := h.clientService.GetByID(r.Context(), tenantID, clientID)
	if err != nil {
		if err == repository.ErrClientNotFound {
			sendError(w, http.StatusNotFound, "Client not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to get client")
		return
	}

	sendJSON(w, http.StatusOK, c)
}

// Create creates a new client
func (h *ClientHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var req service.CreateClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	c, err := h.clientService.Create(r.Context(), tenantID, &req)
	if err != nil {
		switch err {
		case service.ErrClientCodeRequired:
			sendError(w, http.StatusBadRequest, "Client code is required")
		case service.ErrClientNameRequired:
			sendError(w, http.StatusBadRequest, "Client name is required")
		case service.ErrClientLimitExceeded:
			sendError(w, http.StatusForbidden, "Client limit exceeded for your plan")
		case repository.ErrClientCodeTaken:
			sendError(w, http.StatusConflict, "Client code already exists")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to create client")
		}
		return
	}

	sendJSON(w, http.StatusCreated, c)
}

// Update updates a client
func (h *ClientHandler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Client ID is required")
		return
	}

	clientID, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid client ID")
		return
	}

	var req service.UpdateClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	c, err := h.clientService.Update(r.Context(), tenantID, clientID, &req)
	if err != nil {
		if err == repository.ErrClientNotFound {
			sendError(w, http.StatusNotFound, "Client not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to update client")
		return
	}

	sendJSON(w, http.StatusOK, c)
}

// ChangeStatus changes client status
func (h *ClientHandler) ChangeStatus(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Client ID is required")
		return
	}

	clientID, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid client ID")
		return
	}

	var req service.ChangeStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	c, err := h.clientService.ChangeStatus(r.Context(), tenantID, clientID, &req)
	if err != nil {
		switch err {
		case repository.ErrClientNotFound:
			sendError(w, http.StatusNotFound, "Client not found")
		case service.ErrInvalidStatusChange:
			sendError(w, http.StatusBadRequest, "Invalid status transition")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to change status")
		}
		return
	}

	sendJSON(w, http.StatusOK, c)
}

// Delete soft deletes a client
func (h *ClientHandler) Delete(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	if idStr == "" {
		sendError(w, http.StatusBadRequest, "Client ID is required")
		return
	}

	clientID, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid client ID")
		return
	}

	if err := h.clientService.Delete(r.Context(), tenantID, clientID); err != nil {
		if err == repository.ErrClientNotFound {
			sendError(w, http.StatusNotFound, "Client not found")
			return
		}
		sendError(w, http.StatusInternalServerError, "Failed to delete client")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Client deleted"})
}

// GetStats returns client statistics
func (h *ClientHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	stats, err := h.clientService.GetStats(r.Context(), tenantID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to get stats")
		return
	}

	sendJSON(w, http.StatusOK, stats)
}


