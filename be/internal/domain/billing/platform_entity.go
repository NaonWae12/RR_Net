package billing

import (
	"time"

	"github.com/google/uuid"
)

type PlatformInvoiceStatus string

const (
	PlatformInvoiceStatusPending   PlatformInvoiceStatus = "pending"
	PlatformInvoiceStatusPaid      PlatformInvoiceStatus = "paid"
	PlatformInvoiceStatusOverdue   PlatformInvoiceStatus = "overdue"
	PlatformInvoiceStatusCancelled PlatformInvoiceStatus = "cancelled"
)

type PlatformPaymentStatus string

const (
	PlatformPaymentStatusPending  PlatformPaymentStatus = "pending"
	PlatformPaymentStatusVerified PlatformPaymentStatus = "verified"
	PlatformPaymentStatusRejected PlatformPaymentStatus = "rejected"
)

type PlatformInvoice struct {
	ID             uuid.UUID             `json:"id"`
	TenantID       uuid.UUID             `json:"tenant_id"`
	TenantName     string                `json:"tenant_name,omitempty"`
	PlanID         uuid.UUID             `json:"plan_id"`
	PlanName       string                `json:"plan_name,omitempty"`
	InvoiceNumber  string                `json:"invoice_number"`
	PeriodStart    time.Time             `json:"period_start"`
	PeriodEnd      time.Time             `json:"period_end"`
	DueDate        time.Time             `json:"due_date"`
	Subtotal       int64                 `json:"subtotal"`
	DiscountAmount int64                 `json:"discount_amount"`
	DiscountID     *uuid.UUID            `json:"discount_id,omitempty"`
	AddonID        *uuid.UUID            `json:"addon_id,omitempty"`
	AddonQuantity  *int                  `json:"addon_quantity,omitempty"`
	AddonName      *string               `json:"addon_name,omitempty"`
	Amount         int64                 `json:"amount"`
	PaidAmount     int64                 `json:"paid_amount"`
	Currency       string                `json:"currency"`
	Status         PlatformInvoiceStatus `json:"status"`
	PaidAt         *time.Time            `json:"paid_at,omitempty"`
	Notes          string                `json:"notes,omitempty"`
	CreatedAt      time.Time             `json:"created_at"`
	UpdatedAt      time.Time             `json:"updated_at"`
}

type PlatformPayment struct {
	ID                uuid.UUID             `json:"id"`
	PlatformInvoiceID uuid.UUID             `json:"platform_invoice_id"`
	TenantID          uuid.UUID             `json:"tenant_id"`
	Amount            int64                 `json:"amount"`
	Currency          string                `json:"currency"`
	Method            string                `json:"method"`
	Reference         string                `json:"reference,omitempty"`
	ProofImageURL     string                `json:"proof_image_url,omitempty"`
	Status            PlatformPaymentStatus `json:"status"`
	Notes             string                `json:"notes,omitempty"`
	VerifiedAt        *time.Time            `json:"verified_at,omitempty"`
	VerifiedBy        *uuid.UUID            `json:"verified_by,omitempty"`
	CreatedAt         time.Time             `json:"created_at"`
	UpdatedAt         time.Time             `json:"updated_at"`
}
