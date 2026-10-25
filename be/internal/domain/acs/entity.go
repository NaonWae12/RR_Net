package acs

import (
	"time"

	"github.com/google/uuid"
)

// DeviceTenant represents the mapping between a tenant and an ACS/ONT device.
type DeviceTenant struct {
	ID           uuid.UUID  `json:"id"`
	TenantID     uuid.UUID  `json:"tenant_id"`
	DeviceID     string     `json:"device_id"`
	SerialNumber string     `json:"serial_number,omitempty"`
	Label        string     `json:"label,omitempty"`
	ClientID     *uuid.UUID `json:"client_id,omitempty"`
	ClientName    string     `json:"client_name,omitempty"`
	WiFiSSID      string     `json:"wifi_ssid,omitempty"`
	WiFiPassword  string     `json:"wifi_password,omitempty"`
	WiFiUpdatedAt *time.Time `json:"wifi_updated_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}
