package wa_gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func NewClient(baseURL, adminToken string) *Client {
	baseURL = strings.TrimRight(baseURL, "/")
	return &Client{
		baseURL: baseURL,
		token:   adminToken,
		http: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c *Client) doJSON(ctx context.Context, method, path string, reqBody any, out any) error {
	var body *bytes.Reader
	if reqBody != nil {
		b, err := json.Marshal(reqBody)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	} else {
		body = bytes.NewReader(nil)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if c.token != "" {
		req.Header.Set("X-WA-Admin-Token", c.token)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var e struct {
			Error  string `json:"error"`
			Status string `json:"status"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&e)
		if e.Error != "" {
			return fmt.Errorf("wa-gateway %s %s failed: %s (status=%s)", method, path, e.Error, e.Status)
		}
		return fmt.Errorf("wa-gateway %s %s failed: HTTP %d", method, path, resp.StatusCode)
	}

	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

type ConnectResponse struct {
	TenantID    string  `json:"tenant_id"`
	Status      string  `json:"status"`
	QR          *string `json:"qr"`
	QRUpdatedAt *string `json:"qr_updated_at"`
}

type StatusResponse struct {
	TenantID string `json:"tenant_id"`
	Status   string `json:"status"`
}

type QRResponse struct {
	TenantID    string  `json:"tenant_id"`
	Status      string  `json:"status"`
	QR          *string `json:"qr"`
	QRUpdatedAt *string `json:"qr_updated_at"`
}

type SendResponse struct {
	OK        bool    `json:"ok"`
	MessageID *string `json:"message_id"`
}

type BulkResult struct {
	To        string  `json:"to"`
	OK        bool    `json:"ok"`
	MessageID *string `json:"message_id,omitempty"`
	Error     *string `json:"error,omitempty"`
}

type BulkResponse struct {
	OK     bool         `json:"ok"`
	Total  int          `json:"total"`
	Results []BulkResult `json:"results"`
}

func (c *Client) Connect(ctx context.Context, tenantID string) (*ConnectResponse, error) {
	var out ConnectResponse
	if err := c.doJSON(ctx, http.MethodPost, "/v1/tenants/"+tenantID+"/connect", map[string]any{}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) Status(ctx context.Context, tenantID string) (*StatusResponse, error) {
	var out StatusResponse
	if err := c.doJSON(ctx, http.MethodGet, "/v1/tenants/"+tenantID+"/status", nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) QR(ctx context.Context, tenantID string) (*QRResponse, error) {
	var out QRResponse
	if err := c.doJSON(ctx, http.MethodGet, "/v1/tenants/"+tenantID+"/qr", nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) Send(ctx context.Context, tenantID, to, text string) (*SendResponse, error) {
	var out SendResponse
	payload := map[string]any{"to": to, "text": text}
	if err := c.doJSON(ctx, http.MethodPost, "/v1/tenants/"+tenantID+"/send", payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) SendBulk(ctx context.Context, tenantID string, to []string, text string) (*BulkResponse, error) {
	var out BulkResponse
	payload := map[string]any{"to": to, "text": text}
	if err := c.doJSON(ctx, http.MethodPost, "/v1/tenants/"+tenantID+"/send-bulk", payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}


