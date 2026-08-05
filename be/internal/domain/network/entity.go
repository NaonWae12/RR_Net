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
	RouterStatusProvisioning   RouterStatus = "provisioning"
	RouterStatusDecommissioning RouterStatus = "decommissioning"
	RouterStatusRevoked        RouterStatus = "revoked"
)

// RouterConnectivityMode defines how ERP reaches router management API
// - direct_public: router exposes management API publicly (DDNS + port forwarding)
// - vpn: router is reachable over a private VPN network
type RouterConnectivityMode string

const (
	RouterConnectivityModeDirectPublic RouterConnectivityMode = "direct_public"
	RouterConnectivityModeVPN          RouterConnectivityMode = "vpn"      // L2TP/IPsec
	RouterConnectivityModeVPNSSTP      RouterConnectivityMode = "vpn_sstp" // SSTP (Port 443/4443)
)

// BrandingConfig holds custom labels and DNS names for voucher design
type BrandingConfig struct {
	DNSNames           []string `json:"dns_names"`
	Labels             []string `json:"labels"`
	SelectedDesignSlug string   `json:"selected_design_slug"`
}

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
	DNSName             string                 `json:"dns_name,omitempty"`
	BrandingConfig      *BrandingConfig        `json:"branding_config,omitempty"`
	IdleTimeout         int                    `json:"idle_timeout"`
	InterimInterval     int                    `json:"interim_interval"`
	CreatedAt           time.Time              `json:"created_at"`
	UpdatedAt           time.Time              `json:"updated_at"`
	DeletedAt           *time.Time             `json:"deleted_at,omitempty"`
}

// NetworkProfile represents a bandwidth/QoS profile
type NetworkProfile struct {
	ID            uuid.UUID  `json:"id"`
	TenantID      uuid.UUID  `json:"tenant_id"`
	RouterID      *uuid.UUID `json:"router_id,omitempty"`
	Name          string     `json:"name"`
	Description   *string    `json:"description,omitempty"`
	DownloadSpeed int        `json:"download_speed"` // in Kbps
	UploadSpeed   int        `json:"upload_speed"`   // in Kbps
	BurstDownload int        `json:"burst_download,omitempty"`
	BurstUpload   int        `json:"burst_upload,omitempty"`
	Priority      int        `json:"priority"`
	SharedUsers   int        `json:"shared_users,omitempty"`
	AddressPool   *string    `json:"address_pool,omitempty"`
	LocalAddress  *string    `json:"local_address,omitempty"`
	RemoteAddress *string    `json:"remote_address,omitempty"`
	DNSServers    *string    `json:"dns_servers,omitempty"`
	IsActive      bool       `json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// RouterDecommissionTask represents a synchronization task during router removal
type RouterDecommissionTaskStatus string

const (
	DecommissionTaskPending    RouterDecommissionTaskStatus = "pending"
	DecommissionTaskProcessing RouterDecommissionTaskStatus = "processing"
	DecommissionTaskCompleted  RouterDecommissionTaskStatus = "completed"
	DecommissionTaskFailed     RouterDecommissionTaskStatus = "failed"
)

type RouterDecommissionTaskType string

const (
	DecommissionTaskVoucher      RouterDecommissionTaskType = "voucher"     // Hotspot/Radius
	DecommissionTaskPPPoE        RouterDecommissionTaskType = "pppoe"       // PPPoE Secret
	DecommissionTaskActiveSession RouterDecommissionTaskType = "active_session" // Kick active users
)

type RouterDecommissionTask struct {
	ID             uuid.UUID                    `json:"id"`
	RouterID       uuid.UUID                    `json:"router_id"`
	TargetRouterID *uuid.UUID                   `json:"target_router_id,omitempty"` // NULL if deleting global-bound
	TaskType       RouterDecommissionTaskType   `json:"task_type"`
	ReferenceID    uuid.UUID                    `json:"reference_id"` // ID of Voucher or PPPoESecret
	Status         RouterDecommissionTaskStatus `json:"status"`
	ErrorMessage   string                       `json:"error_message,omitempty"`
	Attempt        int                          `json:"attempt"`
	CreatedAt      time.Time                    `json:"created_at"`
	UpdatedAt      time.Time                    `json:"updated_at"`
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

// PPPoEIPSettings represents IP pool & gateway configuration for PPPoE secrets
type PPPoEIPSettings struct {
	ID           uuid.UUID  `json:"id"`
	TenantID     uuid.UUID  `json:"tenant_id"`
	RouterID     *uuid.UUID `json:"router_id,omitempty"`
	LocalAddress string     `json:"local_address"`
	PoolStart    string     `json:"pool_start"`
	PoolEnd      string     `json:"pool_end"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
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
type DecommissionPreview struct {
	PPPoECount     int      `json:"pppoe_count"`
	VoucherCount   int      `json:"voucher_count"`
	PPPoEUsernames []string `json:"pppoe_usernames"`
	VoucherCodes   []string `json:"voucher_codes"`
}

// RouterDeletePreview is an alias for UI clarity
type RouterDeletePreview = DecommissionPreview
