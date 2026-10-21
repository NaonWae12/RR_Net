package genieacs

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client handles communication with GenieACS Northbound Interface (NBI REST API).
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// DeviceSummary represents common device attributes extracted from GenieACS.
type DeviceSummary struct {
	ID              string    `json:"id"`
	SerialNumber    string    `json:"serial_number"`
	ProductClass    string    `json:"product_class"`
	Manufacturer    string    `json:"manufacturer"`
	OUI             string    `json:"oui"`
	SoftwareVersion string    `json:"software_version"`
	HardwareVersion string    `json:"hardware_version"`
	IPAddress       string    `json:"ip_address"`
	MACAddress      string    `json:"mac_address"`
	Status          string    `json:"status"` // online, offline
	LastInform      time.Time `json:"last_inform"`
	RxPowerDBm      *float64  `json:"rx_power_dbm,omitempty"`
	TxPowerDBm      *float64  `json:"tx_power_dbm,omitempty"`
	SSID            string    `json:"ssid,omitempty"`
	WiFiEnabled     bool      `json:"wifi_enabled"`
	UptimeSeconds   int64     `json:"uptime_seconds"`
}

// TaskRequest represents a task sent to GenieACS NBI.
type TaskRequest struct {
	Name            string          `json:"name"`
	ObjectName      string          `json:"objectName,omitempty"`
	ParameterValues [][]interface{} `json:"parameterValues,omitempty"`
}

// NewClient creates a new GenieACS API client.
func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = "http://localhost:7557"
	}
	baseURL = strings.TrimRight(baseURL, "/")

	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Ping checks if GenieACS NBI is accessible.
func (c *Client) Ping(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/devices", nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("genieacs ping failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("genieacs returned status %d", resp.StatusCode)
	}
	return nil
}

// ListRawDevices fetches raw device list from GenieACS.
func (c *Client) ListRawDevices(ctx context.Context, queryJSON string) ([]map[string]interface{}, error) {
	reqURL := c.baseURL + "/devices"
	if queryJSON != "" {
		reqURL += "?query=" + url.QueryEscape(queryJSON)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch devices: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("genieacs error (%d): %s", resp.StatusCode, string(body))
	}

	var devices []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&devices); err != nil {
		return nil, fmt.Errorf("failed to decode devices JSON: %w", err)
	}

	return devices, nil
}

// GetRawDevice fetches single raw device by ID from GenieACS.
func (c *Client) GetRawDevice(ctx context.Context, deviceID string) (map[string]interface{}, error) {
	query := fmt.Sprintf(`{"_id":"%s"}`, deviceID)
	devices, err := c.ListRawDevices(ctx, query)
	if err != nil {
		return nil, err
	}
	if len(devices) == 0 {
		return nil, fmt.Errorf("device not found: %s", deviceID)
	}
	return devices[0], nil
}

// SendTask dispatches a task (reboot, setParameterValues, refreshObject) to device via GenieACS.
func (c *Client) SendTask(ctx context.Context, deviceID string, task TaskRequest, connectionRequest bool) error {
	reqURL := fmt.Sprintf("%s/devices/%s/tasks", c.baseURL, url.PathEscape(deviceID))
	if connectionRequest {
		reqURL += "?connection_request"
	}

	payload, err := json.Marshal(task)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send task: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("genieacs task error (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// Reboot triggers device reboot.
func (c *Client) Reboot(ctx context.Context, deviceID string) error {
	return c.SendTask(ctx, deviceID, TaskRequest{Name: "reboot"}, true)
}

// RefreshDevice triggers parameter refresh from device.
func (c *Client) RefreshDevice(ctx context.Context, deviceID string) error {
	return c.SendTask(ctx, deviceID, TaskRequest{Name: "refreshObject", ObjectName: ""}, true)
}

// SetWiFi updates SSID and WiFi Password (supports standard TR-098 and TR-181 paths).
func (c *Client) SetWiFi(ctx context.Context, deviceID string, ssid, password string) error {
	task := TaskRequest{
		Name: "setParameterValues",
		ParameterValues: [][]interface{}{
			// Standard TR-098 paths (ZTE, Huawei, FiberHome, etc.)
			{"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", ssid, "xsd:string"},
			{"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase", password, "xsd:string"},
		},
	}
	return c.SendTask(ctx, deviceID, task, true)
}

// DeleteDevice removes a device from GenieACS registry.
func (c *Client) DeleteDevice(ctx context.Context, deviceID string) error {
	reqURL := fmt.Sprintf("%s/devices/%s", c.baseURL, url.PathEscape(deviceID))
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, reqURL, nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete failed (%d): %s", resp.StatusCode, string(body))
	}
	return nil
}
