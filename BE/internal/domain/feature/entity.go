package feature

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Toggle represents a feature toggle (global or tenant-specific)
type Toggle struct {
	ID         uuid.UUID       `json:"id"`
	Code       string          `json:"code"`
	Name       string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	TenantID   *uuid.UUID      `json:"tenant_id,omitempty"` // nil = global toggle
	IsEnabled  bool            `json:"is_enabled"`
	Conditions json.RawMessage `json:"conditions,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

// IsGlobal checks if this is a global toggle
func (t *Toggle) IsGlobal() bool {
	return t.TenantID == nil
}

// ToggleConditions represents conditions for feature rollout
type ToggleConditions struct {
	Percentage   *int      `json:"percentage,omitempty"`    // Percentage rollout (0-100)
	AllowedPlans []string  `json:"allowed_plans,omitempty"` // Only for specific plans
	StartDate    *string   `json:"start_date,omitempty"`    // Enable after date
	EndDate      *string   `json:"end_date,omitempty"`      // Disable after date
}

// GetConditions parses the conditions JSON
func (t *Toggle) GetConditions() (*ToggleConditions, error) {
	if t.Conditions == nil || len(t.Conditions) == 0 {
		return &ToggleConditions{}, nil
	}
	var conditions ToggleConditions
	if err := json.Unmarshal(t.Conditions, &conditions); err != nil {
		return nil, err
	}
	return &conditions, nil
}

// FeatureList defines all available features in the system
var FeatureList = []string{
	// Core features
	"client_management",
	"billing_basic",
	"billing_full",
	
	// Network features
	"radius_basic",
	"radius_full",
	"mikrotik_api",
	
	// Voucher features
	"voucher_basic",
	"voucher_full",
	
	// Isolir features
	"isolir_manual",
	"isolir_auto",
	
	// Maps features
	"maps_basic",
	"maps_full",
	
	// RBAC features
	"rbac_basic",
	"rbac_full",
	
	// Communication features
	"wa_gateway",
	
	// Payment features
	"payment_gateway",
	
	// HR features
	"hr_module",
	"collector_module",
	"technician_module",
	
	// Premium features
	"custom_login_page",
	"custom_domain",
	"reports_advanced",
	"api_access",
	"priority_support",
}

// LimitList defines all available limits in the system
var LimitList = []string{
	"max_routers",
	"max_users",
	"max_vouchers",
	"max_odc",
	"max_odp",
	"max_clients",
	"wa_quota_monthly",
}


