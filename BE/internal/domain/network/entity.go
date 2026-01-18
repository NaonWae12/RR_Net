package network

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// RouterType defines the type of network router
type RouterType string

const (
	RouterTypeMikroTik RouterType = "mikrotik"
	RouterTypeCisco    RouterType = "cisco"
	RouterTypeUbiquiti RouterType = "ubiquiti"
	RouterTypeOther    RouterType = "other"
)

// RouterStatus defines the status of a router
type RouterStatus string

const (
	RouterStatusOnline       RouterStatus = "online"
	RouterStatusOffline      RouterStatus = "offline"
	RouterStatusMaintenance  RouterStatus = "maintenance"
	RouterStatusProvisioning RouterStatus = "provisioning"
)

// RouterConnectivityMode defines how ERP reaches router management API
// - direct_public: router exposes management API publicly (DDNS + port forwarding)
// - vpn: router is reachable over a private VPN network
type RouterConnectivityMode string

const (
	RouterConnectivityModeDirectPublic RouterConnectivityMode = "direct_public"
	RouterConnectivityModeVPN          RouterConnectivityMode = "vpn"
)

// Router represents a network router device
type Router struct {
	ID                  uuid.UUID              `json:"id"`
	TenantID            uuid.UUID              `json:"tenant_id"`
	Name                string                 `json:"name"`
	Description         string                 `json:"description,omitempty"`
	Type                RouterType             `json:"type"`
	Host                string                 `json:"host"`
	NASIdentifier       string                 `json:"nas_identifier,omitempty"`
	NASIP               string                 `json:"nas_ip,omitempty"`
	Port                int                    `json:"port"`
	Username            string                 `json:"username"`
	Password            string                 `json:"-"` // Never expose password
	APIPort             int                    `json:"api_port,omitempty"`
	APIUseTLS           bool                   `json:"api_use_tls"`
	ConnectivityMode    RouterConnectivityMode `json:"connectivity_mode"`
	Status              RouterStatus           `json:"status"`
	LastSeen            *time.Time             `json:"last_seen,omitempty"`
	IsDefault           bool                   `json:"is_default"`
	RadiusEnabled       bool                   `json:"radius_enabled"`
	RadiusSecret        string                 `json:"-"` // Never expose radius secret
	RemoteAccessEnabled bool                   `json:"remote_access_enabled"`
	RemoteAccessPort    int                    `json:"remote_access_port,omitempty"`
	VPNUsername         string                 `json:"vpn_username,omitempty"`
	VPNPassword         string                 `json:"vpn_password,omitempty"`
	VPNScript           string                 `json:"vpn_script,omitempty"`
	CreatedAt           time.Time              `json:"created_at"`
	UpdatedAt           time.Time              `json:"updated_at"`
}

// NetworkProfile represents a bandwidth/QoS profile
type NetworkProfile struct {
	ID            uuid.UUID `json:"id"`
	TenantID      uuid.UUID `json:"tenant_id"`
	Name          string    `json:"name"`
	Description   *string   `json:"description,omitempty"`
	DownloadSpeed int       `json:"download_speed"` // in Kbps
	UploadSpeed   int       `json:"upload_speed"`   // in Kbps
	BurstDownload int       `json:"burst_download,omitempty"`
	BurstUpload   int       `json:"burst_upload,omitempty"`
	Priority      int       `json:"priority"`
	SharedUsers   int       `json:"shared_users,omitempty"`
	AddressPool   *string   `json:"address_pool,omitempty"`
	LocalAddress  *string   `json:"local_address,omitempty"`
	RemoteAddress *string   `json:"remote_address,omitempty"`
	DNSServers    *string   `json:"dns_servers,omitempty"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// PPPoESecret represents a PPPoE user account
type PPPoESecret struct {
	ID              uuid.UUID  `json:"id"`
	TenantID        uuid.UUID  `json:"tenant_id"`
	ClientID        uuid.UUID  `json:"client_id"`
	RouterID        uuid.UUID  `json:"router_id"`
	Username        string     `json:"username"`
	Password        string     `json:"-"` // Never expose password
	ProfileID       uuid.UUID  `json:"profile_id"`
	Service         string     `json:"service,omitempty"`
	CallerID        string     `json:"caller_id,omitempty"`
	RemoteAddress   string     `json:"remote_address,omitempty"`
	LocalAddress    string     `json:"local_address,omitempty"`
	Comment         string     `json:"comment,omitempty"`
	IsDisabled      bool       `json:"is_disabled"`
	LastConnectedAt *time.Time `json:"last_connected_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ConnectionStatus represents current PPPoE connection status
type ConnectionStatus string

const (
	ConnectionStatusConnected    ConnectionStatus = "connected"
	ConnectionStatusDisconnected ConnectionStatus = "disconnected"
	ConnectionStatusUnknown      ConnectionStatus = "unknown"
)

// ActiveConnection represents an active PPPoE connection
type ActiveConnection struct {
	ID          string           `json:"id"`
	Username    string           `json:"username"`
	Service     string           `json:"service"`
	CallerID    string           `json:"caller_id"`
	Address     string           `json:"address"`
	Uptime      string           `json:"uptime"`
	BytesIn     int64            `json:"bytes_in"`
	BytesOut    int64            `json:"bytes_out"`
	PacketsIn   int64            `json:"packets_in"`
	PacketsOut  int64            `json:"packets_out"`
	Status      ConnectionStatus `json:"status"`
	ConnectedAt time.Time        `json:"connected_at"`
}

// IPPool represents an IP address pool
type IPPool struct {
	ID        uuid.UUID `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	RouterID  uuid.UUID `json:"router_id"`
	Name      string    `json:"name"`
	Ranges    string    `json:"ranges"` // e.g., "192.168.1.10-192.168.1.100"
	NextPool  string    `json:"next_pool,omitempty"`
	Comment   string    `json:"comment,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// FormatSpeed formats speed in human readable format
func FormatSpeed(kbps int) string {
	if kbps >= 1000 {
		return fmt.Sprintf("%d Mbps", kbps/1000)
	}
	return fmt.Sprintf("%d Kbps", kbps)
}
