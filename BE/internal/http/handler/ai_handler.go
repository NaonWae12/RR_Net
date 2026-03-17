package handler

import (
	"encoding/json"
	"net/http"

	"rrnet/internal/domain/ai"
	"rrnet/internal/service"

	"github.com/rs/zerolog/log"
)

type AIHandler struct {
	aiService *service.AIService
}

func NewAIHandler(aiService *service.AIService) *AIHandler {
	return &AIHandler{aiService: aiService}
}

func (h *AIHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	config, err := h.aiService.GetConfig(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Mask API key before sending to frontend
	if config.APIKey != "" {
		if len(config.APIKey) > 8 {
			config.APIKey = config.APIKey[:4] + "********" + config.APIKey[len(config.APIKey)-4:]
		} else {
			config.APIKey = "****"
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

func (h *AIHandler) SaveConfig(w http.ResponseWriter, r *http.Request) {
	var config ai.AIConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		log.Error().Err(err).Msg("Failed to decode AI config request")
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Info().Msg("Saving global AI config")
	if err := h.aiService.SaveConfig(r.Context(), config); err != nil {
		log.Error().Err(err).Msg("Failed to save global AI config")
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}
