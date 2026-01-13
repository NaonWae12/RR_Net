package billing

import (
	"time"

	"github.com/google/uuid"
)

// InvoiceStatus defines the status of an invoice
type InvoiceStatus string

const (
	InvoiceStatusDraft     InvoiceStatus = "draft"
	InvoiceStatusPending   InvoiceStatus = "pending"
	InvoiceStatusPaid      InvoiceStatus = "paid"
	InvoiceStatusOverdue   InvoiceStatus = "overdue"
	InvoiceStatusCancelled InvoiceStatus = "cancelled"
)

// PaymentMethod defines payment method types
type PaymentMethod string

const (
	PaymentMethodCash         PaymentMethod = "cash"
	PaymentMethodBankTransfer PaymentMethod = "bank_transfer"
	PaymentMethodEWallet      PaymentMethod = "e_wallet"
	PaymentMethodQRIS         PaymentMethod = "qris"
	PaymentMethodVA           PaymentMethod = "virtual_account"
	PaymentMethodCollector    PaymentMethod = "collector"
)

// Invoice represents a billing invoice
type Invoice struct {
	ID                uuid.UUID     `json:"id"`
	TenantID          uuid.UUID     `json:"tenant_id"`
	ClientID          uuid.UUID     `json:"client_id"`
	ClientName        *string       `json:"client_name,omitempty"`
	ClientPhone       *string       `json:"client_phone,omitempty"`
	ClientAddress     *string       `json:"client_address,omitempty"`
	ClientGroupName   *string       `json:"client_group_name,omitempty"`
	InvoiceNumber     string        `json:"invoice_number"`
	PeriodStart       time.Time     `json:"period_start"`
	PeriodEnd         time.Time     `json:"period_end"`
	DueDate           time.Time     `json:"due_date"`
	Subtotal          int64         `json:"subtotal"`        // in cents/smallest unit
	TaxAmount         int64         `json:"tax_amount"`
	DiscountAmount    int64         `json:"discount_amount"`
	TotalAmount       int64         `json:"total_amount"`
	PaidAmount        int64         `json:"paid_amount"`
	Currency          string        `json:"currency"`
	Status            InvoiceStatus `json:"status"`
	Notes             string        `json:"notes,omitempty"`
	Items             []InvoiceItem `json:"items,omitempty"`
	CreatedAt         time.Time     `json:"created_at"`
	UpdatedAt         time.Time     `json:"updated_at"`
	PaidAt            *time.Time    `json:"paid_at,omitempty"`
}

// InvoiceItem represents a line item in an invoice
type InvoiceItem struct {
	ID          uuid.UUID `json:"id"`
	InvoiceID   uuid.UUID `json:"invoice_id"`
	Description string    `json:"description"`
	Quantity    int       `json:"quantity"`
	UnitPrice   int64     `json:"unit_price"`
	Amount      int64     `json:"amount"`
	CreatedAt   time.Time `json:"created_at"`
}

// Payment represents a payment transaction
type Payment struct {
	ID              uuid.UUID     `json:"id"`
	TenantID        uuid.UUID     `json:"tenant_id"`
	InvoiceID       uuid.UUID     `json:"invoice_id"`
	ClientID        uuid.UUID     `json:"client_id"`
	ClientName      *string       `json:"client_name,omitempty"`
	Amount          int64         `json:"amount"`
	Currency        string        `json:"currency"`
	Method          PaymentMethod `json:"method"`
	Reference       *string       `json:"reference,omitempty"`
	CollectorID     *uuid.UUID    `json:"collector_id,omitempty"`
	Notes           *string       `json:"notes,omitempty"`
	ReceivedAt      time.Time     `json:"received_at"`
	CreatedAt       time.Time     `json:"created_at"`
	CreatedByUserID uuid.UUID     `json:"created_by_user_id"`
}

// IsolirStatus defines isolir action status
type IsolirStatus string

const (
	IsolirStatusPending   IsolirStatus = "pending"
	IsolirStatusExecuted  IsolirStatus = "executed"
	IsolirStatusFailed    IsolirStatus = "failed"
	IsolirStatusReverted  IsolirStatus = "reverted"
)

// IsolirAction defines isolir action types
type IsolirAction string

const (
	IsolirActionIsolate   IsolirAction = "isolate"
	IsolirActionReactivate IsolirAction = "reactivate"
)

// IsolirLog represents an isolir action log
type IsolirLog struct {
	ID          uuid.UUID    `json:"id"`
	TenantID    uuid.UUID    `json:"tenant_id"`
	ClientID    uuid.UUID    `json:"client_id"`
	InvoiceID   *uuid.UUID   `json:"invoice_id,omitempty"`
	Action      IsolirAction `json:"action"`
	Reason      string       `json:"reason"`
	Status      IsolirStatus `json:"status"`
	ExecutedAt  *time.Time   `json:"executed_at,omitempty"`
	ExecutedBy  *uuid.UUID   `json:"executed_by,omitempty"`
	IsAutomatic bool         `json:"is_automatic"`
	ErrorMsg    string       `json:"error_msg,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
}

// BillingSummary provides billing summary for a tenant
type BillingSummary struct {
	TotalInvoices     int   `json:"total_invoices"`
	PendingInvoices   int   `json:"pending_invoices"`
	OverdueInvoices   int   `json:"overdue_invoices"`
	PaidInvoices      int   `json:"paid_invoices"`
	TotalRevenue      int64 `json:"total_revenue"`
	PendingAmount     int64 `json:"pending_amount"`
	OverdueAmount     int64 `json:"overdue_amount"`
	CollectedThisMonth int64 `json:"collected_this_month"`
}

// ClientBillingSummary provides billing summary for a client
type ClientBillingSummary struct {
	ClientID        uuid.UUID `json:"client_id"`
	TotalInvoices   int       `json:"total_invoices"`
	PaidInvoices    int       `json:"paid_invoices"`
	PendingAmount   int64     `json:"pending_amount"`
	OverdueAmount   int64     `json:"overdue_amount"`
	LastPaymentDate *time.Time `json:"last_payment_date,omitempty"`
	LastPaymentAmount int64   `json:"last_payment_amount"`
}

// IsDue checks if invoice is past due date
func (i *Invoice) IsDue() bool {
	return time.Now().After(i.DueDate) && i.Status == InvoiceStatusPending
}

// RemainingAmount returns unpaid amount
func (i *Invoice) RemainingAmount() int64 {
	return i.TotalAmount - i.PaidAmount
}

// IsPaid checks if invoice is fully paid
func (i *Invoice) IsPaid() bool {
	return i.PaidAmount >= i.TotalAmount
}


