package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"rrnet/internal/auth"
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
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	var req service.CreatePPPoESecretRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if req.Username == "" {
		http.Error(w, `{"error":"username is required"}`, http.StatusBadRequest)
		return
	}
	if req.Password == "" {
		http.Error(w, `{"error":"password is required"}`, http.StatusBadRequest)
		return
	}
	if req.ClientID == uuid.Nil {
		http.Error(w, `{"error":"client_id is required"}`, http.StatusBadRequest)
		return
	}
	if req.RouterID == uuid.Nil {
		http.Error(w, `{"error":"router_id is required"}`, http.StatusBadRequest)
		return
	}
	if req.ProfileID == uuid.Nil {
		http.Error(w, `{"error":"profile_id is required"}`, http.StatusBadRequest)
		return
	}

	secret, err := h.pppoeService.CreatePPPoESecret(r.Context(), tenantID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(secret)
}

func (h *PPPoEHandler) ListPPPoESecrets(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
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
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":   secrets,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (h *PPPoEHandler) GetPPPoESecret(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid PPPoE secret ID"}`, http.StatusBadRequest)
		return
	}

	secret, err := h.pppoeService.GetPPPoESecret(r.Context(), tenantID, id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(secret)
}

func (h *PPPoEHandler) UpdatePPPoESecret(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid PPPoE secret ID"}`, http.StatusBadRequest)
		return
	}

	var req service.UpdatePPPoESecretRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request body"}`, http.StatusBadRequest)
		return
	}

	secret, err := h.pppoeService.UpdatePPPoESecret(r.Context(), tenantID, id, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(secret)
}

func (h *PPPoEHandler) DeletePPPoESecret(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid PPPoE secret ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.pppoeService.DeletePPPoESecret(r.Context(), tenantID, id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PPPoEHandler) ToggleStatus(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid PPPoE secret ID"}`, http.StatusBadRequest)
		return
	}

	secret, err := h.pppoeService.ToggleStatus(r.Context(), tenantID, id)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(secret)
}

func (h *PPPoEHandler) SyncToRouter(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	idStr := getParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid PPPoE secret ID"}`, http.StatusBadRequest)
		return
	}

	if err := h.pppoeService.SyncToRouter(r.Context(), tenantID, id); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PPPoEHandler) ListActiveConnections(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	routerIDStr := r.URL.Query().Get("router_id")
	if routerIDStr == "" {
		http.Error(w, `{"error":"router_id is required"}`, http.StatusBadRequest)
		return
	}

	routerID, err := uuid.Parse(routerIDStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid router_id"}`, http.StatusBadRequest)
		return
	}

	connections, err := h.pppoeService.ListActiveConnections(r.Context(), tenantID, routerID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data": connections,
	})
}

func (h *PPPoEHandler) DisconnectSession(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	routerIDStr := r.URL.Query().Get("router_id")
	if routerIDStr == "" {
		http.Error(w, `{"error":"router_id is required"}`, http.StatusBadRequest)
		return
	}

	routerID, err := uuid.Parse(routerIDStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid router_id"}`, http.StatusBadRequest)
		return
	}

	sessionID := getParam(r, "session_id")
	if sessionID == "" {
		http.Error(w, `{"error":"session_id is required"}`, http.StatusBadRequest)
		return
	}

	if err := h.pppoeService.DisconnectSession(r.Context(), tenantID, routerID, sessionID); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
