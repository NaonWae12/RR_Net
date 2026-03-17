package reimbursement

import (
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusSubmitted Status = "submitted"
	StatusApproved  Status = "approved"
	StatusRejected  Status = "rejected"
	StatusPaid      Status = "paid"
)

type Reimbursement struct {
	ID                uuid.UUID  `json:"id"`
	TenantID          uuid.UUID  `json:"tenant_id"`
	UserID            uuid.UUID  `json:"user_id"`
	Amount            float64    `json:"amount"`
	Category          string     `json:"category"`
	Date              time.Time  `json:"date"`
	Description       string     `json:"description"`
	Status            Status     `json:"status"`
	AttachmentURL     *string    `json:"attachment_url,omitempty"`
	ApprovedBy        *uuid.UUID `json:"approved_by,omitempty"`
	ApprovedAt        *time.Time `json:"approved_at,omitempty"`
	RejectionReason   *string    `json:"rejection_reason,omitempty"`
	PaidAt            *time.Time `json:"paid_at,omitempty"`
	PayWithPayroll    bool       `json:"pay_with_payroll"`
	PaidWithPayrollID *uuid.UUID `json:"paid_with_payroll_id,omitempty"`
	PaymentMethodID   *uuid.UUID `json:"payment_method_id,omitempty"`
	PaymentMethod     *string    `json:"payment_method,omitempty"`
	PaymentReference  *string    `json:"payment_reference,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`

	// Joined fields
	UserName string `json:"user_name,omitempty"`
}
