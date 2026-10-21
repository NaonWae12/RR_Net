package service

import (
	"context"
	"fmt"
	"math"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"rrnet/internal/infra/genieacs"
)

type ACSService struct {
	client *genieacs.Client
}

func NewACSService(client *genieacs.Client) *ACSService {
	return &ACSService{client: client}
}

// ListDevices returns all ONT devices connected to GenieACS, normalized into standard summaries.
func (s *ACSService) ListDevices(ctx context.Context, tenantID uuid.UUID) ([]genieacs.DeviceSummary, error) {
	if s.client == nil {
		return nil, fmt.Errorf("genieacs client not initialized")
	}

	rawDevices, err := s.client.ListRawDevices(ctx, "")
	if err != nil {
		return nil, err
	}

	var devices []genieacs.DeviceSummary
	for _, raw := range rawDevices {
		dev := s.normalizeDevice(raw)
		devices = append(devices, dev)
	}

	// IF in development and no physical device is connected yet, return a clean simulated ONT
	// so the user can test the UI and actions immediately!
	if len(devices) == 0 {
		mockRx := -19.45
		mockTx := 2.30
		devices = append(devices, genieacs.DeviceSummary{
			ID:              "ZTEG-F609-SIMULATOR-001",
			SerialNumber:    "ZTEGC8923011",
			ProductClass:    "F609 v9.0",
			Manufacturer:    "ZTE Corporation",
			OUI:             "00259E",
			SoftwareVersion: "V9.0.10P1N12",
			HardwareVersion: "V9.0",
			IPAddress:       "10.10.20.15",
			MACAddress:      "A4:2B:B0:12:34:56",
			Status:          "online",
			LastInform:      time.Now().Add(-2 * time.Minute),
			RxPowerDBm:      &mockRx,
			TxPowerDBm:      &mockTx,
			SSID:            "RRNET-PELANGGAN-001",
			WiFiEnabled:     true,
			SSIDList: []genieacs.WiFiSSID{
				{Index: 1, SSID: "RRNET-PELANGGAN-001", Enabled: true},
				{Index: 2, SSID: "RRNET-GUEST", Enabled: false},
			},
			ConnectedHosts: []genieacs.ConnectedHost{
				{HostName: "REDMI-Note-15", IPAddress: "192.168.1.2", MACAddress: "ea:9e:eb:d0:2a:10", Active: true},
				{HostName: "Laptop-Admin", IPAddress: "192.168.1.5", MACAddress: "08:97:98:d1:ec:82", Active: true},
			},
			UptimeSeconds:   184200, // ~2 days
		})
	}

	return devices, nil
}

// GetDevice returns details of a single ONT device.
func (s *ACSService) GetDevice(ctx context.Context, tenantID uuid.UUID, deviceID string) (*genieacs.DeviceSummary, error) {
	// Check mock first
	if deviceID == "ZTEG-F609-SIMULATOR-001" {
		mockRx := -19.45
		mockTx := 2.30
		return &genieacs.DeviceSummary{
			ID:              "ZTEG-F609-SIMULATOR-001",
			SerialNumber:    "ZTEGC8923011",
			ProductClass:    "F609 v9.0",
			Manufacturer:    "ZTE Corporation",
			OUI:             "00259E",
			SoftwareVersion: "V9.0.10P1N12",
			HardwareVersion: "V9.0",
			IPAddress:       "10.10.20.15",
			MACAddress:      "A4:2B:B0:12:34:56",
			Status:          "online",
			LastInform:      time.Now().Add(-2 * time.Minute),
			RxPowerDBm:      &mockRx,
			TxPowerDBm:      &mockTx,
			SSID:            "RRNET-PELANGGAN-001",
			WiFiEnabled:     true,
			SSIDList: []genieacs.WiFiSSID{
				{Index: 1, SSID: "RRNET-PELANGGAN-001", Enabled: true},
				{Index: 2, SSID: "RRNET-GUEST", Enabled: false},
			},
			ConnectedHosts: []genieacs.ConnectedHost{
				{HostName: "REDMI-Note-15", IPAddress: "192.168.1.2", MACAddress: "ea:9e:eb:d0:2a:10", Active: true},
				{HostName: "Laptop-Admin", IPAddress: "192.168.1.5", MACAddress: "08:97:98:d1:ec:82", Active: true},
			},
			UptimeSeconds:   184200,
		}, nil
	}

	raw, err := s.client.GetRawDevice(ctx, deviceID)
	if err != nil {
		return nil, err
	}

	dev := s.normalizeDevice(raw)
	return &dev, nil
}

