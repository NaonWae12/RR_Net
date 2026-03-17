package ai

import (
	"context"
)

// Provider represents the type of AI provider
type Provider string

const (
	ProviderGoogle      Provider = "google"
	ProviderOpenAI      Provider = "openai"
	ProviderAnthropic   Provider = "anthropic"
	ProviderHuggingFace Provider = "huggingface"
)

// AIConfig represents the tenant's AI configuration
type AIConfig struct {
	Provider Provider `json:"provider"`
	APIKey   string   `json:"api_key"` // This should be encrypted in storage
	Model    string   `json:"model"`
	IsActive bool     `json:"is_active"`
}

// ExtractionResult represents the structured data extracted by AI
type ExtractionResult struct {
	Data       interface{} `json:"data"`
	Confidence float64     `json:"confidence"`
	Highlights []string    `json:"highlights"` // Fields that need review
}

// AIProvider is the interface for different AI model implementations
type AIProvider interface {
	ExtractStructuredData(ctx context.Context, model string, apiKey string, prompt string, base64Image *string, fileData []byte) (*ExtractionResult, error)
	ValidateAPIKey(ctx context.Context, apiKey string) (bool, error)
}
