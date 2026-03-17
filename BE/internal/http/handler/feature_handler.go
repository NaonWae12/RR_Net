package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/config"
	"rrnet/internal/domain/feature"
	"rrnet/internal/repository"
)

// FeatureHandler handles feature-related HTTP requests
type FeatureHandler struct {
	repo *repository.FeatureRepository
}

// NewFeatureHandler creates a new feature handler
func NewFeatureHandler(repo *repository.FeatureRepository) *FeatureHandler {
	return &FeatureHandler{repo: repo}
}

// List returns all available features from the catalog and database
func (h *FeatureHandler) List(w http.ResponseWriter, r *http.Request) {
	// 1. Get system features
	sysFeatures := config.GetFeatureCatalog()

	// 2. Get custom features from DB
	dbFeatures, err := h.repo.ListGlobalToggles(r.Context())
	if err != nil {
		// Log error but verify we can still return system features?
		// For now, fail gracefully or just return system features
		// But in production we might want to know DB is down.
		// Let's assume we return what we have or error.
		// Retaining system features behavior if DB fails might be safer, but let's just log and continue.
	}

	// 3. Merge: DB features override system features if code matches (allows customization)
	featureMap := make(map[string]interface{})

	// Add system features
	for _, f := range sysFeatures {
		featureMap[f.Code] = map[string]interface{}{
			"id":          nil, // System features don't have UUIDs unless overridden
			"code":        f.Code,
			"name":        f.Name,
			"description": f.Description,
			"category":    f.Category,
			"is_system":   true,
			"is_enabled":  true, // System features act as "definitions", enabled by presence in Plan
		}
	}

	// Add/Override with DB features
	for _, f := range dbFeatures {
		// Try to extract category from Description if possible, or default
		category := "Custom"
		description := ""
		if f.Description != nil {
			description = *f.Description
		}

		// Check if it's an override
		isSystem := false
		if _, exists := featureMap[f.Code]; exists {
			isSystem = true
			if cat, ok := featureMap[f.Code].(map[string]interface{})["category"].(string); ok {
				category = cat
			}
		}

		featureMap[f.Code] = map[string]interface{}{
			"id":          f.ID,
			"code":        f.Code,
			"name":        f.Name,
			"description": description,
			"category":    category, // We preserve system category if override, else Custom
			"is_system":   isSystem,
			"is_enabled":  f.IsEnabled,
			"created_at":  f.CreatedAt,
			"updated_at":  f.UpdatedAt,
		}
	}

	// Convert map to slice
	var features []interface{}
	for _, v := range featureMap {
		features = append(features, v)
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"features": features,
	})
}

// CreateRequest represents the payload for creating a feature
type CreateFeatureRequest struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"` // Not stored natively yet, maybe useful later
}

// Create adds a new custom feature
func (h *FeatureHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateFeatureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Code == "" || req.Name == "" {
		http.Error(w, "Code and Name are required", http.StatusBadRequest)
		return
	}

	// Check if exists in system catalog (optional: allow overriding?)
	// For now let's allow creating DB entries even if they match system codes (override)

	desc := req.Description
	toggle := &feature.Toggle{
		ID:          uuid.New(),
		Code:        req.Code,
		Name:        req.Name,
		Description: &desc,
		TenantID:    nil, // Global
		IsEnabled:   true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := h.repo.Create(r.Context(), toggle); err != nil {
		http.Error(w, "Failed to create feature: "+err.Error(), http.StatusInternalServerError)
		return
	}

	sendJSON(w, http.StatusCreated, toggle)
}

// UpdateFeatureRequest represents payload for update
type UpdateFeatureRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// Update updates an existing custom feature
func (h *FeatureHandler) Update(w http.ResponseWriter, r *http.Request) {
	// Helper to get ID
	idRaw := r.Context().Value("id")
	if idRaw == nil {
		http.Error(w, "Feature ID required", http.StatusBadRequest)
		return
	}
	id, err := uuid.Parse(idRaw.(string))
	if err != nil {
		http.Error(w, "Invalid Feature ID", http.StatusBadRequest)
		return
	}

	var req UpdateFeatureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get existing
	toggle, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, "Feature not found", http.StatusNotFound)
		return
	}

	// Update fields
	toggle.Name = req.Name
	desc := req.Description
	toggle.Description = &desc
	toggle.UpdatedAt = time.Now()

	if err := h.repo.Update(r.Context(), toggle); err != nil {
		http.Error(w, "Failed to update feature", http.StatusInternalServerError)
		return
	}

	sendJSON(w, http.StatusOK, toggle)
}

// Delete removes a custom feature
func (h *FeatureHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idRaw := r.Context().Value("id")
	if idRaw == nil {
		http.Error(w, "Feature ID required", http.StatusBadRequest)
		return
	}
	id, err := uuid.Parse(idRaw.(string))
	if err != nil {
		http.Error(w, "Invalid Feature ID", http.StatusBadRequest)
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		http.Error(w, "Failed to delete feature", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