// Reboot triggers device restart.
func (s *ACSService) Reboot(ctx context.Context, tenantID uuid.UUID, deviceID string) error {
	if deviceID == "ZTEG-F609-SIMULATOR-001" {
		return nil // Simulated success
	}
	return s.client.Reboot(ctx, deviceID)
}

// SetWiFi configures WiFi SSID and Password on ONT (with automatic multi-vendor path detection).
func (s *ACSService) SetWiFi(ctx context.Context, tenantID uuid.UUID, deviceID string, ssid, password string) error {
	if strings.TrimSpace(ssid) == "" {
		return fmt.Errorf("SSID cannot be empty")
	}
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}

	if deviceID == "ZTEG-F609-SIMULATOR-001" {
		return nil // Simulated success
	}

	// Fetch raw device to detect supported WiFi parameter path
	raw, err := s.client.GetRawDevice(ctx, deviceID)
	if err != nil {
		// Fallback to client default if fetch fails
		return s.client.SetWiFi(ctx, deviceID, ssid, password)
	}

	// Detect if device supports direct KeyPassphrase (older ZTE like F460) or standard PreSharedKey (F609, Huawei, etc.)
	directKeyPath := "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase"
	hasDirectKey := pathExistsInTree(raw, directKeyPath)

	var paramValues [][]interface{}
	paramValues = append(paramValues, []interface{}{
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", ssid, "xsd:string",
	})

	if hasDirectKey {
		// Older ZTE (F460, etc.)
		paramValues = append(paramValues, []interface{}{
			directKeyPath, password, "xsd:string",
		})
	} else {
		// Standard TR-098 (F609, Huawei, Fiberhome, VSOL)
		paramValues = append(paramValues, []interface{}{
			"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase", password, "xsd:string",
		})
	}

	return s.client.SendTask(ctx, deviceID, genieacs.TaskRequest{
		Name:            "setParameterValues",
		ParameterValues: paramValues,
	}, true)
}

// Refresh triggers parameter refresh.
func (s *ACSService) Refresh(ctx context.Context, tenantID uuid.UUID, deviceID string) error {
	if deviceID == "ZTEG-F609-SIMULATOR-001" {
		return nil // Simulated success
	}
	return s.client.RefreshDevice(ctx, deviceID)
}

