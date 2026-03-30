package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"rrnet/internal/auth"
	"rrnet/internal/service"

	"github.com/rs/zerolog/log"
)

type MigrationHandler struct {
	migrationService *service.MigrationService
}

func NewMigrationHandler(migrationService *service.MigrationService) *MigrationHandler {
	return &MigrationHandler{migrationService: migrationService}
}

func (h *MigrationHandler) ExtractFromImage(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, "Unauthorized: Tenant context missing", http.StatusForbidden)
		return
	}

	var req struct {
		Image  string `json:"image"`  // base64
		Prompt string `json:"prompt"` // Optional custom prompt override
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Use a longer timeout context for AI extraction (Ollama/LLM can take time on CPU)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	result, err := h.migrationService.ExtractClientDataFromImage(ctx, tenantID, req.Image, req.Prompt)
	if err != nil {
		log.Error().Err(err).Msg("Migration extraction failed")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *MigrationHandler) ProcessImport(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		http.Error(w, "Unauthorized: Tenant context missing", http.StatusForbidden)
		return
	}

	var req struct {
		Clients []map[string]interface{} `json:"clients"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.migrationService.ProcessBulkImport(r.Context(), tenantID, req.Clients); err != nil {
		log.Error().Err(err).Msg("Bulk migration processing failed")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusOK)
}
