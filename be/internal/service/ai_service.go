package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"rrnet/internal/domain/ai"
	"rrnet/internal/domain/site_setting"
	"rrnet/internal/infra/ai_provider"
	"rrnet/internal/repository"
	"rrnet/pkg/utils"

	"github.com/rs/zerolog/log"
)

type AIService struct {
	tenantRepo      *repository.TenantRepository
	siteSettingRepo repository.SiteSettingRepository
	providers       map[ai.Provider]ai.AIProvider
	encryptionKey   [32]byte
}

func NewAIService(tenantRepo *repository.TenantRepository, siteSettingRepo repository.SiteSettingRepository, jwtSecret string) *AIService {
	return &AIService{
		tenantRepo:      tenantRepo,
		siteSettingRepo: siteSettingRepo,
		providers: map[ai.Provider]ai.AIProvider{
			ai.ProviderGoogle:      ai_provider.NewGoogleGeminiProvider(),
			ai.ProviderHuggingFace: ai_provider.NewHuggingFaceProvider(),
		},
		encryptionKey: utils.DeriveKey32(jwtSecret),
	}
}

// GetConfig retrieves global AI configuration
func (s *AIService) GetConfig(ctx context.Context) (*ai.AIConfig, error) {
	setting, err := s.siteSettingRepo.GetByKey(ctx, "ai_config")
	if err != nil {
		// Return inactive config if not found
		return &ai.AIConfig{IsActive: false}, nil
	}

	var config ai.AIConfig
	if err := json.Unmarshal(setting.Value, &config); err != nil {
		log.Error().Err(err).Msg("Failed to unmarshal global AI config")
		return nil, err
	}

	// Decrypt API Key
	if config.APIKey != "" {
		decrypted, err := utils.DecryptStringAESGCM(s.encryptionKey, config.APIKey)
		if err == nil {
			config.APIKey = decrypted
		}
	}

	return &config, nil
}

// SaveConfig saves global AI configuration
func (s *AIService) SaveConfig(ctx context.Context, config ai.AIConfig) error {
	// Handle masked API Key from frontend
	if strings.HasPrefix(config.APIKey, "****") {
		currentConfig, err := s.GetConfig(ctx)
		if err == nil && currentConfig.APIKey != "" {
			config.APIKey = currentConfig.APIKey
		} else {
			return fmt.Errorf("invalid API key")
		}
	} else {
		// Validate NEW API Key before saving
		provider, ok := s.providers[config.Provider]
		if !ok {
			return fmt.Errorf("unsupported provider: %s", config.Provider)
		}

		valid, err := provider.ValidateAPIKey(ctx, config.APIKey)
		if err != nil || !valid {
			return fmt.Errorf("invalid API key for %s", config.Provider)
		}
	}

	// Encrypt API Key
	encrypted, err := utils.EncryptStringAESGCM(s.encryptionKey, config.APIKey)
	if err != nil {
		return err
	}
	config.APIKey = encrypted

	val, _ := json.Marshal(config)
	return s.siteSettingRepo.Upsert(ctx, &site_setting.SiteSetting{
		Key:         "ai_config",
		Value:       val,
		Description: "Global AI & Automation Configuration",
	})
}

// Extract calls the appropriate provider to extract data using global config
func (s *AIService) Extract(ctx context.Context, tenantID uuid.UUID, prompt string, base64Image *string, fileData []byte) (*ai.ExtractionResult, error) {
	config, err := s.GetConfig(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get global AI config")
		return nil, err
	}

	if !config.IsActive {
		return nil, fmt.Errorf("AI is not active globally")
	}

	if config.APIKey == "" {
		return nil, fmt.Errorf("AI API key is not configured globally for %s", config.Provider)
	}

	provider, ok := s.providers[config.Provider]
	if !ok {
		return nil, fmt.Errorf("unsupported provider: %s", config.Provider)
	}

	return provider.ExtractStructuredData(ctx, config.Model, config.APIKey, prompt, base64Image, fileData)
}
