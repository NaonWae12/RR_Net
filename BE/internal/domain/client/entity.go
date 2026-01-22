package client

import (
	"encoding/json"
	"net"
	"time"

	"github.com/google/uuid"
)

type Category string

const (
	CategoryRegular    Category = "regular"
	CategoryBusiness   Category = "business"
	CategoryEnterprise Category = "enterprise"
	CategoryLite       Category = "lite"
)

// Status represents client status
type Status string

const (
	StatusActive     Status = "active"
	StatusIsolir     Status = "isolir"     // Suspended for payment
	StatusSuspended  Status = "suspended"  // Admin action
	StatusTerminated Status = "terminated" // Cancelled
)

// Client represents an ISP end-user/subscriber
type Client struct {
	ID          uuid.UUID       `json:"id"`
	TenantID    uuid.UUID       `json:"tenant_id"`
	UserID      *uuid.UUID      `json:"user_id,omitempty"` // Optional login account
	ClientCode  string          `json:"client_code"`
	Name        string          `json:"name"`
	Email       *string         `json:"email,omitempty"`
	Phone       *string         `json:"phone,omitempty"`
	Address     *string         `json:"address,omitempty"`
	Latitude    *float64        `json:"latitude,omitempty"`
	Longitude   *float64        `json:"longitude,omitempty"`
	ODPID       *uuid.UUID      `json:"odp_id,omitempty"`
	GroupID     *uuid.UUID      `json:"group_id,omitempty"`
	DiscountID  *uuid.UUID      `json:"discount_id,omitempty"`

	// Service (new model)
	Category         Category   `json:"category"`
	ServicePackageID *uuid.UUID `json:"service_package_id,omitempty"`
	DeviceCount      *int       `json:"device_count,omitempty"` // Lite only
	PPPoEPasswordEnc *string    `json:"-"`                      // Encrypted-at-rest, never exposed
	PPPoEPasswordUpdatedAt *time.Time `json:"-"`

	ServicePlan *string         `json:"service_plan,omitempty"`
	SpeedProfile *string        `json:"speed_profile,omitempty"`
	MonthlyFee  float64         `json:"monthly_fee"`
	BillingDate *int            `json:"billing_date,omitempty"`

	// Payment tempo (new)
	PaymentTempoOption     string     `json:"payment_tempo_option"` // default|template|manual
	PaymentDueDay          int        `json:"payment_due_day"`      // 1-31
	PaymentTempoTemplateID *uuid.UUID `json:"payment_tempo_template_id,omitempty"`

	Status      Status          `json:"status"`
	IsolirReason *string        `json:"isolir_reason,omitempty"`
	IsolirAt    *time.Time      `json:"isolir_at,omitempty"`
	PPPoEUsername *string       `json:"pppoe_username,omitempty"`
	IPAddress   *net.IP         `json:"ip_address,omitempty"`
	MACAddress  *string         `json:"mac_address,omitempty"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	DeletedAt   *time.Time      `json:"deleted_at,omitempty"`
}

// IsActive checks if client is active
func (c *Client) IsActive() bool {
	return c.Status == StatusActive && c.DeletedAt == nil
}

// CanBeIsolated checks if client can be isolated
func (c *Client) CanBeIsolated() bool {
	return c.Status == StatusActive
}

// CanBeReactivated checks if client can be reactivated
func (c *Client) CanBeReactivated() bool {
	return c.Status == StatusIsolir || c.Status == StatusSuspended
}

// ValidStatusTransitions defines allowed status transitions
var ValidStatusTransitions = map[Status][]Status{
	StatusActive:     {StatusIsolir, StatusSuspended, StatusTerminated},
	StatusIsolir:     {StatusActive, StatusTerminated},
	StatusSuspended:  {StatusActive, StatusTerminated},
	StatusTerminated: {}, // Terminal state
}

// CanTransitionTo checks if a status transition is valid
func (c *Client) CanTransitionTo(newStatus Status) bool {
	allowed, ok := ValidStatusTransitions[c.Status]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == newStatus {
			return true
		}
	}
	return false
}

// ClientListFilter represents filters for listing clients
type ClientListFilter struct {
	Status     *Status `json:"status,omitempty"`
	Category   *Category `json:"category,omitempty"`
	Search     string  `json:"search,omitempty"` // Search in name, phone, client_code
	GroupID    *uuid.UUID `json:"group_id,omitempty"` // Filter by client group
	Page       int     `json:"page,omitempty"`
	PageSize   int     `json:"page_size,omitempty"`
}


