package billing

import (
	"time"

	"github.com/google/uuid"
)

type PlatformDiscountType string

const (
	PlatformDiscountTypePercent PlatformDiscountType = "percent"
	PlatformDiscountTypeNominal PlatformDiscountType = "nominal"
)

type PlatformDiscount struct {
	ID          uuid.UUID            `json:"id"`
	Code        string               `json:"code"`
	Name        string               `json:"name"`
	Description *string              `json:"description,omitempty"`
	Type        PlatformDiscountType `json:"type"`
	Value       float64              `json:"value"`

	// Restrictions
	MinPurchase float64  `json:"min_purchase"`
	MaxDiscount *float64 `json:"max_discount,omitempty"`

	// Usage limits
	UsageLimit *int `json:"usage_limit,omitempty"`
	UsedCount  int  `json:"used_count"`

	// Expiry
	ExpiresAt *time.Time `json:"expires_at,omitempty"`

	// Status
	IsActive bool `json:"is_active"`

	// Metadata
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
}

func (d *PlatformDiscount) IsValid(amount float64) bool {
	if !d.IsActive || d.DeletedAt != nil {
		return false
	}
	if d.ExpiresAt != nil && !d.ExpiresAt.IsZero() && d.ExpiresAt.Before(time.Now()) {
		return false
	}
	if d.UsageLimit != nil && d.UsedCount >= *d.UsageLimit {
		return false
	}
	if amount < d.MinPurchase {
		return false
	}
	return true
}

func (d *PlatformDiscount) CalculateDiscount(amount float64) float64 {
	if !d.IsValid(amount) {
		return 0
	}

	var discount float64
	if d.Type == PlatformDiscountTypePercent {
		discount = amount * (d.Value / 100)
		if d.MaxDiscount != nil && discount > *d.MaxDiscount {
			discount = *d.MaxDiscount
		}
	} else {
		discount = d.Value
	}

	if discount > amount {
		return amount
	}
	return discount
}
