package addon

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// AddonType represents the type of addon
type AddonType string

const (
	AddonTypeLimitBoost AddonType = "limit_boost"
	AddonTypeFeature    AddonType = "feature"
)

// BillingCycle represents the billing cycle
type BillingCycle string

const (
	BillingCycleOneTime BillingCycle = "one_time"
	BillingCycleMonthly BillingCycle = "monthly"
	BillingCycleYearly  BillingCycle = "yearly"
)

// Addon represents an add-on that can be purchased by tenants
type Addon struct {
	ID               uuid.UUID       `json:"id"`
	Code             string          `json:"code"`
	Name             string          `json:"name"`
	Description      *string         `json:"description,omitempty"`
	Price            float64         `json:"price"`
	BillingCycle     BillingCycle    `json:"billing_cycle"`
	Currency         string          `json:"currency"`
	Type             AddonType       `json:"addon_type"`
	Value            json.RawMessage `json:"value"`
	IsActive         bool            `json:"is_active"`
	AvailableForPlans json.RawMessage `json:"available_for_plans"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

// LimitBoostValue represents value for limit_boost addon
type LimitBoostValue struct {
	AddRouters  int `json:"add_routers,omitempty"`
	AddUsers    int `json:"add_users,omitempty"`
	AddClients  int `json:"add_clients,omitempty"`
	AddWAQuota  int `json:"add_wa_quota,omitempty"`
	AddVouchers int `json:"add_vouchers,omitempty"`
	AddODC      int `json:"add_odc,omitempty"`
	AddODP      int `json:"add_odp,omitempty"`
}

// FeatureValue represents value for feature addon
type FeatureValue struct {
	Feature string `json:"feature"`
}

// GetLimitBoostValue parses limit boost value
func (a *Addon) GetLimitBoostValue() (*LimitBoostValue, error) {
	if a.Type != AddonTypeLimitBoost {
		return nil, nil
	}
	var value LimitBoostValue
	if err := json.Unmarshal(a.Value, &value); err != nil {
		return nil, err
	}
	return &value, nil
}

// GetFeatureValue parses feature value
func (a *Addon) GetFeatureValue() (*FeatureValue, error) {
	if a.Type != AddonTypeFeature {
		return nil, nil
	}
	var value FeatureValue
	if err := json.Unmarshal(a.Value, &value); err != nil {
		return nil, err
	}
	return &value, nil
}

// GetAvailablePlans returns list of plan codes this addon is available for
func (a *Addon) GetAvailablePlans() ([]string, error) {
	var plans []string
	if err := json.Unmarshal(a.AvailableForPlans, &plans); err != nil {
		return nil, err
	}
	return plans, nil
}

// IsAvailableForPlan checks if addon is available for a specific plan
func (a *Addon) IsAvailableForPlan(planCode string) bool {
	plans, err := a.GetAvailablePlans()
	if err != nil {
		return false
	}
	for _, p := range plans {
		if p == planCode {
			return true
		}
	}
	return false
}

// TenantAddon represents an addon assigned to a tenant
type TenantAddon struct {
	ID           uuid.UUID       `json:"id"`
	TenantID     uuid.UUID       `json:"tenant_id"`
	AddonID      uuid.UUID       `json:"addon_id"`
	CustomConfig json.RawMessage `json:"custom_config,omitempty"`
	StartedAt    time.Time       `json:"started_at"`
	ExpiresAt    *time.Time      `json:"expires_at,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`

	// Joined field
	Addon *Addon `json:"addon,omitempty"`
}

// IsExpired checks if tenant addon has expired
func (ta *TenantAddon) IsExpired() bool {
	if ta.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*ta.ExpiresAt)
}


