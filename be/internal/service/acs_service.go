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
	"github.com/rs/zerolog/log"
	"rrnet/internal/domain/acs"
	"rrnet/internal/infra/genieacs"
	"rrnet/internal/repository"
)

type ACSService struct {
	client *genieacs.Client
	repo   *repository.ACSDeviceRepository
}

func NewACSService(client *genieacs.Client, repo *repository.ACSDeviceRepository) *ACSService {
	return &ACSService{client: client, repo: repo}
}

// ListDevices returns ONT devices registered to the current tenant.
func (s *ACSService) ListDevices(ctx context.Context, tenantID uuid.UUID) ([]genieacs.DeviceSummary, error) {
	if s.client == nil {
		return nil, fmt.Errorf("genieacs client not initialized")
	}

	// 1. Fetch raw devices from GenieACS (graceful fallback to DB if GenieACS is unreachable)
	rawDevices, err := s.client.ListRawDevices(ctx, "")
	if err != nil {
		log.Warn().Err(err).Msg("ACS: GenieACS unreachable, falling back to DB-only")
		rawDevices = nil
	}

	// 2. Auto-bind newly detected devices via WAN PPPoE username
	// If a modem connects and has an active PPPoE username matching a client in database,
	// automatically bind it to that tenant!
	if s.repo != nil {
		allRegistered, regErr := s.repo.GetAllRegisteredDeviceIDs(ctx)
		if regErr != nil {
			log.Warn().Err(regErr).Msg("ACS: failed to get registered device IDs for auto-bind")
			allRegistered = make(map[string]uuid.UUID)
		}
		for _, raw := range rawDevices {
			devID := getString(raw, "_id")
			if devID == "" {
				continue
			}
			if isNonONTDevice(s.normalizeDevice(raw)) {
				continue
			}

			// If device not yet registered to any tenant, check if it has a PPPoE username
			if _, exists := allRegistered[devID]; !exists {
				if pppoeUser := extractPPPoEUsername(raw); pppoeUser != "" {
					if mapping, err := s.repo.FindTenantByPPPoE(ctx, pppoeUser); err == nil && mapping != nil {
						normDev := s.normalizeDevice(raw)
						label := mapping.ClientName
						if label == "" {
							label = "PPPoE: " + pppoeUser
						}
						if bindErr := s.repo.Register(ctx, &acs.DeviceTenant{
							TenantID:     mapping.TenantID,
							DeviceID:     devID,
							SerialNumber: normDev.SerialNumber,
							Label:        label,
							ClientID:     &mapping.ClientID,
						}); bindErr != nil {
							log.Warn().Err(bindErr).Str("device", devID).Str("pppoe", pppoeUser).Msg("ACS: auto-bind PPPoE failed")
						}
					}
				}
			}
		}
	}

	// 3. Get tenant's registered devices from PostgreSQL
	var registered []*acs.DeviceTenant
	if s.repo != nil && tenantID != uuid.Nil {
		registered, err = s.repo.ListByTenant(ctx, tenantID)
		if err != nil {
			return nil, fmt.Errorf("gagal mengambil perangkat terdaftar tenant: %w", err)
		}
	}

	// If no devices registered in DB for this tenant, return empty list (strict multi-tenant isolation)
	if len(registered) == 0 {
		return []genieacs.DeviceSummary{}, nil
	}

	regMap := make(map[string]*acs.DeviceTenant)
	for _, r := range registered {
		regMap[r.DeviceID] = r
		if r.SerialNumber != "" {
			regMap[r.SerialNumber] = r
		}
	}

	matchedMap := make(map[string]bool)
	var devices []genieacs.DeviceSummary

	for _, raw := range rawDevices {
		dev := s.normalizeDevice(raw)
		if isNonONTDevice(dev) {
			continue
		}

		// Check if device belongs to this tenant
		reg, found := regMap[dev.ID]
		if !found && dev.SerialNumber != "" {
			reg, found = regMap[dev.SerialNumber]
		}

		if found {
			// Auto-sync device_id if registered using raw SN or outdated ID
			if reg.DeviceID != dev.ID && strings.Contains(dev.ID, "-") {
				if syncErr := s.repo.SyncDeviceID(ctx, reg.TenantID, reg.ID, dev.ID, dev.SerialNumber); syncErr != nil {
					log.Warn().Err(syncErr).Str("device", dev.ID).Msg("ACS: SyncDeviceID failed")
				}
				reg.DeviceID = dev.ID
			}

			// Dynamic threshold with idle protection & inform interval awareness
			isOnlineNow, effectiveInterval := s.calculateDeviceOnlineStatus(dev, reg.InformInterval)

			currentStatus := "offline"
			if isOnlineNow {
				currentStatus = "online"
			}

			now := time.Now()
			// State-Change Only Write: ONLY update database if status actually transitioned!
			if currentStatus != reg.Status {
				if currentStatus == "online" {
					onlineAt := dev.LastInform
					if onlineAt.IsZero() {
						onlineAt = now
					}
					if err := s.repo.UpdateDeviceStatus(ctx, reg.TenantID, reg.ID, "online", &onlineAt, nil); err != nil {
						log.Warn().Err(err).Str("device", dev.ID).Msg("ACS: UpdateDeviceStatus(online) failed")
					}
					reg.Status = "online"
					reg.OnlineAt = &onlineAt
					reg.OfflineAt = nil
				} else {
					offlineAt := dev.LastInform
					if offlineAt.IsZero() {
						offlineAt = now
					}
					if err := s.repo.UpdateDeviceStatus(ctx, reg.TenantID, reg.ID, "offline", nil, &offlineAt); err != nil {
						log.Warn().Err(err).Str("device", dev.ID).Msg("ACS: UpdateDeviceStatus(offline) failed")
					}
					reg.Status = "offline"
					reg.OfflineAt = &offlineAt
				}
			} else if currentStatus == "online" && reg.OnlineAt == nil {
				// Initial boot initialization if null
				onlineAt := dev.LastInform
				if onlineAt.IsZero() {
					onlineAt = now
				}
				if err := s.repo.UpdateDeviceStatus(ctx, reg.TenantID, reg.ID, "online", &onlineAt, nil); err != nil {
					log.Warn().Err(err).Str("device", dev.ID).Msg("ACS: init UpdateDeviceStatus(online) failed")
				}
				reg.OnlineAt = &onlineAt
			} else if currentStatus == "offline" && reg.OfflineAt == nil && !dev.LastInform.IsZero() {
				offlineAt := dev.LastInform
				if err := s.repo.UpdateDeviceStatus(ctx, reg.TenantID, reg.ID, "offline", nil, &offlineAt); err != nil {
					log.Warn().Err(err).Str("device", dev.ID).Msg("ACS: init UpdateDeviceStatus(offline) failed")
				}
				reg.OfflineAt = &offlineAt
			}

			dev.Status = reg.Status
			dev.OnlineAt = reg.OnlineAt
			dev.OfflineAt = reg.OfflineAt
			dev.InformInterval = effectiveInterval

			// Accurate Uptime calculated by Backend
			if dev.Status == "online" {
				if reg.OnlineAt != nil {
					dev.UptimeSeconds = int64(time.Since(*reg.OnlineAt).Seconds())
				} else if !dev.LastInform.IsZero() {
					dev.UptimeSeconds = int64(time.Since(dev.LastInform).Seconds())
				}
			} else {
				if reg.OfflineAt != nil {
					dev.UptimeSeconds = int64(time.Since(*reg.OfflineAt).Seconds())
				} else if !dev.LastInform.IsZero() {
					dev.UptimeSeconds = int64(time.Since(dev.LastInform).Seconds())
				} else {
					dev.UptimeSeconds = 0
				}
			}

			dev.Label = reg.Label
			dev.ClientID = reg.ClientID
			dev.ClientName = reg.ClientName
			if dev.WiFiPassword == "" || dev.WiFiPassword == "********" {
				dev.WiFiPassword = reg.WiFiPassword
			}
			if dev.SSID == "" && reg.WiFiSSID != "" {
				dev.SSID = reg.WiFiSSID
			}
			dev.WiFiUpdatedAt = reg.WiFiUpdatedAt
			devices = append(devices, dev)
			matchedMap[reg.DeviceID] = true
		}
	}

	// 4. For any device registered in DB but not currently active in GenieACS,
	// create an offline summary so the tenant sees their pre-registered/offline ONT
	for _, reg := range registered {
		if !matchedMap[reg.DeviceID] {
			var uptimeSec int64
			if reg.OfflineAt != nil {
				uptimeSec = int64(time.Since(*reg.OfflineAt).Seconds())
			}
			devices = append(devices, genieacs.DeviceSummary{
				ID:             reg.DeviceID,
				SerialNumber:   reg.SerialNumber,
				Status:         "offline",
				OnlineAt:       reg.OnlineAt,
				OfflineAt:      reg.OfflineAt,
				InformInterval: reg.InformInterval,
				UptimeSeconds:  uptimeSec,
				Label:          reg.Label,
				ClientID:       reg.ClientID,
				ClientName:     reg.ClientName,
				SSID:           reg.WiFiSSID,
				WiFiPassword:   reg.WiFiPassword,
				WiFiUpdatedAt:  reg.WiFiUpdatedAt,
			})
		}
	}

	return devices, nil
}

