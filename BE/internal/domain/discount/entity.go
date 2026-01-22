package discount

import (
	"time"

	"github.com/google/uuid"
)

// Type represents discount type
type Type string

const (
	TypePercent Type = "percent" // Percentage discount (0-100)
	TypeNominal Type = "nominal" // Fixed amount discount
)

// Discount represents a discount/promotion that can be applied to clients
type Discount struct {
	ID        uuid.UUID  `json:"id"`
	TenantID  uuid.UUID  `json:"tenant_id"`
	Name      string     `json:"name"`
	Description *string  `json:"description,omitempty"`
	Type      Type       `json:"type"`
	Value     float64    `json:"value"` // Percentage (0-100) or nominal amount
	ExpiresAt *time.Time `json:"expires_at,omitempty"` // NULL = never expires
	IsActive  bool       `json:"is_active"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
}

// IsValid checks if discount is valid (active, not expired, not deleted)
func (d *Discount) IsValid() bool {
	if !d.IsActive || d.DeletedAt != nil {
		return false
	}
	if d.ExpiresAt != nil && d.ExpiresAt.Before(time.Now()) {
		return false
	}
	return true
}

// CalculateDiscount calculates the discount amount for a given price
func (d *Discount) CalculateDiscount(price float64) float64 {
	if !d.IsValid() {
		return 0
	}
	if d.Type == TypePercent {
		return price * (d.Value / 100)
	}
	// TypeNominal
	if d.Value > price {
		return price // Can't discount more than the price
	}
	return d.Value
}

// ApplyDiscount applies discount to a price and returns the final price
func (d *Discount) ApplyDiscount(price float64) float64 {
	discountAmount := d.CalculateDiscount(price)
	finalPrice := price - discountAmount
	if finalPrice < 0 {
		return 0
	}
	return finalPrice
}

