package paymentmethod

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Category string

const (
	CategoryBank     Category = "bank"
	CategoryCash     Category = "cash"
	CategoryEWallet  Category = "e-wallet"
	CategoryPayLater Category = "pay later"
)

type PaymentMethod struct {
	ID            uuid.UUID       `json:"id"`
	TenantID      *uuid.UUID      `json:"tenant_id,omitempty"`
	Name          string          `json:"name"`
	Category      Category        `json:"category"`
	Provider      *string         `json:"provider,omitempty"`
	AccountNumber *string         `json:"account_number,omitempty"`
	AccountName   *string         `json:"account_name,omitempty"`
	IsActive      bool            `json:"is_active"`
	Metadata      json.RawMessage `json:"metadata,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}