// ListUnassignedDevices returns devices detected by GenieACS that haven't been registered by ANY tenant yet.
func (s *ACSService) ListUnassignedDevices(ctx context.Context, tenantID uuid.UUID) ([]genieacs.DeviceSummary, error) {
	if s.client == nil {
		return nil, fmt.Errorf("genieacs client not initialized")
	}

	registeredIDs := make(map[string]uuid.UUID)
	if s.repo != nil {
		var err error
		registeredIDs, err = s.repo.GetAllRegisteredDeviceIDs(ctx)
		if err != nil {
			return nil, fmt.Errorf("gagal mengambil data kepemilikan perangkat: %w", err)
		}
	}

	rawDevices, err := s.client.ListRawDevices(ctx, "")
	if err != nil {
		return []genieacs.DeviceSummary{}, nil
	}

	var unassigned []genieacs.DeviceSummary
	for _, raw := range rawDevices {
		dev := s.normalizeDevice(raw)
		if isNonONTDevice(dev) {
			continue
		}
		// If not registered by any tenant, include in unassigned list
		if _, exists := registeredIDs[dev.ID]; !exists {
			unassigned = append(unassigned, dev)
		}
	}

	return unassigned, nil
}

// ClaimDevice registers or claims an ONT device for the tenant.
func (s *ACSService) ClaimDevice(ctx context.Context, tenantID uuid.UUID, deviceID, serialNumber, label string, clientID *uuid.UUID) error {
	if s.repo == nil {
		return fmt.Errorf("repository not initialized")
	}
	if tenantID == uuid.Nil {
		return fmt.Errorf("tenant_id tidak valid")
	}
	deviceID = strings.TrimSpace(deviceID)
	serialNumber = strings.TrimSpace(serialNumber)
	if deviceID == "" && serialNumber == "" {
		return fmt.Errorf("Serial Number atau Device ID wajib diisi")
	}

	// If deviceID is empty but serialNumber is given, match against connected GenieACS devices
	if deviceID == "" && s.client != nil {
		rawDevices, _ := s.client.ListRawDevices(ctx, "")
		for _, raw := range rawDevices {
			norm := s.normalizeDevice(raw)
			if strings.EqualFold(norm.SerialNumber, serialNumber) || strings.EqualFold(norm.ID, serialNumber) {
				deviceID = norm.ID
				break
			}
		}
		if deviceID == "" {
			// Pre-provisioning: device not yet in GenieACS, use serialNumber as temporary ID
			deviceID = serialNumber
		}
	}

	// Auto-fill serial number if empty and device is in GenieACS
	if serialNumber == "" && s.client != nil {
		if raw, err := s.client.GetRawDevice(ctx, deviceID); err == nil {
			dev := s.normalizeDevice(raw)
			serialNumber = dev.SerialNumber
		}
	}

	return s.repo.Register(ctx, &acs.DeviceTenant{
		TenantID:     tenantID,
		DeviceID:     deviceID,
		SerialNumber: serialNumber,
		Label:        label,
		ClientID:     clientID,
	})
}

// UnclaimDevice unregisters a device from the tenant.
func (s *ACSService) UnclaimDevice(ctx context.Context, tenantID uuid.UUID, deviceID string) error {
	if s.repo == nil {
		return fmt.Errorf("repository not initialized")
	}
	if tenantID == uuid.Nil {
		return fmt.Errorf("tenant_id tidak valid")
	}
	return s.repo.Unregister(ctx, tenantID, deviceID)
}

// UpdateMetadata updates label, serial number, and client binding for a tenant's device.
func (s *ACSService) UpdateMetadata(ctx context.Context, tenantID uuid.UUID, deviceID string, serialNumber string, label string, clientID *uuid.UUID) error {
	if s.repo == nil {
		return fmt.Errorf("repository not initialized")
	}
	if tenantID == uuid.Nil {
		return fmt.Errorf("tenant_id tidak valid")
	}
	return s.repo.UpdateMetadata(ctx, tenantID, deviceID, serialNumber, label, clientID)
}

