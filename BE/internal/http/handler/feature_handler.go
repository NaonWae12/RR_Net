package handler

import (
	"net/http"

	"rrnet/internal/config"
)

// FeatureHandler handles feature-related HTTP requests
type FeatureHandler struct{}

// NewFeatureHandler creates a new feature handler
func NewFeatureHandler() *FeatureHandler {
	return &FeatureHandler{}
}

// List returns all available features from the catalog
func (h *FeatureHandler) List(w http.ResponseWriter, r *http.Request) {
	features := config.GetFeatureCatalog()

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"features": features,
	})
}

