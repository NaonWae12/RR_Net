package finance

import (
	"time"

	"github.com/google/uuid"
)

type TransactionType string

const (
	TransactionTypeIncome  TransactionType = "income"
	TransactionTypeExpense TransactionType = "expense"
)

type TransactionSource string

const (
	TransactionSourceVoucherUsage     TransactionSource = "voucher_usage"
	TransactionSourceResellerPurchase TransactionSource = "reseller_purchase"
	TransactionSourceBillingPayment   TransactionSource = "billing_payment"
)

type Transaction struct {
	ID          uuid.UUID         `json:"id"`
	TenantID    uuid.UUID         `json:"tenant_id"`
	Type        TransactionType   `json:"type"`
	Source      TransactionSource `json:"source"`
	SourceID    uuid.UUID         `json:"source_id"`
	Amount      float64           `json:"amount"`
	Currency    string            `json:"currency"`
	Description string            `json:"description"`
	CreatedAt   time.Time         `json:"created_at"`
}

type TenantBalance struct {
	TenantID  uuid.UUID `json:"tenant_id"`
	Balance   float64   `json:"balance"`
	UpdatedAt time.Time `json:"updated_at"`
}

type RevenueSummary struct {
	TodayRevenue    float64 `json:"today_revenue"`
	TotalBalance    float64 `json:"total_balance"`
	VoucherRevenue  float64 `json:"voucher_revenue"`
	ResellerRevenue float64 `json:"reseller_revenue"`
	BillingRevenue  float64 `json:"billing_revenue"`
}

type TrendPoint struct {
	Date   string  `json:"date"`
	Amount float64 `json:"amount"`
}

type TrendResponse struct {
	Source      string       `json:"source"`
	Points      []TrendPoint `json:"points"`
	TotalAmount float64      `json:"total_amount"`
}
