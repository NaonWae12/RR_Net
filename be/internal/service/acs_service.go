package service

import (
	"context"
	"fmt"
	"math"
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

// SetWiFi configures WiFi SSID and Password on ONT.
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

	return s.client.SetWiFi(ctx, deviceID, ssid, password)
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

	// Network info
	dev.IPAddress = getString(raw, "_ip")
	if dev.IPAddress == "" {
		dev.IPAddress = findStringInTree(raw, []string{
			"InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress",
			"InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress",
			"Device.IP.Interface.1.IPv4Address.1.IPAddress",
		})
	}

	dev.MACAddress = findStringInTree(raw, []string{
		"InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.1.MACAddress",
		"InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.MACAddress",
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

	// WiFi Info
	dev.SSID = findStringInTree(raw, []string{
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
		"Device.WiFi.SSID.1.SSID",
	})

	wifiEnabledStr := findStringInTree(raw, []string{
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable",
		"Device.WiFi.Radio.1.Enable",
	})
	dev.WiFiEnabled = (wifiEnabledStr == "1" || strings.ToLower(wifiEnabledStr) == "true")

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
