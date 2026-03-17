package payroll

import (
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusDraft     Status = "draft"
	StatusProcessed Status = "processed"
	StatusPaid      Status = "paid"
)

type PayslipStatus string

const (
	PayslipStatusPending PayslipStatus = "pending"
	PayslipStatusPaid    PayslipStatus = "paid"
)

type ItemType string

const (
	ItemTypeAllowance     ItemType = "allowance"
	ItemTypeDeduction     ItemType = "deduction"
	ItemTypeReimbursement ItemType = "reimbursement"
)

type PayrollRun struct {
	ID               uuid.UUID  `json:"id"`
	TenantID         uuid.UUID  `json:"tenant_id"`
	Period           string     `json:"period"` // YYYY-MM
	TotalAmount      float64    `json:"total_amount"`
	Status           Status     `json:"status"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	ProcessedAt      *time.Time `json:"processed_at,omitempty"`
	PaidAt           *time.Time `json:"paid_at,omitempty"`
	PaymentMethodID  *uuid.UUID `json:"payment_method_id,omitempty"`
	PaymentMethod    *string    `json:"payment_method,omitempty"`
	PaymentReference *string    `json:"payment_reference,omitempty"`

	// Joined fields
	Payslips []*Payslip `json:"payslips,omitempty"`
}

type Payslip struct {
	ID                  uuid.UUID     `json:"id"`
	PayrollRunID        uuid.UUID     `json:"payroll_run_id"`
	UserID              uuid.UUID     `json:"user_id"`
	BaseSalary          float64       `json:"base_salary"`
	TotalAllowances     float64       `json:"total_allowances"`
	TotalDeductions     float64       `json:"total_deductions"`
	TotalReimbursements float64       `json:"total_reimbursements"`
	NetSalary           float64       `json:"net_salary"`
	Status              PayslipStatus `json:"status"`
	CreatedAt           time.Time     `json:"created_at"`
	UpdatedAt           time.Time     `json:"updated_at"`
	PaidAt              *time.Time    `json:"paid_at,omitempty"`
	PaymentMethodID     *uuid.UUID    `json:"payment_method_id,omitempty"`
	PaymentMethod       *string       `json:"payment_method,omitempty"`
	PaymentReference    *string       `json:"payment_reference,omitempty"`

	// Joined fields
	UserName string         `json:"user_name,omitempty"`
	Period   string         `json:"period,omitempty"`
	Items    []*PayslipItem `json:"items,omitempty"`
}

type PayslipItem struct {
	ID          uuid.UUID  `json:"id"`
	PayslipID   uuid.UUID  `json:"payslip_id"`
	Description string     `json:"description"`
	Type        ItemType   `json:"type"`
	Amount      float64    `json:"amount"`
	ReferenceID *uuid.UUID `json:"reference_id,omitempty"`
}
