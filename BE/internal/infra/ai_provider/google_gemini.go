package ai_provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"rrnet/internal/domain/ai"

	"github.com/rs/zerolog/log"
)

type GoogleGeminiProvider struct {
	httpClient *http.Client
}

func NewGoogleGeminiProvider() *GoogleGeminiProvider {
	return &GoogleGeminiProvider{
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// ExtractStructuredData calls Gemini API to extract data from image or text
func (p *GoogleGeminiProvider) ExtractStructuredData(ctx context.Context, model string, apiKey string, prompt string, base64Image *string, fileData []byte) (*ai.ExtractionResult, error) {
	// Use v1beta for better feature support
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey)

	var parts []map[string]interface{}
	parts = append(parts, map[string]interface{}{
		"text": prompt,
	})

	if base64Image != nil && *base64Image != "" {
		parts = append(parts, map[string]interface{}{
			"inline_data": map[string]interface{}{
				"mime_type": "image/jpeg",
				"data":      *base64Image,
			},
		})
	}

	reqBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"parts": parts,
			},
		},
		"generation_config": map[string]interface{}{
			"response_mime_type": "application/json",
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	log.Info().Str("model", model).Msg("Calling Gemini API")
	resp, err := p.httpClient.Do(req)
	if err != nil {
		log.Error().Err(err).Msg("Gemini API request failed")
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errData)
		log.Error().Int("status", resp.StatusCode).Interface("detail", errData).Msg("Gemini API error response")

		// If 400 with "response_mime_type" error, retry without it as a fallback
		if resp.StatusCode == http.StatusBadRequest {
			log.Warn().Msg("Retrying without response_mime_type...")
			delete(reqBody, "generation_config")
			jsonBody, _ = json.Marshal(reqBody)
			req, _ = http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")
			resp2, err := p.httpClient.Do(req)
			if err == nil && resp2.StatusCode == http.StatusOK {
				defer resp2.Body.Close()
				resp = resp2 // Use the successful response
			} else {
				if err == nil {
					resp2.Body.Close()
				}
				return nil, fmt.Errorf("gemini api error: status %d", resp.StatusCode)
			}
		} else {
			return nil, fmt.Errorf("gemini api error: status %d", resp.StatusCode)
		}
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
		log.Error().Err(err).Msg("Failed to decode Gemini response")
		return nil, err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("gemini returned no content")
	}

	responseText := geminiResp.Candidates[0].Content.Parts[0].Text
	log.Info().Str("response", responseText).Msg("Gemini raw response")

	var extraction ai.ExtractionResult
	if err := json.Unmarshal([]byte(responseText), &extraction); err != nil {
		// Fallback: Gemini might return just the raw data array
		var rawData interface{}
		if err := json.Unmarshal([]byte(responseText), &rawData); err == nil {
			return &ai.ExtractionResult{
				Data:       rawData,
				Confidence: 1.0,
			}, nil
		}
		log.Error().Err(err).Str("raw", responseText).Msg("Failed to parse Gemini JSON")
		return nil, fmt.Errorf("failed to parse AI response: %v", err)
	}

	return &extraction, nil
}

// ValidateAPIKey checks if the API key is valid by making a simple request
func (p *GoogleGeminiProvider) ValidateAPIKey(ctx context.Context, apiKey string) (bool, error) {
	// Use v1beta/models to list models, which requires a valid key
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models?key=%s", apiKey)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false, err
	}

	log.Info().Msg("Validating Gemini API key")
	resp, err := p.httpClient.Do(req)
	if err != nil {
		log.Error().Err(err).Msg("Gemini validation request failed")
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Warn().Int("status", resp.StatusCode).Msg("Gemini API key validation failed")
	}

	return resp.StatusCode == http.StatusOK, nil
}