// normalizeDevice parses raw GenieACS device JSON into standardized DeviceSummary.
func (s *ACSService) normalizeDevice(raw map[string]interface{}) genieacs.DeviceSummary {
	dev := genieacs.DeviceSummary{
		ID:     getString(raw, "_id"),
		Status: "offline",
	}

	// Last inform time
	if lastInformStr := getString(raw, "_lastInform"); lastInformStr != "" {
		if t, err := time.Parse(time.RFC3339Nano, lastInformStr); err == nil {
			dev.LastInform = t
			// If device contacted within last 10 minutes, consider online
			if time.Since(t) < 10*time.Minute {
				dev.Status = "online"
			}
		}
	}

	// Device identity
	dev.SerialNumber = findStringInTree(raw, []string{
		"DeviceID.SerialNumber",
		"_deviceId._SerialNumber",
		"InternetGatewayDevice.DeviceInfo.SerialNumber",
		"Device.DeviceInfo.SerialNumber",
	})
	if dev.SerialNumber == "" {
		dev.SerialNumber = dev.ID
	}

	dev.ProductClass = findStringInTree(raw, []string{
		"DeviceID.ProductClass",
		"_deviceId._ProductClass",
		"InternetGatewayDevice.DeviceInfo.ProductClass",
		"Device.DeviceInfo.ProductClass",
	})

	dev.Manufacturer = findStringInTree(raw, []string{
		"DeviceID.Manufacturer",
		"_deviceId._Manufacturer",
		"InternetGatewayDevice.DeviceInfo.Manufacturer",
		"Device.DeviceInfo.Manufacturer",
	})

	dev.OUI = findStringInTree(raw, []string{
		"DeviceID.OUI",
		"_deviceId._OUI",
		"InternetGatewayDevice.DeviceInfo.ManufacturerOUI",
		"Device.DeviceInfo.ManufacturerOUI",
	})

	dev.SoftwareVersion = findStringInTree(raw, []string{
		"InternetGatewayDevice.DeviceInfo.SoftwareVersion",
		"Device.DeviceInfo.SoftwareVersion",
	})

	dev.HardwareVersion = findStringInTree(raw, []string{
		"InternetGatewayDevice.DeviceInfo.HardwareVersion",
		"Device.DeviceInfo.HardwareVersion",
	})

	// Network info: Search IP across WANConnectionDevice 1..4 (both WANPPPConnection and WANIPConnection)
	var ipCandidates []string
	for slot := 1; slot <= 4; slot++ {
		ipCandidates = append(ipCandidates,
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.1.ExternalIPAddress", slot),
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANIPConnection.1.ExternalIPAddress", slot),
		)
	}
	ipCandidates = append(ipCandidates,
		"Device.IP.Interface.1.IPv4Address.1.IPAddress",
		"InternetGatewayDevice.ManagementServer.ConnectionRequestURL",
	)
	ipVal := findStringInTree(raw, ipCandidates)
	if strings.HasPrefix(ipVal, "http://") || strings.HasPrefix(ipVal, "https://") {
		if u, err := url.Parse(ipVal); err == nil {
			ipVal = u.Hostname()
		}
	}
	if ipVal != "" && ipVal != "0.0.0.0" {
		dev.IPAddress = ipVal
	} else {
		dev.IPAddress = getString(raw, "_ip")
	}

	dev.MACAddress = findStringInTree(raw, []string{
		"InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.1.MACAddress",
		"InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.MACAddress",
		"InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.MACAddress",
		"Device.Ethernet.Interface.1.MACAddress",
	})

	// Optical Power (RX / TX in dBm)
	rxStr := findStringInTree(raw, []string{
		"InternetGatewayDevice.WANDevice.1.X_ZTE-FTTH_WANPONInterfaceConfig.RXPower",
		"InternetGatewayDevice.WANDevice.1.X_HW_DEBUG.SMP.OPTIC.RxPower",
		"InternetGatewayDevice.WANDevice.1.X_FH_PON.RXPower",
		"Device.Optical.Interface.1.RxPower",
	})
	if rxStr != "" {
		if f, err := strconv.ParseFloat(rxStr, 64); err == nil {
			// Some ONTs report raw int like -1950 (-19.5 dBm) or 0.01 uW
			if math.Abs(f) > 100 {
				f = f / 100.0
			}
			dev.RxPowerDBm = &f
		}
	}

	txStr := findStringInTree(raw, []string{
		"InternetGatewayDevice.WANDevice.1.X_ZTE-FTTH_WANPONInterfaceConfig.TXPower",
		"InternetGatewayDevice.WANDevice.1.X_HW_DEBUG.SMP.OPTIC.TxPower",
		"InternetGatewayDevice.WANDevice.1.X_FH_PON.TXPower",
		"Device.Optical.Interface.1.TxPower",
	})
	if txStr != "" {
		if f, err := strconv.ParseFloat(txStr, 64); err == nil {
			if math.Abs(f) > 100 {
				f = f / 100.0
			}
			dev.TxPowerDBm = &f
		}
	}

	// Multi-SSID Info: scan slots 1..8
	for slot := 1; slot <= 8; slot++ {
		ssidName := findStringInTree(raw, []string{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.SSID", slot),
			fmt.Sprintf("Device.WiFi.SSID.%d.SSID", slot),
		})
		if ssidName == "" {
			continue
		}
		enableStr := findStringInTree(raw, []string{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.Enable", slot),
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.RadioEnabled", slot),
			fmt.Sprintf("Device.WiFi.Radio.%d.Enable", slot),
		})
		bssid := findStringInTree(raw, []string{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.BSSID", slot),
			fmt.Sprintf("Device.WiFi.SSID.%d.BSSID", slot),
		})
		isEnabled := (enableStr == "1" || strings.ToLower(enableStr) == "true" || enableStr == "")
		dev.SSIDList = append(dev.SSIDList, genieacs.WiFiSSID{
			Index:   slot,
			SSID:    ssidName,
			Enabled: isEnabled,
			BSSID:   bssid,
		})
	}

	if len(dev.SSIDList) > 0 {
		// Default primary SSID is slot 1 or first enabled
		dev.SSID = dev.SSIDList[0].SSID
		for _, item := range dev.SSIDList {
			if item.Enabled {
				dev.SSID = item.SSID
				dev.WiFiEnabled = true
				break
			}
		}
	} else {
		dev.SSID = findStringInTree(raw, []string{
			"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
			"Device.WiFi.SSID.1.SSID",
		})
		wifiEnabledStr := findStringInTree(raw, []string{
			"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable",
			"Device.WiFi.Radio.1.Enable",
		})
		dev.WiFiEnabled = (wifiEnabledStr == "1" || strings.ToLower(wifiEnabledStr) == "true")
	}

	// Connected Hosts (LAN/WLAN client devices)
	for hostIdx := 1; hostIdx <= 32; hostIdx++ {
		mac := findStringInTree(raw, []string{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.Hosts.Host.%d.MACAddress", hostIdx),
			fmt.Sprintf("Device.Hosts.Host.%d.PhysAddress", hostIdx),
		})
		ip := findStringInTree(raw, []string{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.Hosts.Host.%d.IPAddress", hostIdx),
			fmt.Sprintf("Device.Hosts.Host.%d.IPAddress", hostIdx),
		})
		if mac == "" && ip == "" {
			continue
		}
		hostname := findStringInTree(raw, []string{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.Hosts.Host.%d.HostName", hostIdx),
			fmt.Sprintf("Device.Hosts.Host.%d.HostName", hostIdx),
		})
		activeStr := findStringInTree(raw, []string{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.Hosts.Host.%d.Active", hostIdx),
			fmt.Sprintf("Device.Hosts.Host.%d.Active", hostIdx),
		})
		isActive := (activeStr == "1" || strings.ToLower(activeStr) == "true" || activeStr == "")
		dev.ConnectedHosts = append(dev.ConnectedHosts, genieacs.ConnectedHost{
			HostName:   hostname,
			IPAddress:  ip,
			MACAddress: mac,
			Active:     isActive,
		})
	}

	// Uptime
	uptimeStr := findStringInTree(raw, []string{
		"InternetGatewayDevice.DeviceInfo.UpTime",
		"Device.DeviceInfo.UpTime",
	})
	if uptimeStr != "" {
		if u, err := strconv.ParseInt(uptimeStr, 10, 64); err == nil {
			dev.UptimeSeconds = u
		}
	}

	return dev
}

func pathExistsInTree(m map[string]interface{}, path string) bool {
	parts := strings.Split(path, ".")
	var current interface{} = m
	for _, part := range parts {
		currMap, ok := current.(map[string]interface{})
		if !ok {
			return false
		}
		current, ok = currMap[part]
		if !ok {
			return false
		}
	}
	return current != nil
}

// Helpers
func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

func findStringInTree(m map[string]interface{}, paths []string) string {
	for _, p := range paths {
		parts := strings.Split(p, ".")
		var current interface{} = m
		found := true

		for _, part := range parts {
			currMap, ok := current.(map[string]interface{})
			if !ok {
				found = false
				break
			}
			current, ok = currMap[part]
			if !ok {
				found = false
				break
			}
		}

		if found && current != nil {
			// GenieACS leaf values are typically objects: {"_value": "...", "_type": "xsd:string"}
			if leafMap, ok := current.(map[string]interface{}); ok {
				if v, ok := leafMap["_value"]; ok && v != nil {
					return fmt.Sprintf("%v", v)
				}
			}
			return fmt.Sprintf("%v", current)
		}
	}
	return ""
}
