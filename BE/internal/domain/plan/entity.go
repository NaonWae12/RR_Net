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
	Limits         json.RawMessage `json:"limits"`
	Features       json.RawMessage `json:"features"`
	HiddenFeatures json.RawMessage `json:"hidden_features,omitempty"`
	IsActive       bool            `json:"is_active"`
	IsPublic       bool            `json:"is_public"`
	SortOrder      int             `json:"sort_order"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`

	// Relational fields (new)
	FeaturesList       []string       `json:"features_list,omitempty"`
	HiddenFeaturesList []string       `json:"hidden_features_list,omitempty"`
	LimitsMap          map[string]int `json:"limits_map,omitempty"`
}

// PlanLimits represents the limits included in a plan
type PlanLimits struct {
	MaxRouters     int `json:"max_routers"`
	MaxVouchers    int `json:"max_vouchers"`
	MaxODC         int `json:"max_odc"`
	MaxODP         int `json:"max_odp"`
	MaxClients     int `json:"max_clients"`
	WAQuotaMonthly int `json:"wa_quota_monthly"`
}

// GetLimits parses the limits JSON or returns LimitsMap
func (p *Plan) GetLimits() (*PlanLimits, error) {
	if len(p.LimitsMap) > 0 {
		return &PlanLimits{
			MaxRouters:     p.LimitsMap["max_routers"],
			MaxVouchers:    p.LimitsMap["max_vouchers"],
			MaxODC:         p.LimitsMap["max_odc"],
			MaxODP:         p.LimitsMap["max_odp"],
			MaxClients:     p.LimitsMap["max_clients"],
			WAQuotaMonthly: p.LimitsMap["wa_quota_monthly"],
		}, nil
	}

	var limits PlanLimits
	if err := json.Unmarshal(p.Limits, &limits); err != nil {
		return nil, err
	}
	return &limits, nil
}

// GetFeatures parses the features JSON array or returns FeaturesList
func (p *Plan) GetFeatures() ([]string, error) {
	if len(p.FeaturesList) > 0 {
		return p.FeaturesList, nil
	}

	var features []string
	if err := json.Unmarshal(p.Features, &features); err != nil {
		return nil, err
	}
	return features, nil
}

// HasFeature checks if plan includes a feature
func (p *Plan) HasFeature(featureCode string) bool {
	// Strictly use relational list
	for _, f := range p.FeaturesList {
		if f == "*" || f == featureCode {
			return true
		}
	}
	return false
}

// GetLimit returns a specific limit value (-1 = unlimited)
func (p *Plan) GetLimit(limitName string) int {
	// Strictly use relational map
	if val, ok := p.LimitsMap[limitName]; ok {
		return val
	}
	return 0
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