// GetDevice returns details of a single ONT device, verifying tenant ownership.
func (s *ACSService) GetDevice(ctx context.Context, tenantID uuid.UUID, deviceID string) (*genieacs.DeviceSummary, error) {
	var targetDevID = deviceID
	if s.repo != nil && tenantID != uuid.Nil {
		reg, err := s.repo.GetByDeviceID(ctx, deviceID)
		if err != nil {
			return nil, fmt.Errorf("perangkat tidak ditemukan atau belum terdaftar di tenant Anda")
		}
		if reg.TenantID != tenantID {
			return nil, fmt.Errorf("akses ditolak: perangkat ini milik tenant lain")
		}
		if reg.DeviceID != "" && strings.Contains(reg.DeviceID, "-") {
			targetDevID = reg.DeviceID
		}

		raw, err := s.client.GetRawDevice(ctx, targetDevID)
		if err != nil {
			var uptimeSec int64
			if reg.OfflineAt != nil {
				uptimeSec = int64(time.Since(*reg.OfflineAt).Seconds())
			}
			return &genieacs.DeviceSummary{
				ID:             reg.DeviceID,
				SerialNumber:   reg.SerialNumber,
				Status:         "offline",
				OnlineAt:       reg.OnlineAt,
				OfflineAt:      reg.OfflineAt,
				InformInterval: reg.InformInterval,
				UptimeSeconds:  uptimeSec,
				Label:          reg.Label,
				ClientID:       reg.ClientID,
				ClientName:     reg.ClientName,
				SSID:           reg.WiFiSSID,
				WiFiPassword:   reg.WiFiPassword,
				WiFiUpdatedAt:  reg.WiFiUpdatedAt,
			}, nil
		}

		dev := s.normalizeDevice(raw)

		// Dynamic threshold with idle protection & inform interval awareness
		isOnlineNow, effectiveInterval := s.calculateDeviceOnlineStatus(dev, reg.InformInterval)

		currentStatus := "offline"
		if isOnlineNow {
			currentStatus = "online"
		}

		now := time.Now()
		if currentStatus != reg.Status {
			if currentStatus == "online" {
				onlineAt := dev.LastInform
				if onlineAt.IsZero() {
					onlineAt = now
				}
				if err := s.repo.UpdateDeviceStatus(ctx, reg.TenantID, reg.ID, "online", &onlineAt, nil); err != nil {
					log.Warn().Err(err).Str("device", dev.ID).Msg("ACS: GetDevice UpdateDeviceStatus(online) failed")
				}
				reg.Status = "online"
				reg.OnlineAt = &onlineAt
				reg.OfflineAt = nil
			} else {
				offlineAt := dev.LastInform
				if offlineAt.IsZero() {
					offlineAt = now
				}
				if err := s.repo.UpdateDeviceStatus(ctx, reg.TenantID, reg.ID, "offline", nil, &offlineAt); err != nil {
					log.Warn().Err(err).Str("device", dev.ID).Msg("ACS: GetDevice UpdateDeviceStatus(offline) failed")
				}
				reg.Status = "offline"
				reg.OfflineAt = &offlineAt
			}
		}

		dev.Status = reg.Status
		dev.OnlineAt = reg.OnlineAt
		dev.OfflineAt = reg.OfflineAt
		dev.InformInterval = effectiveInterval

		if dev.Status == "online" {
			if reg.OnlineAt != nil {
				dev.UptimeSeconds = int64(time.Since(*reg.OnlineAt).Seconds())
			} else if !dev.LastInform.IsZero() {
				dev.UptimeSeconds = int64(time.Since(dev.LastInform).Seconds())
			}
		} else {
			if reg.OfflineAt != nil {
				dev.UptimeSeconds = int64(time.Since(*reg.OfflineAt).Seconds())
			} else if !dev.LastInform.IsZero() {
				dev.UptimeSeconds = int64(time.Since(dev.LastInform).Seconds())
			} else {
				dev.UptimeSeconds = 0
			}
		}

		dev.Label = reg.Label
		dev.ClientID = reg.ClientID
		dev.ClientName = reg.ClientName
		if dev.WiFiPassword == "" || dev.WiFiPassword == "********" {
			dev.WiFiPassword = reg.WiFiPassword
		}
		if dev.SSID == "" && reg.WiFiSSID != "" {
			dev.SSID = reg.WiFiSSID
		}
		dev.WiFiUpdatedAt = reg.WiFiUpdatedAt
		return &dev, nil
	}

	raw, err := s.client.GetRawDevice(ctx, targetDevID)
	if err != nil {
		return nil, err
	}

	dev := s.normalizeDevice(raw)
	return &dev, nil
}

// Reboot triggers device restart after verifying tenant ownership.
func (s *ACSService) Reboot(ctx context.Context, tenantID uuid.UUID, deviceID string) error {
	var targetDevID = deviceID
	if s.repo != nil && tenantID != uuid.Nil {
		reg, err := s.repo.GetByDeviceID(ctx, deviceID)
		if err != nil || reg.TenantID != tenantID {
			return fmt.Errorf("akses ditolak: perangkat ini tidak terdaftar di tenant Anda")
		}
		if reg.DeviceID != "" && strings.Contains(reg.DeviceID, "-") {
			targetDevID = reg.DeviceID
		}
	}
	err := s.client.Reboot(ctx, targetDevID)
	if err == nil && s.client != nil {
		s.client.InvalidateCache()
	}
	return err
}

// SetWiFiPayload holds parameters for configuring WiFi on ONT.
type SetWiFiPayload struct {
	Slot         int    `json:"slot"`
	SSID         string `json:"ssid"`
	Password     string `json:"password"`
	SecurityMode string `json:"security_mode,omitempty"` // None, 11i, WPAand11i, Basic
	Encryption   string `json:"encryption,omitempty"`    // AESEncryption, TKIPandAESEncryption
	Enabled      *bool  `json:"enabled,omitempty"`       // On/Off WiFi
	Channel      *int   `json:"channel,omitempty"`       // 0 (Auto), 1-13
	TxPower      *int   `json:"tx_power,omitempty"`      // 20, 50, 75, 100
}

