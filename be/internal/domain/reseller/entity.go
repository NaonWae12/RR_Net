package reseller

import (
	"time"

	"rrnet/internal/domain/voucher"

	"github.com/google/uuid"
)

// Status represents reseller status
type Status string

const (
	StatusActive    Status = "active"
	StatusSuspended Status = "suspended"
	StatusPending   Status = "pending"
	StatusRejected  Status = "rejected"
)

// Reseller represents a client who has been upgraded to reseller status
type Reseller struct {
	ID             uuid.UUID `json:"id"`
	TenantID       uuid.UUID `json:"tenant_id"`
	ClientID       uuid.UUID `json:"client_id"`
	Status         Status    `json:"status"`
	JoinDate       time.Time `json:"join_date"`
	Notes          *string   `json:"notes,omitempty"`
	Balance        float64   `json:"balance"`
	ResellerRadius int       `json:"reseller_radius"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// Display fields
	ClientName     string  `json:"client_name"`
	ClientPhone    string  `json:"client_phone"`
	ClientEmail    string  `json:"client_email"`
	MonthlyRevenue float64 `json:"monthly_revenue"`
	TotalPurchases int     `json:"total_purchases"`
}

// ResellerPrice represents custom pricing for a reseller on a specific voucher package
type ResellerPrice struct {
	ID               uuid.UUID  `json:"id"`
	TenantID         uuid.UUID  `json:"tenant_id"`
	ResellerID       *uuid.UUID `json:"reseller_id,omitempty"`
	VoucherPackageID uuid.UUID  `json:"voucher_package_id"`
	ResellerPrice    float64    `json:"reseller_price"`
	RetailPrice      float64    `json:"retail_price"`
	Margin           float64    `json:"margin"` // Calculated field
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	// Display fields
	VoucherPackageName string `json:"voucher_package_name"`
}

// DiscountType represents the type of discount
type DiscountType string

const (
	DiscountTypeFixed      DiscountType = "fixed"
	DiscountTypePercentage DiscountType = "percentage"
)

// DiscountStatus represents discount status
type DiscountStatus string

const (
	DiscountStatusActive   DiscountStatus = "active"
	DiscountStatusInactive DiscountStatus = "inactive"
)

// ResellerDiscount represents a promo code for reseller purchases
type ResellerDiscount struct {
	ID            uuid.UUID      `json:"id"`
	TenantID      uuid.UUID      `json:"tenant_id"`
	Code          string         `json:"code"`
	DiscountID    *uuid.UUID     `json:"discount_id,omitempty"` // Reference to base discount rule
	RuleName      string         `json:"rule_name"`
	DiscountType  DiscountType   `json:"discount_type"`
	DiscountValue float64        `json:"discount_value"`
	Status        DiscountStatus `json:"status"`
	ExpiresAt     *time.Time     `json:"expires_at,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

// PurchaseStatus represents purchase transaction status
type PurchaseStatus string

const (
	PurchaseStatusSuccess   PurchaseStatus = "success"
	PurchaseStatusPending   PurchaseStatus = "pending"
	PurchaseStatusFailed    PurchaseStatus = "failed"
	PurchaseStatusPayLater  PurchaseStatus = "paylater"
	PurchaseStatusVerifying PurchaseStatus = "verifying"
)

// ResellerPurchase represents a voucher generation transaction by a reseller
type ResellerPurchase struct {
	ID               uuid.UUID      `json:"id"`
	TenantID         uuid.UUID      `json:"tenant_id"`
	ResellerID       uuid.UUID      `json:"reseller_id"`
	VoucherPackageID uuid.UUID      `json:"voucher_package_id"`
	RouterID         *uuid.UUID     `json:"router_id,omitempty"`
	Quantity         int            `json:"quantity"`
	UnitPrice        float64        `json:"unit_price"`
	Subtotal         float64        `json:"subtotal"`
	DiscountID       *uuid.UUID     `json:"discount_id,omitempty"`
	DiscountAmount   float64        `json:"discount_amount"`
	TotalAmount      float64        `json:"total_amount"`
	Margin           float64        `json:"margin"`
	PaymentMethod    string         `json:"payment_method"`
	Status           PurchaseStatus `json:"status"`
	Notes            *string        `json:"notes,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`

	// Display fields
	ResellerName       string             `json:"reseller_name"`
	VoucherPackageName string             `json:"voucher_package_name"`
	PromoCode          string             `json:"promo_code,omitempty"`
	Vouchers           []*voucher.Voucher `json:"vouchers,omitempty"`
	SnapToken          string             `json:"snap_token,omitempty"`
}

// ResellerListFilter represents filters for listing resellers
type ResellerListFilter struct {
	Status   *Status `json:"status,omitempty"`
	Search   string  `json:"search,omitempty"` // Search in client name, phone, email
	Page     int     `json:"page,omitempty"`
	PageSize int     `json:"page_size,omitempty"`
}

// PurchaseListFilter represents filters for listing purchases
type PurchaseListFilter struct {
	ResellerID *uuid.UUID      `json:"reseller_id,omitempty"`
	Status     *PurchaseStatus `json:"status,omitempty"`
	DateFrom   *time.Time      `json:"date_from,omitempty"`
	DateTo     *time.Time      `json:"date_to,omitempty"`
	Page       int             `json:"page,omitempty"`
	PageSize   int             `json:"page_size,omitempty"`
}
