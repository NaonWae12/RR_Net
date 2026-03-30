package affiliate

import (
	"time"

	"github.com/google/uuid"
)

type Tier string

const (
	TierSilver   Tier = "silver"
	TierGold     Tier = "gold"
	TierPlatinum Tier = "platinum"
)

type Status string

const (
	StatusPending   Status = "pending"
	StatusActive    Status = "active"
	StatusSuspended Status = "suspended"
)

// Affiliate represents the partner profile
type Affiliate struct {
	ID            uuid.UUID `json:"id"`
	UserID        uuid.UUID `json:"user_id"`
	Code          string    `json:"code"`
	Tier          Tier      `json:"tier"`
	WalletBalance float64   `json:"wallet_balance"`
	TotalEarnings float64   `json:"total_earnings"`
	ReferredCount int       `json:"referred_count"`
	Status        Status    `json:"status"`
	Metadata      map[string]interface{} `json:"metadata"`
	TierExpiresAt *time.Time             `json:"tier_expires_at,omitempty"`
	TierUpgradedAt time.Time             `json:"tier_upgraded_at"`
	JoinedCampaignID *uuid.UUID          `json:"joined_campaign_id,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

// Referral tracks which tenant was referred by which affiliate
type Referral struct {
	ID                   uuid.UUID `json:"id"`
	AffiliateID          uuid.UUID `json:"affiliate_id"`
	ReferredTenantID     uuid.UUID `json:"referred_tenant_id"`
	CommissionPercentage float64   `json:"commission_percentage"`
	Status               string    `json:"status"`
	CreatedAt            time.Time `json:"created_at"`
}

// Commission logs earnings from individual invoices
type Commission struct {
	ID          uuid.UUID  `json:"id"`
	AffiliateID uuid.UUID  `json:"affiliate_id"`
	ReferralID  uuid.UUID  `json:"referral_id"`
	InvoiceID   uuid.UUID  `json:"invoice_id"`
	Amount      float64    `json:"amount"`
	Percentage  float64    `json:"percentage"`
	Status      string     `json:"status"`
	PaidAt      *time.Time `json:"paid_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// Withdrawal represents a payout request
type StatusWithdrawal string

const (
	WithdrawalPending   StatusWithdrawal = "pending"
	WithdrawalCompleted StatusWithdrawal = "completed"
	WithdrawalRejected  StatusWithdrawal = "rejected"
)

type Withdrawal struct {
	ID              uuid.UUID        `json:"id"`
	AffiliateID      uuid.UUID        `json:"affiliate_id"`
	Amount          float64          `json:"amount"`
	BankName        string           `json:"bank_name"`
	AccountNumber   string           `json:"account_number"`
	AccountName     string           `json:"account_name"`
	Status          StatusWithdrawal `json:"status"`
	ProcessedAt     *time.Time       `json:"processed_at,omitempty"`
	RejectionReason *string          `json:"rejection_reason,omitempty"`
	CreatedAt       time.Time        `json:"created_at"`
}

// Campaign defines a strategy/promotion
type Campaign struct {
	ID                     uuid.UUID              `json:"id"`
	Name                   string                 `json:"name"`
	Description            string                 `json:"description"`
	TierConfig             map[string]interface{} `json:"tier_config"`
	MaxAffiliates          int                    `json:"max_affiliates"`
	CurrentAffiliatesCount int                    `json:"current_affiliates_count"`
	StartsAt               time.Time              `json:"starts_at"`
	EndsAt                 *time.Time             `json:"ends_at,omitempty"`
	IsActive               bool                   `json:"is_active"`
	IsDefault              bool                   `json:"is_default"`
	CreatedAt              time.Time              `json:"created_at"`
	UpdatedAt              time.Time              `json:"updated_at"`
}