// SetWiFi configures WiFi SSID, Password, Security Mode, Channel, and Radio on ONT.
func (s *ACSService) SetWiFi(ctx context.Context, tenantID uuid.UUID, deviceID string, req SetWiFiPayload) error {
	slot := req.Slot
	if slot <= 0 {
		slot = 1
	}
	ssid := strings.TrimSpace(req.SSID)
	password := strings.TrimSpace(req.Password)
	if ssid == "" {
		return fmt.Errorf("nama SSID tidak boleh kosong")
	}

	secMode := req.SecurityMode
	if secMode == "" {
		if password == "" {
			secMode = "None"
		} else {
			secMode = "11i" // WPA2-PSK default
		}
	}

	if secMode != "None" && password != "" && len(password) < 8 {
		return fmt.Errorf("password WiFi minimal 8 karakter untuk mode keamanan %s", secMode)
	}

	var targetDevID = deviceID
	if s.repo != nil && tenantID != uuid.Nil {
		reg, err := s.repo.GetByDeviceID(ctx, deviceID)
		if err != nil || reg.TenantID != tenantID {
			return fmt.Errorf("akses ditolak: perangkat ini tidak terdaftar di tenant Anda")
		}
		if reg.DeviceID != "" && strings.Contains(reg.DeviceID, "-") {
			targetDevID = reg.DeviceID
		}
	}

	// Fetch raw device to detect supported WiFi parameter path
	raw, _ := s.client.GetRawDevice(ctx, targetDevID)

	isTR181 := raw != nil && (pathExistsInTree(raw, fmt.Sprintf("Device.WiFi.SSID.%d.SSID", slot)) || pathExistsInTree(raw, fmt.Sprintf("Device.WiFi.Radio.%d.Enable", slot)))
	directKeyPath := fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.KeyPassphrase", slot)
	hasDirectKey := raw != nil && pathExistsInTree(raw, directKeyPath)
	zteDirectKeyPath := fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.X_ZTE-COM_KeyPassphrase", slot)
	hasZteDirectKey := raw != nil && pathExistsInTree(raw, zteDirectKeyPath)

	var paramValues [][]interface{}
	if isTR181 {
		paramValues = append(paramValues, []interface{}{
			fmt.Sprintf("Device.WiFi.SSID.%d.SSID", slot), ssid, "xsd:string",
		})
		if req.Enabled != nil {
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("Device.WiFi.SSID.%d.Enable", slot), *req.Enabled, "xsd:boolean",
			})
		}
		if secMode == "None" {
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("Device.WiFi.AccessPoint.%d.Security.ModeEnabled", slot), "None", "xsd:string",
			})
		} else {
			modeStr := "WPA2-Personal"
			if secMode == "WPAand11i" {
				modeStr = "WPA-WPA2-Personal"
			}
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("Device.WiFi.AccessPoint.%d.Security.ModeEnabled", slot), modeStr, "xsd:string",
			})
			if password != "" {
				paramValues = append(paramValues, []interface{}{
					fmt.Sprintf("Device.WiFi.AccessPoint.%d.Security.KeyPassphrase", slot), password, "xsd:string",
				})
			}
		}
		if req.Channel != nil && *req.Channel >= 0 {
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("Device.WiFi.Radio.%d.Channel", slot), *req.Channel, "xsd:unsignedInt",
			})
		}
	} else {
		// Standard TR-098
		paramValues = append(paramValues, []interface{}{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.SSID", slot), ssid, "xsd:string",
		})
		if req.Enabled != nil {
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.Enable", slot), *req.Enabled, "xsd:boolean",
			})
		}

		// Security Mode (BeaconType)
		switch secMode {
		case "None":
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.BeaconType", slot), "None", "xsd:string",
			})
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.BasicEncryptionModes", slot), "None", "xsd:string",
			})
		case "WPAand11i":
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.BeaconType", slot), "WPAand11i", "xsd:string",
			})
			encMode := "TKIPandAESEncryption"
			if req.Encryption != "" {
				encMode = req.Encryption
			}
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.WPAEncryptionModes", slot), encMode, "xsd:string",
			})
		default:
			// Default 11i (WPA2-PSK)
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.BeaconType", slot), "11i", "xsd:string",
			})
			encMode := "AESEncryption"
			if req.Encryption != "" {
				encMode = req.Encryption
			}
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.WPAEncryptionModes", slot), encMode, "xsd:string",
			})
		}

		// Password passphrase
		if secMode != "None" && password != "" {
			if hasDirectKey {
				paramValues = append(paramValues, []interface{}{
					directKeyPath, password, "xsd:string",
				})
			} else if hasZteDirectKey {
				paramValues = append(paramValues, []interface{}{
					zteDirectKeyPath, password, "xsd:string",
				})
			} else {
				paramValues = append(paramValues, []interface{}{
					fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.PreSharedKey.1.KeyPassphrase", slot), password, "xsd:string",
				})
			}
		}

		// Channel (0 = Auto, 1-13)
		if req.Channel != nil && *req.Channel >= 0 {
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.Channel", slot), *req.Channel, "xsd:unsignedInt",
			})
		}

		// Transmit Power (20, 50, 75, 100)
		if req.TxPower != nil && *req.TxPower > 0 {
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.TransmitPower", slot), *req.TxPower, "xsd:unsignedInt",
			})
		}
	}

	// Send task to GenieACS (with connection_request = true to push immediately)
	sendErr := s.client.SendTask(ctx, targetDevID, genieacs.TaskRequest{
		Name:            "setParameterValues",
		ParameterValues: paramValues,
	}, true)

	// Persist to database for primary SSID (slot 1) so tenant always has record of current/configured WiFi
	if slot == 1 && s.repo != nil && tenantID != uuid.Nil {
		if err := s.repo.UpdateWiFi(ctx, tenantID, deviceID, ssid, password); err != nil {
			log.Warn().Err(err).Str("device", deviceID).Msg("ACS: UpdateWiFi failed")
		}
	}

	if sendErr != nil {
		return fmt.Errorf("perintah dikirim ke antrean, namun peringatan ACS: %w", sendErr)
	}

	if s.client != nil {
		s.client.InvalidateCache()
	}

	return nil
}

// SetWANPayload holds parameters for configuring WAN connection on ONT.
type SetWANPayload struct {
	Slot        int    `json:"slot"`                   // 1..4 (default 1)
	Mode        string `json:"mode"`                   // PPPoE, IPoE (DHCP), Bridge
	Username    string `json:"username,omitempty"`     // PPPoE username
	Password    string `json:"password,omitempty"`     // PPPoE password
	VLANID      int    `json:"vlan_id,omitempty"`      // 0 for untagged, or 1..4094
	ServiceList string `json:"service_list,omitempty"` // default "INTERNET"
	NATEnabled  *bool  `json:"nat_enabled,omitempty"`  // default true for PPPoE/IPoE
}

