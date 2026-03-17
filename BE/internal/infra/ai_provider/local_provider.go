package ai_provider

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"rrnet/internal/domain/ai"

	"github.com/rs/zerolog/log"
)

type LocalAIProvider struct {
	httpClient *http.Client
	ollamaURL  string
}

func NewLocalAIProvider(ollamaURL string) *LocalAIProvider {
	if ollamaURL == "" {
		ollamaURL = "http://localhost:11434"
	}
	return &LocalAIProvider{
		httpClient: &http.Client{
			Timeout: 5 * time.Minute,
		},
		ollamaURL: ollamaURL,
	}
}

func (p *LocalAIProvider) ExtractStructuredData(ctx context.Context, model string, apiKey string, prompt string, base64Image *string, fileData []byte) (*ai.ExtractionResult, error) {
	if model == "" {
		model = "phi3" // default model
	}

	ollamaURL := p.ollamaURL
	if apiKey != "" {
		ollamaURL = apiKey
	}

	var rawText string
	var err error

	// Step 1: OCR with Tesseract
	if (base64Image != nil && *base64Image != "") || len(fileData) > 0 {
		rawText, err = p.runTesseract(base64Image, fileData)
		if err != nil {
			log.Error().Err(err).Msg("Tesseract OCR failed")
			return nil, fmt.Errorf("OCR failed: %w", err)
		}
	} else {
		// If no image, maybe the prompt is just text?
		// But usually this provider is for OCR + Structuring
		rawText = prompt
	}

	log.Info().Str("raw_text_len", fmt.Sprintf("%d", len(rawText))).Str("raw_text", rawText).Msg("OCR completed, calling Ollama")

	// Step 2: Structure with LLM (Ollama)
	structuredData, err := p.callOllama(ctx, ollamaURL, model, prompt, rawText)
	if err != nil {
		log.Error().Err(err).Msg("Ollama call failed")
		return nil, fmt.Errorf("LLM structuring failed: %w", err)
	}

	return &ai.ExtractionResult{
		Data:       structuredData,
		Confidence: 0.9, // OCR + Local LLM fallback confidence
	}, nil
}

func (p *LocalAIProvider) runTesseract(base64Image *string, fileData []byte) (string, error) {
	// Create temp file for image
	tmpDir := os.TempDir()
	inputPath := filepath.Join(tmpDir, fmt.Sprintf("ocr_input_%d.jpg", time.Now().UnixNano()))

	var data []byte
	var err error
	if base64Image != nil && *base64Image != "" {
		data, err = base64.StdEncoding.DecodeString(*base64Image)
		if err != nil {
			return "", err
		}
	} else {
		data = fileData
	}

	if err := os.WriteFile(inputPath, data, 0644); err != nil {
		return "", err
	}
	defer os.Remove(inputPath)

	// Run Tesseract
	// Usage: tesseract [image] [stdout]
	cmd := exec.Command("tesseract", inputPath, "stdout")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("tesseract error: %v (stderr: %s)", err, stderr.String())
	}

	return strings.TrimSpace(stdout.String()), nil
}

func (p *LocalAIProvider) callOllama(ctx context.Context, ollamaURL string, model string, userPrompt string, rawText string) (interface{}, error) {
	fullPrompt := fmt.Sprintf("%s\n\nRAW TEXT FROM SCAN:\n%s\n\nJSON OUTPUT:", userPrompt, rawText)

	reqBody := map[string]interface{}{
		"model":  model,
		"prompt": fullPrompt,
		"stream": false,
		"format": "json",
	}

	jsonBody, _ := json.Marshal(reqBody)
	url := fmt.Sprintf("%s/api/generate", ollamaURL)

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ollama returned status %d: %s", resp.StatusCode, string(body))
	}

	var ollamaResp struct {
		Response string `json:"response"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return nil, err
	}

	log.Info().Str("tinyllama_raw", ollamaResp.Response).Msg("TinyLlama raw response")

	var result interface{}
	if err := json.Unmarshal([]byte(ollamaResp.Response), &result); err != nil {
		// If not valid JSON, return as string
		return ollamaResp.Response, nil
	}

	return result, nil
}

func (p *LocalAIProvider) ValidateAPIKey(ctx context.Context, apiKey string) (bool, error) {
	ollamaURL := p.ollamaURL
	if apiKey != "" {
		ollamaURL = apiKey
	}

	// For local provider, we just check if Ollama is reachable
	url := fmt.Sprintf("%s/api/tags", ollamaURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return false, err
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return false, nil // Not reachable
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}
