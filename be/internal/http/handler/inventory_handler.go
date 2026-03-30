package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"rrnet/internal/auth"
	"rrnet/internal/domain/inventory"
	"rrnet/internal/service"

	"github.com/google/uuid"
)

type InventoryHandler struct {
	service *service.InventoryService
}

func NewInventoryHandler(service *service.InventoryService) *InventoryHandler {
	return &InventoryHandler{service: service}
}

// --- Asset Routes ---

func (h *InventoryHandler) ListAssets(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	filter := &inventory.AssetFilter{
		Category: r.URL.Query().Get("category"),
		Search:   r.URL.Query().Get("search"),
	}
	filter.Page, _ = strconv.Atoi(r.URL.Query().Get("page"))
	filter.PageSize, _ = strconv.Atoi(r.URL.Query().Get("page_size"))

	assets, total, err := h.service.ListAssets(r.Context(), tenantID, filter)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  assets,
		"total": total,
	})
}

func (h *InventoryHandler) CreateAsset(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	claims, _ := auth.GetClaims(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		Asset            inventory.Asset             `json:"asset"`
		InitialStock     int                         `json:"initial_stock"`
		InitialCondition inventory.InstanceCondition `json:"initial_condition"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request"}`, http.StatusBadRequest)
		return
	}

	actor := "system"
	if claims != nil {
		actor = claims.Email
	}

	if err := h.service.CreateAsset(r.Context(), tenantID, &req.Asset, req.InitialStock, req.InitialCondition, actor); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req.Asset)
}

func (h *InventoryHandler) GetAsset(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(getPathParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	asset, err := h.service.GetAsset(r.Context(), tenantID, id)
	if err != nil {
		http.Error(w, `{"error":"Asset not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(asset)
}

func (h *InventoryHandler) DeleteAsset(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	claims, _ := auth.GetClaims(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(getPathParam(r, "id"))
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	actor := "system"
	if claims != nil {
		actor = claims.Email
	}

	if err := h.service.DeleteAsset(r.Context(), tenantID, id, actor); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// --- Instance Routes ---

func (h *InventoryHandler) ListInstances(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	assetID, err := uuid.Parse(getPathParam(r, "asset_id"))
	if err != nil {
		http.Error(w, `{"error":"Invalid Asset ID"}`, http.StatusBadRequest)
		return
	}

	instances, err := h.service.ListInstances(r.Context(), tenantID, assetID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"data": instances})
}

func (h *InventoryHandler) AddInstance(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	claims, _ := auth.GetClaims(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	assetID, err := uuid.Parse(getPathParam(r, "asset_id"))
	if err != nil {
		http.Error(w, `{"error":"Invalid Asset ID"}`, http.StatusBadRequest)
		return
	}

	var inst inventory.AssetInstance
	if err := json.NewDecoder(r.Body).Decode(&inst); err != nil {
		http.Error(w, `{"error":"Invalid request"}`, http.StatusBadRequest)
		return
	}
	inst.AssetID = assetID

	actor := "system"
	if claims != nil {
		actor = claims.Email
	}

	if err := h.service.AddInstance(r.Context(), tenantID, &inst, actor); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(inst)
}

func (h *InventoryHandler) UpdateInstance(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	claims, _ := auth.GetClaims(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	assetID, _ := uuid.Parse(getPathParam(r, "asset_id"))
	id, _ := uuid.Parse(getPathParam(r, "id"))

	var req inventory.AssetInstance
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request"}`, http.StatusBadRequest)
		return
	}

	actor := "system"
	if claims != nil {
		actor = claims.Email
	}

	if err := h.service.UpdateInstance(r.Context(), tenantID, assetID, id, &req, actor); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *InventoryHandler) BulkUpdate(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	claims, _ := auth.GetClaims(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	assetID, _ := uuid.Parse(getPathParam(r, "asset_id"))

	var req struct {
		Status inventory.InstanceStatus `json:"status"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	actor := "system"
	if claims != nil {
		actor = claims.Email
	}

	if err := h.service.BulkStatusUpdate(r.Context(), tenantID, assetID, req.Status, actor); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *InventoryHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var assetID, instanceID *uuid.UUID

	if id := r.URL.Query().Get("asset_id"); id != "" {
		parsed, _ := uuid.Parse(id)
		assetID = &parsed
	}
	if id := r.URL.Query().Get("instance_id"); id != "" {
		parsed, _ := uuid.Parse(id)
		instanceID = &parsed
	}

	logs, err := h.service.GetHistory(r.Context(), tenantID, assetID, instanceID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"data": logs})
}

func (h *InventoryHandler) GetGlobalSummary(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		return
	}

	summary, err := h.service.GetGlobalSummary(r.Context(), tenantID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func (h *InventoryHandler) GetPublicInstanceDetail(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, `{"error":"Invalid ID"}`, http.StatusBadRequest)
		return
	}

	instance, err := h.service.GetInstanceDetail(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error":"Instance not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(instance)
}