// SetWAN configures WAN connection (PPPoE, IPoE, or Bridge), VLAN, and Credentials on ONT.
func (s *ACSService) SetWAN(ctx context.Context, tenantID uuid.UUID, deviceID string, req SetWANPayload) error {
	slot := req.Slot
	if slot <= 0 {
		slot = 1
	}

	mode := strings.ToUpper(strings.TrimSpace(req.Mode))
	if mode == "" {
		mode = "PPPOE"
	}
	if mode != "PPPOE" && mode != "IPOE" && mode != "DHCP" && mode != "BRIDGE" {
		return fmt.Errorf("mode WAN tidak valid (harus PPPoE, IPoE, atau Bridge)")
	}

	serviceList := strings.TrimSpace(req.ServiceList)
	if serviceList == "" {
		serviceList = "INTERNET"
	}

	natEnabled := true
	if mode == "BRIDGE" {
		natEnabled = false
	}
	if req.NATEnabled != nil {
		natEnabled = *req.NATEnabled
	}

	var targetDevID = deviceID
	if s.repo != nil && tenantID != uuid.Nil {
		reg, err := s.repo.GetByDeviceID(ctx, deviceID)
		if err != nil || reg.TenantID != tenantID {
			return fmt.Errorf("akses ditolak: perangkat ini tidak terdaftar di tenant Anda")
		}
		if reg.DeviceID != "" && strings.Contains(reg.DeviceID, "-") {
			targetDevID = reg.DeviceID
		}
	}

	raw, _ := s.client.GetRawDevice(ctx, targetDevID)

	var paramValues [][]interface{}

	switch mode {
	case "PPPOE":
		connPath := fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.1", slot)
		paramValues = append(paramValues,
			[]interface{}{connPath + ".Enable", true, "xsd:boolean"},
			[]interface{}{connPath + ".ConnectionType", "IP_Routed", "xsd:string"},
			[]interface{}{connPath + ".NATEnable", natEnabled, "xsd:boolean"},
		)
		if req.Username != "" {
			paramValues = append(paramValues, []interface{}{connPath + ".Username", req.Username, "xsd:string"})
		}
		if req.Password != "" {
			paramValues = append(paramValues, []interface{}{connPath + ".Password", req.Password, "xsd:string"})
		}
		connName := fmt.Sprintf("%d_INTERNET_R", slot)
		if req.VLANID > 0 {
			connName = fmt.Sprintf("%d_INTERNET_R_VID_%d", slot, req.VLANID)
			paramValues = append(paramValues,
				[]interface{}{fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANEthernetInterfaceConfig.VLANIDMark", slot), req.VLANID, "xsd:unsignedInt"},
			)
			if raw != nil && pathExistsInTree(raw, connPath+".X_HW_VLAN") {
				paramValues = append(paramValues, []interface{}{connPath + ".X_HW_VLAN", req.VLANID, "xsd:unsignedInt"})
			}
			if raw != nil && pathExistsInTree(raw, connPath+".X_ZTE-COM_VLAN") {
				paramValues = append(paramValues, []interface{}{connPath + ".X_ZTE-COM_VLAN", req.VLANID, "xsd:unsignedInt"})
			}
		}
		paramValues = append(paramValues, []interface{}{connPath + ".Name", connName, "xsd:string"})

		if raw != nil && pathExistsInTree(raw, connPath+".X_HW_ServiceList") {
			paramValues = append(paramValues, []interface{}{connPath + ".X_HW_ServiceList", serviceList, "xsd:string"})
		}
		if raw != nil && pathExistsInTree(raw, connPath+".X_ZTE-COM_ServiceList") {
			paramValues = append(paramValues, []interface{}{connPath + ".X_ZTE-COM_ServiceList", serviceList, "xsd:string"})
		}
	case "BRIDGE":
		connPath := fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.1", slot)
		paramValues = append(paramValues,
			[]interface{}{connPath + ".Enable", true, "xsd:boolean"},
			[]interface{}{connPath + ".ConnectionType", "PPPoE_Bridged", "xsd:string"},
			[]interface{}{connPath + ".NATEnable", false, "xsd:boolean"},
		)
		connName := fmt.Sprintf("%d_INTERNET_B", slot)
		if req.VLANID > 0 {
			connName = fmt.Sprintf("%d_INTERNET_B_VID_%d", slot, req.VLANID)
			paramValues = append(paramValues,
				[]interface{}{fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANEthernetInterfaceConfig.VLANIDMark", slot), req.VLANID, "xsd:unsignedInt"},
			)
			if raw != nil && pathExistsInTree(raw, connPath+".X_HW_VLAN") {
				paramValues = append(paramValues, []interface{}{connPath + ".X_HW_VLAN", req.VLANID, "xsd:unsignedInt"})
			}
		}
		paramValues = append(paramValues, []interface{}{connPath + ".Name", connName, "xsd:string"})
	default:
		// IPoE / DHCP
		connPath := fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANIPConnection.1", slot)
		paramValues = append(paramValues,
			[]interface{}{connPath + ".Enable", true, "xsd:boolean"},
			[]interface{}{connPath + ".ConnectionType", "IP_Routed", "xsd:string"},
			[]interface{}{connPath + ".AddressingType", "DHCP", "xsd:string"},
			[]interface{}{connPath + ".NATEnable", natEnabled, "xsd:boolean"},
		)
		connName := fmt.Sprintf("%d_INTERNET_IP_R", slot)
		if req.VLANID > 0 {
			connName = fmt.Sprintf("%d_INTERNET_IP_R_VID_%d", slot, req.VLANID)
			paramValues = append(paramValues,
				[]interface{}{fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANEthernetInterfaceConfig.VLANIDMark", slot), req.VLANID, "xsd:unsignedInt"},
			)
		}
		paramValues = append(paramValues, []interface{}{connPath + ".Name", connName, "xsd:string"})
	}

	sendErr := s.client.SendTask(ctx, targetDevID, genieacs.TaskRequest{
		Name:            "setParameterValues",
		ParameterValues: paramValues,
	}, true)

	if sendErr != nil {
		return fmt.Errorf("perintah WAN dikirim ke antrean, namun peringatan ACS: %w", sendErr)
	}

	if s.client != nil {
		s.client.InvalidateCache()
	}

	return nil
}

// SetInformInterval configures the TR-069 PeriodicInformInterval on the ONT.
// intervalSeconds is the interval in seconds (e.g. 60, 120, 300, 600).
// Pushes the value immediately via connection_request.
func (s *ACSService) SetInformInterval(ctx context.Context, tenantID uuid.UUID, deviceID string, intervalSeconds int) error {
	if intervalSeconds < 30 {
		return fmt.Errorf("interval minimal 30 detik")
	}
	if intervalSeconds > 86400 {
		return fmt.Errorf("interval maksimal 86400 detik (24 jam)")
	}

	var targetDevID = deviceID
	if s.repo != nil && tenantID != uuid.Nil {
		reg, err := s.repo.GetByDeviceID(ctx, deviceID)
		if err != nil || reg.TenantID != tenantID {
			return fmt.Errorf("akses ditolak: perangkat ini tidak terdaftar di tenant Anda")
		}
		if reg.DeviceID != "" && strings.Contains(reg.DeviceID, "-") {
			targetDevID = reg.DeviceID
		}
	}

	// Detect TR-181 vs TR-098 parameter tree model
	var isTR181 bool
	if s.client != nil {
		if rawDev, err := s.client.GetRawDevice(ctx, targetDevID); err == nil && rawDev != nil {
			if pathExistsInTree(rawDev, "Device.ManagementServer") {
				isTR181 = true
			}
		}
	}

	var paramValues [][]interface{}
	if isTR181 {
		paramValues = [][]interface{}{
			{"Device.ManagementServer.PeriodicInformInterval", intervalSeconds, "xsd:unsignedInt"},
			{"Device.ManagementServer.PeriodicInformEnable", true, "xsd:boolean"},
		}
	} else {
		// Standard TR-098 path (Huawei, ZTE, Fiberhome, VSOL)
		paramValues = [][]interface{}{
			{"InternetGatewayDevice.ManagementServer.PeriodicInformInterval", intervalSeconds, "xsd:unsignedInt"},
			{"InternetGatewayDevice.ManagementServer.PeriodicInformEnable", true, "xsd:boolean"},
		}
	}

	sendErr := s.client.SendTask(ctx, targetDevID, genieacs.TaskRequest{
		Name:            "setParameterValues",
		ParameterValues: paramValues,
	}, true)

	// Persist inform interval to database so future threshold calculations use this value
	if s.repo != nil && tenantID != uuid.Nil {
		if err := s.repo.UpdateInformInterval(ctx, tenantID, deviceID, intervalSeconds); err != nil {
			log.Warn().Err(err).Str("device", deviceID).Msg("ACS: UpdateInformInterval failed")
		}
	}

	if sendErr == nil && s.client != nil {
		s.client.InvalidateCache()
	}

	return sendErr
}

// Refresh triggers parameter refresh after verifying tenant ownership.
func (s *ACSService) Refresh(ctx context.Context, tenantID uuid.UUID, deviceID string) error {
	var targetDevID = deviceID
	if s.repo != nil && tenantID != uuid.Nil {
		reg, err := s.repo.GetByDeviceID(ctx, deviceID)
		if err != nil || reg.TenantID != tenantID {
			return fmt.Errorf("akses ditolak: perangkat ini tidak terdaftar di tenant Anda")
		}
		if reg.DeviceID != "" && strings.Contains(reg.DeviceID, "-") {
			targetDevID = reg.DeviceID
		}
	}
	err := s.client.RefreshDevice(ctx, targetDevID)
	if err == nil && s.client != nil {
		s.client.InvalidateCache()
	}
	return err
}

// calculateDeviceOnlineStatus determines if an ONT is currently online based on LastInform
// and the dynamic InformInterval (taking both device-reported and DB-configured values into account).
// It returns (isOnline, effectiveIntervalSec).
func (s *ACSService) calculateDeviceOnlineStatus(dev genieacs.DeviceSummary, regInformInterval int) (bool, int) {
	if dev.LastInform.IsZero() {
		return false, 300
	}

	effectiveInterval := 300
	if dev.InformInterval > 0 {
		effectiveInterval = dev.InformInterval
	} else if regInformInterval > 0 {
		effectiveInterval = regInformInterval
	}

	// Safety protection for idle ONTs:
	// If the device is running with a higher interval (e.g. 300s) than requested by DB (e.g. 60s),
	// or vice versa, honor the larger interval so an idle modem is not falsely marked offline!
	if dev.InformInterval > 0 && dev.InformInterval > effectiveInterval {
		effectiveInterval = dev.InformInterval
	}
	if regInformInterval > 0 && regInformInterval > effectiveInterval {
		effectiveInterval = regInformInterval
	}

	// Dynamic threshold calculation:
	// TR-069 periodic inform can have minor network latency, CWMP session queueing, or retry backoffs.
	// We give at least 1.5x interval or interval + 60s (whichever is larger), with a floor of 2 minutes.
	threshold := time.Duration(effectiveInterval)*time.Second + 60*time.Second
	if multThreshold := time.Duration(float64(effectiveInterval)*1.5) * time.Second; multThreshold > threshold {
		threshold = multThreshold
	}
	if threshold < 2*time.Minute {
		threshold = 2 * time.Minute
	}

	isOnline := time.Since(dev.LastInform) <= threshold
	return isOnline, effectiveInterval
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
			// Default heuristic for unassigned devices: 5.5 minutes (standard 300s inform + 30s jitter)
			if time.Since(t) <= 5*time.Minute+30*time.Second {
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

	// WAN Interfaces extraction across WANConnectionDevice 1..4 (both PPP and IP)
	for slot := 1; slot <= 4; slot++ {
		// 1. WAN PPP Connection (PPPoE / Bridged PPP)
		pppPrefix := fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.1", slot)
		pppUsername := findStringInTree(raw, []string{
			pppPrefix + ".Username",
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.2.Username", slot),
		})
		pppConnType := findStringInTree(raw, []string{
			pppPrefix + ".ConnectionType",
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.2.ConnectionType", slot),
		})
		pppStatus := findStringInTree(raw, []string{
			pppPrefix + ".ConnectionStatus",
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.2.ConnectionStatus", slot),
		})
		pppIP := findStringInTree(raw, []string{
			pppPrefix + ".ExternalIPAddress",
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.2.ExternalIPAddress", slot),
		})
		pppGateway := findStringInTree(raw, []string{pppPrefix + ".DefaultGateway"})
		pppDNS := findStringInTree(raw, []string{pppPrefix + ".DNSServers"})
		pppMAC := findStringInTree(raw, []string{pppPrefix + ".MACAddress"})
		pppName := findStringInTree(raw, []string{pppPrefix + ".Name"})
		pppNATStr := findStringInTree(raw, []string{pppPrefix + ".NATEnable"})
		pppServiceList := findStringInTree(raw, []string{pppPrefix + ".X_HW_ServiceList", pppPrefix + ".X_ZTE-COM_ServiceList"})

		vlanStr := findStringInTree(raw, []string{
			pppPrefix + ".X_HW_VLAN",
			pppPrefix + ".X_ZTE-COM_VLAN",
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANEthernetInterfaceConfig.VLANIDMark", slot),
		})
		vlanID, _ := strconv.Atoi(vlanStr)

		if pppUsername != "" || pppIP != "" || pppConnType != "" || pppName != "" {
			wanMode := "PPPoE"
			if strings.Contains(strings.ToUpper(pppConnType), "BRIDGE") {
				wanMode = "Bridge"
			}
			wanCfg := genieacs.WANConfig{
				Index:            slot,
				Name:             pppName,
				Mode:             wanMode,
				Username:         pppUsername,
				VLANID:           vlanID,
				ConnectionStatus: pppStatus,
				ExternalIP:       pppIP,
				DefaultGateway:   pppGateway,
				DNSServers:       pppDNS,
				MACAddress:       pppMAC,
				NATEnabled:       (pppNATStr == "1" || strings.EqualFold(pppNATStr, "true")),
				ServiceList:      pppServiceList,
				AddressingType:   "PPPoE",
			}
			dev.WANList = append(dev.WANList, wanCfg)
		}

		// 2. WAN IP Connection (DHCP / Static / IP_Bridged)
		ipPrefix := fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANIPConnection.1", slot)
		ipConnType := findStringInTree(raw, []string{ipPrefix + ".ConnectionType"})
		ipAddrType := findStringInTree(raw, []string{ipPrefix + ".AddressingType"})
		ipStatus := findStringInTree(raw, []string{ipPrefix + ".ConnectionStatus"})
		ipExtIP := findStringInTree(raw, []string{ipPrefix + ".ExternalIPAddress"})
		ipGateway := findStringInTree(raw, []string{ipPrefix + ".DefaultGateway"})
		ipDNS := findStringInTree(raw, []string{ipPrefix + ".DNSServers"})
		ipMAC := findStringInTree(raw, []string{ipPrefix + ".MACAddress"})
		ipName := findStringInTree(raw, []string{ipPrefix + ".Name"})
		ipNATStr := findStringInTree(raw, []string{ipPrefix + ".NATEnable"})

		if ipExtIP != "" || ipConnType != "" || ipAddrType != "" {
			wanMode := "IPoE"
			if strings.Contains(strings.ToUpper(ipConnType), "BRIDGE") {
				wanMode = "Bridge"
			}
			wanCfg := genieacs.WANConfig{
				Index:            slot + 10,
				Name:             ipName,
				Mode:             wanMode,
				VLANID:           vlanID,
				ConnectionStatus: ipStatus,
				ExternalIP:       ipExtIP,
				DefaultGateway:   ipGateway,
				DNSServers:       ipDNS,
				MACAddress:       ipMAC,
				NATEnabled:       (ipNATStr == "1" || strings.EqualFold(ipNATStr, "true")),
				AddressingType:   ipAddrType,
			}
			dev.WANList = append(dev.WANList, wanCfg)
		}
	}

	if len(dev.WANList) > 0 {
		dev.WAN = &dev.WANList[0]
		for i := range dev.WANList {
			if strings.EqualFold(dev.WANList[i].ConnectionStatus, "Connected") {
				dev.WAN = &dev.WANList[i]
				break
			}
		}
	}

	// External IP priority: Primary WAN IP -> candidate tree -> _ip fallback
	if dev.WAN != nil && dev.WAN.ExternalIP != "" {
		dev.IPAddress = dev.WAN.ExternalIP
	} else {
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
		ipVal := findIPInTree(raw, ipCandidates)
		if ipVal != "" {
			dev.IPAddress = ipVal
		} else {
			dev.IPAddress = getString(raw, "_ip")
		}
	}

	// MAC Address priority: Primary WAN MAC -> candidate tree
	if dev.WAN != nil && dev.WAN.MACAddress != "" {
		dev.MACAddress = dev.WAN.MACAddress
	} else {
		var macCandidates []string
		for slot := 1; slot <= 4; slot++ {
			macCandidates = append(macCandidates,
				fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.1.MACAddress", slot),
				fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANIPConnection.1.MACAddress", slot),
			)
		}
		macCandidates = append(macCandidates,
			"InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.1.MACAddress",
			"InternetGatewayDevice.LANDevice.1.LANHostConfigManagement.MACAddress",
			"InternetGatewayDevice.DeviceInfo.MACAddress",
			"InternetGatewayDevice.DeviceInfo.X_ZTE_COM_BaseMAC",
			"InternetGatewayDevice.DeviceInfo.X_HW_BaseMac",
			"Device.Ethernet.Interface.1.MACAddress",
		)
		dev.MACAddress = findStringInTree(raw, macCandidates)
	}

	// Optical Power (RX / TX in dBm)
	// Paths ordered: ZTE F609/F660 -> ZTE F460/ELWR -> Huawei -> Fiberhome -> Device.* (TR-181)
	rxStr := findStringInTree(raw, []string{
		// ZTE F609/F660 series
		"InternetGatewayDevice.WANDevice.1.X_ZTE-FTTH_WANPONInterfaceConfig.RXPower",
		// ZTE F460 / ELWRP series (uses X_ZTE_COM_ prefix)
		"InternetGatewayDevice.WANDevice.1.X_ZTE_COM_WANPONInterfaceConfig.RXPower",
		"InternetGatewayDevice.WANDevice.1.X_ZTE_COM_WANPONInterfaceConfig.ReceivedOpticalPower",
		// Huawei (including firmware typo 'Interafce' and standard 'Interface')
		"InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower",
		"InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.RXPower",
		"InternetGatewayDevice.WANDevice.1.X_HW_DEBUG.SMP.OPTIC.RxPower",
		"InternetGatewayDevice.WANDevice.1.X_HuaweiManagerServer.LoopInfo.ReceiveOpticalPower",
		"InternetGatewayDevice.WANDevice.1.X_HW_PON_INTERFACECONFIG.RXPower",
		// Fiberhome / VSOL
		"InternetGatewayDevice.WANDevice.1.X_FH_PON.RXPower",
		"InternetGatewayDevice.WANDevice.1.X_CMCC_ONU.PON.RXPower",
		// TR-181 standard
		"Device.Optical.Interface.1.RxPower",
	})
	if rxStr != "" {
		if f, err := strconv.ParseFloat(rxStr, 64); err == nil {
			// Some ONTs report raw int like -1950 meaning -19.50 dBm
			// or raw like -19500 meaning -19.500 dBm (millidBm)
			switch {
			case math.Abs(f) > 10000:
				f = f / 1000.0
			case math.Abs(f) > 100:
				f = f / 100.0
			}
			dev.RxPowerDBm = &f
		}
	}

	txStr := findStringInTree(raw, []string{
		// ZTE F609/F660 series
		"InternetGatewayDevice.WANDevice.1.X_ZTE-FTTH_WANPONInterfaceConfig.TXPower",
		// ZTE F460 / ELWRP series
		"InternetGatewayDevice.WANDevice.1.X_ZTE_COM_WANPONInterfaceConfig.TXPower",
		"InternetGatewayDevice.WANDevice.1.X_ZTE_COM_WANPONInterfaceConfig.TransmitOpticalPower",
		// Huawei (including firmware typo 'Interafce' and standard 'Interface')
		"InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TXPower",
		"InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.TXPower",
		"InternetGatewayDevice.WANDevice.1.X_HW_DEBUG.SMP.OPTIC.TxPower",
		"InternetGatewayDevice.WANDevice.1.X_HW_PON_INTERFACECONFIG.TXPower",
		// Fiberhome / VSOL
		"InternetGatewayDevice.WANDevice.1.X_FH_PON.TXPower",
		"InternetGatewayDevice.WANDevice.1.X_CMCC_ONU.PON.TXPower",
		// TR-181 standard
		"Device.Optical.Interface.1.TxPower",
	})
	if txStr != "" {
		if f, err := strconv.ParseFloat(txStr, 64); err == nil {
			switch {
			case math.Abs(f) > 10000:
				f = f / 1000.0
			case math.Abs(f) > 100:
				f = f / 100.0
			}
			dev.TxPowerDBm = &f
		}
	}

	// Optical Transceiver / Device Temperature (in °C)
	tempStr := findStringInTree(raw, []string{
		// ZTE F609/F660/F460
		"InternetGatewayDevice.WANDevice.1.X_ZTE-FTTH_WANPONInterfaceConfig.TransceiverTemperature",
		"InternetGatewayDevice.WANDevice.1.X_ZTE_COM_WANPONInterfaceConfig.TransceiverTemperature",
		"InternetGatewayDevice.WANDevice.1.X_ZTE-FTTH_WANPONInterfaceConfig.Temperature",
		"InternetGatewayDevice.DeviceInfo.MemoryStatus.Temperature",
		"InternetGatewayDevice.DeviceInfo.X_ZTE_COM_DeviceInfo.Temperature",
		"InternetGatewayDevice.DeviceInfo.Temperature",
		// Huawei
		"InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.TransceiverTemperature",
		"InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TransceiverTemperature",
		"InternetGatewayDevice.WANDevice.1.X_HW_DEBUG.SMP.OPTIC.Temperature",
		"InternetGatewayDevice.WANDevice.1.X_HW_PON_INTERFACECONFIG.TransceiverTemperature",
		// Fiberhome / VSOL / CMCC
		"InternetGatewayDevice.WANDevice.1.X_FH_PON.TransceiverTemperature",
		"InternetGatewayDevice.WANDevice.1.X_CMCC_ONU.PON.TransceiverTemperature",
		"InternetGatewayDevice.WANDevice.1.X_CMCC_ONU.PON.Temperature",
		// TR-181 standard
		"Device.Optical.Interface.1.TransceiverTemperature",
		"Device.DeviceInfo.TemperatureStatus.TemperatureSensor.1.Value",
	})
	if tempStr != "" {
		if f, err := strconv.ParseFloat(tempStr, 64); err == nil {
			switch {
			case math.Abs(f) > 1000:
				f = f / 1000.0 // millidegrees (e.g. 45000 -> 45.0 °C)
			case math.Abs(f) > 150:
				f = f / 100.0 // 1/100 degrees (e.g. 4500 -> 45.0 °C)
			}
			if f >= -20 && f <= 125 {
				dev.TemperatureCelsius = &f
			}
		}
	}

	// Optical Transceiver Supply Voltage (in Volts)
	voltStr := findStringInTree(raw, []string{
		// ZTE F609/F660/F460
		"InternetGatewayDevice.WANDevice.1.X_ZTE-FTTH_WANPONInterfaceConfig.TransceiverVoltage",
		"InternetGatewayDevice.WANDevice.1.X_ZTE_COM_WANPONInterfaceConfig.TransceiverVoltage",
		"InternetGatewayDevice.WANDevice.1.X_ZTE-FTTH_WANPONInterfaceConfig.SupplyVoltage",
		// Huawei
		"InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.TransceiverSupplyVoltage",
		"InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TransceiverSupplyVoltage",
		"InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.TransceiverVoltage",
		"InternetGatewayDevice.WANDevice.1.X_HW_DEBUG.SMP.OPTIC.Voltage",
		"InternetGatewayDevice.WANDevice.1.X_HW_PON_INTERFACECONFIG.TransceiverSupplyVoltage",
		// Fiberhome / VSOL / CMCC
		"InternetGatewayDevice.WANDevice.1.X_FH_PON.TransceiverVoltage",
		"InternetGatewayDevice.WANDevice.1.X_CMCC_ONU.PON.TransceiverVoltage",
		// TR-181 standard
		"Device.Optical.Interface.1.TransceiverSupplyVoltage",
		"Device.Optical.Interface.1.TransceiverVoltage",
	})
	if voltStr != "" {
		if f, err := strconv.ParseFloat(voltStr, 64); err == nil {
			switch {
			case f > 10000:
				f = f / 10000.0 // 100 uV (e.g. 33000 -> 3.3V)
			case f > 50:
				f = f / 1000.0 // mV (e.g. 3300 -> 3.3V)
			}
			if f >= 0.5 && f <= 15.0 {
				dev.VoltageVolts = &f
			}
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
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.X_HW_RadioEnable", slot),
			fmt.Sprintf("Device.WiFi.Radio.%d.Enable", slot),
		})
		statusStr := findStringInTree(raw, []string{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.Status", slot),
			fmt.Sprintf("Device.WiFi.SSID.%d.Status", slot),
		})
		bssid := findStringInTree(raw, []string{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.BSSID", slot),
			fmt.Sprintf("Device.WiFi.SSID.%d.BSSID", slot),
		})

		// Determine enabled state:
		// 1. If Enable/_value was fetched: use it ("1", "true" = on)
		// 2. If Status was fetched: "Up" = enabled
		// 3. If neither was fetched (both empty) but SSID name exists: assume enabled
		var isEnabled bool
		if enableStr != "" {
			isEnabled = (enableStr == "1" || strings.EqualFold(enableStr, "true"))
		} else if statusStr != "" {
			isEnabled = strings.EqualFold(statusStr, "Up")
		} else {
			// No enable/status data fetched yet, but SSID exists → assume enabled
			isEnabled = true
		}

		secMode := findStringInTree(raw, []string{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.BeaconType", slot),
			fmt.Sprintf("Device.WiFi.AccessPoint.%d.Security.ModeEnabled", slot),
		})
		encMode := findStringInTree(raw, []string{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.WPAEncryptionModes", slot),
		})
		chStr := findStringInTree(raw, []string{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.Channel", slot),
			fmt.Sprintf("Device.WiFi.Radio.%d.Channel", slot),
		})
		chVal, _ := strconv.Atoi(chStr)

		dev.SSIDList = append(dev.SSIDList, genieacs.WiFiSSID{
			Index:        slot,
			SSID:         ssidName,
			Enabled:      isEnabled,
			BSSID:        bssid,
			SecurityMode: secMode,
			Encryption:   encMode,
			Channel:      chVal,
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

	// WiFi Password extraction across multiple vendors (TR-098 & TR-181)
	dev.WiFiPassword = findStringInTree(raw, []string{
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase",
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.X_ZTE-COM_KeyPassphrase",
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey",
		"Device.WiFi.AccessPoint.1.Security.KeyPassphrase",
	})

	dev.SecurityMode = findStringInTree(raw, []string{
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.BeaconType",
		"Device.WiFi.AccessPoint.1.Security.ModeEnabled",
	})
	if chStr := findStringInTree(raw, []string{
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Channel",
		"Device.WiFi.Radio.1.Channel",
	}); chStr != "" {
		dev.WiFiChannel, _ = strconv.Atoi(chStr)
	}
	if pwrStr := findStringInTree(raw, []string{
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TransmitPower",
		"Device.WiFi.Radio.1.TransmitPower",
	}); pwrStr != "" {
		dev.WiFiTxPower, _ = strconv.Atoi(pwrStr)
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

	// Uptime (seconds since boot)
	rawUptime, _ := findUptimeInTree(raw, []string{
		"InternetGatewayDevice.DeviceInfo.UpTime",
		"Device.DeviceInfo.UpTime",
		// ZTE F460/ELWR sometimes uses X_ZTE_COM prefix
		"InternetGatewayDevice.DeviceInfo.X_ZTE_COM_DeviceInfo.UpTime",
		"InternetGatewayDevice.X_ZTE_COM_DeviceInfo.UpTime",
	})
	if rawUptime > 0 {
		dev.UptimeSeconds = rawUptime
	}
	// Periodic Inform Interval extraction from device parameter tree (TR-098 & TR-181)
	intervalStr := findStringInTree(raw, []string{
		"InternetGatewayDevice.ManagementServer.PeriodicInformInterval",
		"Device.ManagementServer.PeriodicInformInterval",
	})
	if intervalStr != "" {
		if v, err := strconv.Atoi(intervalStr); err == nil && v > 0 {
			dev.InformInterval = v
		}
	}

	return dev
}

// isNonONTDevice returns true for GenieACS internal discovery entries
// that are not real ONT/CPE devices (e.g. CWMP discovery service proxies).
func isNonONTDevice(dev genieacs.DeviceSummary) bool {
	id := strings.ToUpper(dev.ID)
	// GenieACS discovery service creates entries with IDs like
	// "000000-DISCOVERYSERVICE" or "00259E-DISCOVERYSERVICE-..."
	if strings.Contains(id, "DISCOVERYSERVICE") {
		return true
	}
	// Also skip devices where both ProductClass and Manufacturer are empty
	// AND the ID looks like a service identifier (all uppercase letters/digits, no dash pattern)
	if dev.ProductClass == "" && dev.Manufacturer == "" && dev.SerialNumber == dev.ID {
		return true
	}
	return false
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

// findStringInTree searches for the first non-empty value across multiple paths.
// If a path exists but has no valid _value, it continues to the next path instead of aborting.
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
					strVal := strings.TrimSpace(fmt.Sprintf("%v", v))
					if strVal != "" && strVal != "<nil>" {
						return strVal
					}
				}
				// If leaf has metadata keys (_object, _writable) but no valid _value,
				// do NOT abort! Continue searching the next candidate path.
				continue
			}
			strVal := strings.TrimSpace(fmt.Sprintf("%v", current))
			if strVal != "" && strVal != "<nil>" {
				return strVal
			}
		}
	}
	return ""
}

// findIPInTree searches across candidates for a valid IP address.
// It skips empty strings and "0.0.0.0", and extracts the host if a URL is provided.
func findIPInTree(m map[string]interface{}, paths []string) string {
	for _, p := range paths {
		val := findStringInTree(m, []string{p})
		if val == "" || val == "0.0.0.0" {
			continue
		}
		if strings.HasPrefix(val, "http://") || strings.HasPrefix(val, "https://") {
			if u, err := url.Parse(val); err == nil {
				host := u.Hostname()
				if host != "" && host != "0.0.0.0" {
					return host
				}
			}
			continue
		}
		return val
	}
	return ""
}

// findUptimeInTree searches for UpTime across paths, returning the raw seconds and its snapshot timestamp.
func findUptimeInTree(m map[string]interface{}, paths []string) (int64, time.Time) {
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
			if leafMap, ok := current.(map[string]interface{}); ok {
				if v, ok := leafMap["_value"]; ok && v != nil {
					var rawSec int64
					var parsed bool
					strVal := strings.TrimSpace(fmt.Sprintf("%v", v))
					if u, err := strconv.ParseInt(strVal, 10, 64); err == nil {
						rawSec = u
						parsed = true
					} else if f, err := strconv.ParseFloat(strVal, 64); err == nil {
						rawSec = int64(f)
						parsed = true
					}
					if parsed && rawSec > 0 {
						var t time.Time
						if tsStr, ok := leafMap["_timestamp"].(string); ok && tsStr != "" {
							if parsedTime, err := time.Parse(time.RFC3339Nano, tsStr); err == nil {
								t = parsedTime
							}
						}
						return rawSec, t
					}
				}
				continue
			}
		}
	}
	return 0, time.Time{}
}

// extractPPPoEUsername searches for WAN PPPoE username configured on the ONT device.
func extractPPPoEUsername(raw map[string]interface{}) string {
	var candidates []string
	for slot := 1; slot <= 4; slot++ {
		candidates = append(candidates,
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.1.Username", slot),
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.2.Username", slot),
			fmt.Sprintf("Device.PPP.Interface.%d.Username", slot),
		)
	}
	candidates = append(candidates,
		"Device.IP.Interface.1.Username",
	)
	return findStringInTree(raw, candidates)
}
