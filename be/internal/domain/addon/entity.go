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
	ID                uuid.UUID       `json:"id"`
	Code              string          `json:"code"`
	Name              string          `json:"name"`
	Description       *string         `json:"description,omitempty"`
	Price             float64         `json:"price"`
	BillingCycle      BillingCycle    `json:"billing_cycle"`
	Currency          string          `json:"currency"`
	Type              AddonType       `json:"addon_type"`
	Value             json.RawMessage `json:"value"`
	IsActive          bool            `json:"is_active"`
	AvailableForPlans json.RawMessage `json:"available_for_plans"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`

	// Relational fields (new)
	FeaturesList []string       `json:"features_list,omitempty"`
	LimitsMap    map[string]int `json:"limits_map,omitempty"`
}

// LimitBoostValue represents value for limit_boost addon
type LimitBoostValue struct {
	AddRouters  int `json:"add_routers,omitempty"`
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

// GetLimitBoostValue returns value from LimitsMap
func (a *Addon) GetLimitBoostValue() (*LimitBoostValue, error) {
	if len(a.LimitsMap) > 0 {
		return &LimitBoostValue{
			AddRouters:  a.LimitsMap["add_routers"],
			AddClients:  a.LimitsMap["add_clients"],
			AddWAQuota:  a.LimitsMap["add_wa_quota"],
			AddVouchers: a.LimitsMap["add_vouchers"],
			AddODC:      a.LimitsMap["add_odc"],
			AddODP:      a.LimitsMap["add_odp"],
		}, nil
	}
	return nil, nil
}

// GetFeatureValue returns from FeaturesList
func (a *Addon) GetFeatureValue() (*FeatureValue, error) {
	if len(a.FeaturesList) > 0 {
		return &FeatureValue{
			Feature: a.FeaturesList[0],
		}, nil
	}
	return nil, nil
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
