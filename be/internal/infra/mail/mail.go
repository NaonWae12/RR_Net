package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"
)

// MailProvider defines the interface for sending emails
type MailProvider interface {
	Send(ctx context.Context, to []string, subject, body string) error
}

// ResendProvider implements MailProvider using Resend API
type ResendProvider struct {
	apiKey    string
	fromEmail string
	client    *http.Client
}

// NewResendProvider creates a new ResendProvider
func NewResendProvider(apiKey, fromEmail string) *ResendProvider {
	return &ResendProvider{
		apiKey:    apiKey,
		fromEmail: fromEmail,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

func (p *ResendProvider) Send(ctx context.Context, to []string, subject, body string) error {
	if p.apiKey == "" {
		log.Warn().Msg("Resend API Key is empty, skipping email send")
		return nil
	}

	reqBody := resendRequest{
		From:    p.fromEmail,
		To:      to,
		Subject: subject,
		HTML:    body,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal resend request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.resend.com/emails", bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create resend request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send email via resend: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		var errResp map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errResp)
		log.Error().Interface("error", errResp).Msg("Resend API returned error")
		return fmt.Errorf("resend API error: status %d", resp.StatusCode)
	}

	log.Info().Str("subject", subject).Interface("to", to).Msg("Email sent successfully via Resend")
	return nil
}
