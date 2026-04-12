package voucher

import (
	"time"
	"github.com/google/uuid"
)

// VoucherDesign represents a template available in the store
type VoucherDesign struct {
	ID          uuid.UUID `json:"id"`
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	PreviewURL  string    `json:"preview_url,omitempty"`
	Price       float64   `json:"price"`
	IsFree      bool      `json:"is_free"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TenantDesign represents a design owned/purchased by a tenant
type TenantDesign struct {
	TenantID    uuid.UUID `json:"tenant_id"`
	DesignID    uuid.UUID `json:"design_id"`
	PurchasedAt time.Time `json:"purchased_at"`
}
