package plan

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Plan represents a SaaS subscription plan
type Plan struct {
	ID           uuid.UUID       `json:"id"`
	Code         string          `json:"code"`
	Name         string          `json:"name"`
	Description  *string         `json:"description,omitempty"`
	PriceMonthly float64         `json:"price_monthly"`
	PriceYearly  *float64        `json:"price_yearly,omitempty"`
	Currency     string          `json:"currency"`
	Limits       json.RawMessage `json:"limits"`
	Features     json.RawMessage `json:"features"`
	IsActive     bool            `json:"is_active"`
	IsPublic     bool            `json:"is_public"`
	SortOrder    int             `json:"sort_order"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// PlanLimits represents the limits included in a plan
type PlanLimits struct {
	MaxRouters      int `json:"max_routers"`
	MaxUsers        int `json:"max_users"`
	MaxVouchers     int `json:"max_vouchers"`
	MaxODC          int `json:"max_odc"`
	MaxODP          int `json:"max_odp"`
	MaxClients      int `json:"max_clients"`
	WAQuotaMonthly  int `json:"wa_quota_monthly"`
}

// GetLimits parses the limits JSON
func (p *Plan) GetLimits() (*PlanLimits, error) {
	var limits PlanLimits
	if err := json.Unmarshal(p.Limits, &limits); err != nil {
		return nil, err
	}
	return &limits, nil
}

// GetFeatures parses the features JSON array
func (p *Plan) GetFeatures() ([]string, error) {
	var features []string
	if err := json.Unmarshal(p.Features, &features); err != nil {
		return nil, err
	}
	return features, nil
}

// HasFeature checks if plan includes a feature
func (p *Plan) HasFeature(featureCode string) bool {
	features, err := p.GetFeatures()
	if err != nil {
		return false
	}
	
	// Enterprise plan with "*" has all features
	for _, f := range features {
		if f == "*" || f == featureCode {
			return true
		}
	}
	return false
}

// GetLimit returns a specific limit value (-1 = unlimited)
func (p *Plan) GetLimit(limitName string) int {
	limits, err := p.GetLimits()
	if err != nil {
		return 0
	}
	
	switch limitName {
	case "max_routers":
		return limits.MaxRouters
	case "max_users":
		return limits.MaxUsers
	case "max_vouchers":
		return limits.MaxVouchers
	case "max_odc":
		return limits.MaxODC
	case "max_odp":
		return limits.MaxODP
	case "max_clients":
		return limits.MaxClients
	case "wa_quota_monthly":
		return limits.WAQuotaMonthly
	default:
		return 0
	}
}

// IsUnlimited checks if plan has unlimited value for a limit
func (p *Plan) IsUnlimited(limitName string) bool {
	return p.GetLimit(limitName) == -1
}

// TenantPlan represents the assignment of a plan to a tenant
type TenantPlan struct {
	TenantID  uuid.UUID `json:"tenant_id"`
	PlanID    uuid.UUID `json:"plan_id"`
	StartedAt time.Time `json:"started_at"`
	
	// Joined field
	Plan *Plan `json:"plan,omitempty"`
}


