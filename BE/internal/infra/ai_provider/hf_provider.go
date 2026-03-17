package ai_provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"rrnet/internal/domain/ai"

	"github.com/rs/zerolog/log"
)

const (
	hfBaseURL = "https://router.huggingface.co/v1/chat/completions"
	hfModel   = "Qwen/Qwen3.5-35B-A3B:novita"
)

// HuggingFaceProvider implements ai.AIProvider using HuggingFace Router (OpenAI-compatible)
type HuggingFaceProvider struct {
	httpClient *http.Client
}

func NewHuggingFaceProvider() *HuggingFaceProvider {
	return &HuggingFaceProvider{
		httpClient: &http.Client{
			Timeout: 5 * time.Minute,
		},
	}
}

// ExtractStructuredData sends image directly to HuggingFace Vision model (no Tesseract needed)
func (p *HuggingFaceProvider) ExtractStructuredData(ctx context.Context, model string, apiKey string, prompt string, base64Image *string, fileData []byte) (*ai.ExtractionResult, error) {
	// Build content array
	content := []map[string]interface{}{
		{
			"type": "text",
			"text": prompt,
		},
	}

	// Attach image if provided
	if base64Image != nil && *base64Image != "" {
		content = append(content, map[string]interface{}{
			"type": "image_url",
			"image_url": map[string]string{
				"url": fmt.Sprintf("data:image/jpeg;base64,%s", *base64Image),
			},
		})
	}

	reqBody := map[string]interface{}{
		"model": hfModel,
		"messages": []map[string]interface{}{
			{
				"role":    "user",
				"content": content,
			},
		},
		"max_tokens": 2048,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", hfBaseURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	log.Info().Str("model", hfModel).Msg("Calling HuggingFace Vision API")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HuggingFace request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HuggingFace returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse OpenAI-compatible response
	var hfResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &hfResp); err != nil {
		return nil, fmt.Errorf("failed to parse HuggingFace response: %w", err)
	}
	if len(hfResp.Choices) == 0 {
		return nil, fmt.Errorf("empty response from HuggingFace")
	}

	rawContent := hfResp.Choices[0].Message.Content
	log.Info().Str("raw_response", rawContent).Msg("HuggingFace raw response")

	// Try to extract JSON from the response (model might wrap it in markdown)
	jsonStr := extractJSON(rawContent)

	var result interface{}
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		// Return raw string if JSON parsing fails
		log.Warn().Err(err).Str("jsonStr", jsonStr).Msg("Could not parse HuggingFace response as JSON")
		return &ai.ExtractionResult{
			Data:       jsonStr,
			Confidence: 0.5,
		}, nil
	}

	return &ai.ExtractionResult{
		Data:       result,
		Confidence: 0.95,
	}, nil
}

// ValidateAPIKey validates the HuggingFace token by calling the models endpoint
func (p *HuggingFaceProvider) ValidateAPIKey(ctx context.Context, apiKey string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://huggingface.co/api/whoami-v2", nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("failed to validate HuggingFace token: %w", err)
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}

// extractJSON tries to find a JSON block in a string (LLMs sometimes wrap JSON in ```json...```)
func extractJSON(s string) string {
	// Strip markdown code blocks if present
	for _, fence := range []string{"```json", "```JSON", "```"} {
		if start := indexOf(s, fence); start != -1 {
			s = s[start+len(fence):]
			if end := indexOf(s, "```"); end != -1 {
				s = s[:end]
			}
			return trimSpace(s)
		}
	}
	return trimSpace(s)
}

func indexOf(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func trimSpace(s string) string {
	start, end := 0, len(s)-1
	for start < len(s) && (s[start] == ' ' || s[start] == '\n' || s[start] == '\r' || s[start] == '\t') {
		start++
	}
	for end >= start && (s[end] == ' ' || s[end] == '\n' || s[end] == '\r' || s[end] == '\t') {
		end--
	}
	if start > end {
		return ""
	}
	return s[start : end+1]
}
