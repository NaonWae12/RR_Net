package voucher

import (
	"time"

	"github.com/google/uuid"
)

// Rate limit mode constants
const (
	RateLimitModeFullRadius = "full_radius"      // Rate limit sent via RADIUS attributes
	RateLimitModeAuthOnly   = "radius_auth_only" // Rate limit configured via MikroTik Hotspot profiles
)

type VoucherPackage struct {
	ID            uuid.UUID `json:"id"`
	TenantID      uuid.UUID `json:"tenant_id"`
	Name          string    `json:"name"`
	Description   string    `json:"description,omitempty"`
	DownloadSpeed int       `json:"download_speed"` // Kbps
	UploadSpeed   int       `json:"upload_speed"`   // Kbps
	DurationHours *int      `json:"duration_hours,omitempty"`
	QuotaMB       *int      `json:"quota_mb,omitempty"`
	Price         float64   `json:"price"`
	Currency      string    `json:"currency"`
	RateLimitMode  string    `json:"rate_limit_mode"` // full_radius or radius_auth_only
	IsActive       bool      `json:"is_active"`
	ExpirationMode string    `json:"expiration_mode"` // "wall_clock" or "uptime_limit"

	// Max usage limit (in seconds, NULL = unlimited)
	MaxUptimeSeconds *int `json:"max_uptime_seconds,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type VoucherStatus string

const (
	VoucherStatusActive  VoucherStatus = "active"
	VoucherStatusUsed    VoucherStatus = "used"
	VoucherStatusExpired VoucherStatus = "expired"
	VoucherStatusRevoked VoucherStatus = "revoked"
)

type Voucher struct {
	ID                 uuid.UUID     `json:"id"`
	TenantID           uuid.UUID     `json:"tenant_id"`
	PackageID          uuid.UUID     `json:"package_id"`
	RouterID           *uuid.UUID    `json:"router_id,omitempty"`
	Code               string        `json:"code"`
	Password           string        `json:"password"`
	Status             VoucherStatus `json:"status"`
	Isolated           bool          `json:"isolated"` // Whether user is isolated (blocked from internet)
	SharedUsers        int           `json:"shared_users"`
	UsedAt             *time.Time    `json:"used_at,omitempty"`
	ExpiresAt          *time.Time    `json:"expires_at,omitempty"`
	FirstSessionID     *uuid.UUID    `json:"first_session_id,omitempty"`
	Notes              string        `json:"notes,omitempty"`
	ResellerPurchaseID *uuid.UUID    `json:"reseller_purchase_id,omitempty"`
	
	// Denormalized Uptime & Usage (updated by accounting)
	TotalUptimeSeconds int   `json:"total_uptime_seconds"`
	TotalBytesUsed      int64 `json:"total_bytes_used"`

	CreatedAt          time.Time     `json:"created_at"`
	UpdatedAt          time.Time     `json:"updated_at"`

	// Joined fields (optional, populated by repository)
	PackageName  *string  `json:"package_name,omitempty"`
	PackagePrice *float64 `json:"package_price,omitempty"`
	RouterName   *string  `json:"router_name,omitempty"`
	ExpirationMode string `json:"expiration_mode"`
}

type VoucherUsage struct {
	ID              uuid.UUID  `json:"id"`
	VoucherID       uuid.UUID  `json:"voucher_id"`
	RouterID        *uuid.UUID `json:"router_id,omitempty"`
	SessionID       string     `json:"session_id,omitempty"`
	BytesIn         int64      `json:"bytes_in"`
	BytesOut        int64      `json:"bytes_out"`
	PacketsIn       int64      `json:"packets_in"`
	PacketsOut      int64      `json:"packets_out"`
	SessionStart    time.Time  `json:"session_start"`
	SessionStop     *time.Time `json:"session_stop,omitempty"`
	DurationSeconds *int       `json:"duration_seconds,omitempty"`
	TerminateCause  string     `json:"terminate_cause,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}
