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

			// Dynamic +30s tolerance threshold
			intervalSec := reg.InformInterval
			if intervalSec <= 0 {
				intervalSec = 300
			}
			threshold := time.Duration(intervalSec+30) * time.Second
			isOnlineNow := !dev.LastInform.IsZero() && time.Since(dev.LastInform) <= threshold

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
			dev.InformInterval = intervalSec

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

		intervalSec := reg.InformInterval
		if intervalSec <= 0 {
			intervalSec = 300
		}
		threshold := time.Duration(intervalSec+30) * time.Second
		isOnlineNow := !dev.LastInform.IsZero() && time.Since(dev.LastInform) <= threshold

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
		dev.InformInterval = intervalSec

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

// SetWiFi configures WiFi SSID and Password on ONT after verifying tenant ownership.
// If slot is <= 0, it defaults to 1.
func (s *ACSService) SetWiFi(ctx context.Context, tenantID uuid.UUID, deviceID string, slot int, ssid, password string) error {
	if slot <= 0 {
		slot = 1
	}
	ssid = strings.TrimSpace(ssid)
	password = strings.TrimSpace(password)
	if ssid == "" {
		return fmt.Errorf("nama SSID tidak boleh kosong")
	}
	if password != "" && len(password) < 8 {
		return fmt.Errorf("password WiFi minimal 8 karakter")
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
		if password != "" {
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("Device.WiFi.AccessPoint.%d.Security.KeyPassphrase", slot), password, "xsd:string",
			})
		}
	} else if hasDirectKey {
		// Older ZTE (F460, F401, etc.)
		paramValues = append(paramValues, []interface{}{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.SSID", slot), ssid, "xsd:string",
		})
		if password != "" {
			paramValues = append(paramValues, []interface{}{
				directKeyPath, password, "xsd:string",
			})
		}
	} else if hasZteDirectKey {
		paramValues = append(paramValues, []interface{}{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.SSID", slot), ssid, "xsd:string",
		})
		if password != "" {
			paramValues = append(paramValues, []interface{}{
				zteDirectKeyPath, password, "xsd:string",
			})
		}
	} else {
		// Standard TR-098 (F609/F660, Huawei, Fiberhome, VSOL)
		paramValues = append(paramValues, []interface{}{
			fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.SSID", slot), ssid, "xsd:string",
		})
		if password != "" {
			paramValues = append(paramValues, []interface{}{
				fmt.Sprintf("InternetGatewayDevice.LANDevice.1.WLANConfiguration.%d.PreSharedKey.1.KeyPassphrase", slot), password, "xsd:string",
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

	intervalStr := strconv.Itoa(intervalSeconds)

	// TR-098 path (most ONTs: Huawei, ZTE, Fiberhome)
	// TR-181 path as fallback (newer devices)
	paramValues := [][]interface{}{
		{"InternetGatewayDevice.ManagementServer.PeriodicInformInterval", intervalStr, "xsd:unsignedInt"},
		{"InternetGatewayDevice.ManagementServer.PeriodicInformEnable", "1", "xsd:boolean"},
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
			// Default heuristic for unassigned devices without DB records: 3 minutes
			if time.Since(t) <= 3*time.Minute {
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
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.2.ExternalIPAddress", slot),
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANIPConnection.1.ExternalIPAddress", slot),
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANIPConnection.2.ExternalIPAddress", slot),
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

	var macCandidates []string
	for slot := 1; slot <= 4; slot++ {
		macCandidates = append(macCandidates,
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.1.MACAddress", slot),
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANPPPConnection.2.MACAddress", slot),
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANIPConnection.1.MACAddress", slot),
			fmt.Sprintf("InternetGatewayDevice.WANDevice.1.WANConnectionDevice.%d.WANIPConnection.2.MACAddress", slot),
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

	// WiFi Password extraction across multiple vendors (TR-098 & TR-181)
	dev.WiFiPassword = findStringInTree(raw, []string{
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase",
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.X_ZTE-COM_KeyPassphrase",
		"InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey",
		"Device.WiFi.AccessPoint.1.Security.KeyPassphrase",
	})

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
