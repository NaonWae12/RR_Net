package service_package

import (
	"encoding/json"
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

type PricingModel string

const (
	PricingModelFlatMonthly PricingModel = "flat_monthly"
	PricingModelPerDevice   PricingModel = "per_device"
)

// ServicePackage represents a tenant-defined internet package.
// - PPPoE: flat_monthly (price_monthly)
// - Lite: per_device (price_per_device)
type ServicePackage struct {
	ID              uuid.UUID       `json:"id"`
	TenantID         uuid.UUID       `json:"tenant_id"`
	Name             string          `json:"name"`
	Category          Category        `json:"category"`
	PricingModel      PricingModel    `json:"pricing_model"`
	PriceMonthly      float64         `json:"price_monthly"`
	PricePerDevice    float64         `json:"price_per_device"`
	BillingDayDefault *int            `json:"billing_day_default,omitempty"`
	NetworkProfileID  uuid.UUID       `json:"network_profile_id"`
	IsActive          bool            `json:"is_active"`
	Metadata          json.RawMessage `json:"metadata,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
	DeletedAt         *time.Time      `json:"deleted_at,omitempty"`
}


