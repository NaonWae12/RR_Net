package finance

import (
	"time"

	"github.com/google/uuid"
)

type Expense struct {
	ID               uuid.UUID  `json:"id"`
	TenantID         uuid.UUID  `json:"tenant_id"`
	Title            string     `json:"title"`
	Amount           float64    `json:"amount"`
	Currency         string     `json:"currency"`
	Date             time.Time  `json:"date"`
	Category         string     `json:"category"`
	Description      string     `json:"description"`
	Status           string     `json:"status"` // approved, paid
	PaymentMethodID  *uuid.UUID `json:"payment_method_id,omitempty"`
	PaymentReference string     `json:"payment_reference,omitempty"`
	PaidAt           *time.Time `json:"paid_at,omitempty"`
	// Recurring fields
	IsRecurring      bool       `json:"is_recurring"`
	RecurringDay     *int       `json:"recurring_day,omitempty"`  // 1-28: day of month to generate
	RecurringEndAt   *time.Time `json:"recurring_end_at,omitempty"`
	ParentExpenseID  *uuid.UUID `json:"parent_expense_id,omitempty"` // set on generated children
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type ExpenseFilter struct {
	Status      string
	Category    string
	IsRecurring *bool
	Limit       int
	Offset      int
}
