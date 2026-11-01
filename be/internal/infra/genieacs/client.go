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
	"sync"
	"time"

	"github.com/google/uuid"
)

// Client handles communication with GenieACS Northbound Interface (NBI REST API).
type Client struct {
	baseURL    string
	httpClient *http.Client

	// In-memory cache for ListRawDevices to avoid hammering GenieACS on every dashboard refresh.
	cacheMu       sync.Mutex
	cachedDevices []map[string]interface{}
	cachedAt      time.Time
	cacheTTL      time.Duration
}

// WiFiSSID represents an individual SSID configuration on the device.
type WiFiSSID struct {
	Index   int    `json:"index"`
	SSID    string `json:"ssid"`
	Enabled bool   `json:"enabled"`
	BSSID   string `json:"bssid,omitempty"`
}

// ConnectedHost represents a client device connected to the ONT (LAN/WLAN).
type ConnectedHost struct {
	HostName   string `json:"hostname"`
	IPAddress  string `json:"ip_address"`
	MACAddress string `json:"mac_address"`
	Active     bool   `json:"active"`
}

// DeviceSummary represents common device attributes extracted from GenieACS.
type DeviceSummary struct {
	ID              string          `json:"id"`
	SerialNumber    string          `json:"serial_number"`
	ProductClass    string          `json:"product_class"`
	Manufacturer    string          `json:"manufacturer"`
	OUI             string          `json:"oui"`
	SoftwareVersion string          `json:"software_version"`
	HardwareVersion string          `json:"hardware_version"`
	IPAddress       string          `json:"ip_address"`
	MACAddress      string          `json:"mac_address"`
	Status          string          `json:"status"` // online, offline
	LastInform      time.Time       `json:"last_inform"`
	RxPowerDBm         *float64        `json:"rx_power_dbm,omitempty"`
	TxPowerDBm         *float64        `json:"tx_power_dbm,omitempty"`
	TemperatureCelsius *float64        `json:"temperature_celsius,omitempty"`
	VoltageVolts       *float64        `json:"voltage_volts,omitempty"`
	SSID               string          `json:"ssid,omitempty"`
	WiFiEnabled     bool            `json:"wifi_enabled"`
	SSIDList        []WiFiSSID      `json:"ssid_list,omitempty"`
	ConnectedHosts  []ConnectedHost `json:"connected_hosts,omitempty"`
	UptimeSeconds   int64           `json:"uptime_seconds"`
	Label           string          `json:"label,omitempty"`
	ClientID        *uuid.UUID      `json:"client_id,omitempty"`
	ClientName      string          `json:"client_name,omitempty"`
	WiFiPassword    string          `json:"wifi_password,omitempty"`
	WiFiUpdatedAt   *time.Time      `json:"wifi_updated_at,omitempty"`
	OnlineAt        *time.Time      `json:"online_at,omitempty"`
	OfflineAt       *time.Time      `json:"offline_at,omitempty"`
	InformInterval  int             `json:"inform_interval,omitempty"`
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
			Transport: &http.Transport{
				MaxIdleConns:        20,
				MaxConnsPerHost:     10,
				IdleConnTimeout:     30 * time.Second,
				ResponseHeaderTimeout: 8 * time.Second,
			},
		},
		cacheTTL: 10 * time.Second,
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
// Uses an in-memory cache (default 10s TTL) for unfiltered queries to avoid
// hammering GenieACS when multiple tenants refresh dashboards simultaneously.
func (c *Client) ListRawDevices(ctx context.Context, queryJSON string) ([]map[string]interface{}, error) {
	// Only cache unfiltered (full list) queries
	if queryJSON == "" {
		c.cacheMu.Lock()
		if c.cachedDevices != nil && time.Since(c.cachedAt) < c.cacheTTL {
			result := c.cachedDevices
			c.cacheMu.Unlock()
			return result, nil
		}
		c.cacheMu.Unlock()
	}

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

	// Cache unfiltered results
	if queryJSON == "" {
		c.cacheMu.Lock()
		c.cachedDevices = devices
		c.cachedAt = time.Now()
		c.cacheMu.Unlock()
	}

	return devices, nil
}

// InvalidateCache clears the cached device list, forcing the next ListRawDevices call
// to fetch fresh data from GenieACS. Call after mutations (reboot, setWifi, etc).
func (c *Client) InvalidateCache() {
	c.cacheMu.Lock()
	c.cachedDevices = nil
	c.cachedAt = time.Time{}
	c.cacheMu.Unlock()
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
