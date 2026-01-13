package wa_campaign

import (
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusQueued    Status = "queued"
	StatusRunning   Status = "running"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
	StatusCancelled Status = "cancelled"
)

type RecipientStatus string

const (
	RecipientPending RecipientStatus = "pending"
	RecipientSent    RecipientStatus = "sent"
	RecipientFailed  RecipientStatus = "failed"
)

type Campaign struct {
	ID        uuid.UUID `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	GroupID   *uuid.UUID `json:"group_id,omitempty"`
	Name      string    `json:"name"`
	Message   string    `json:"message"`
	Status    Status    `json:"status"`
	Total     int       `json:"total"`
	Sent      int       `json:"sent"`
	Failed    int       `json:"failed"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Recipient struct {
	ID         uuid.UUID       `json:"id"`
	CampaignID uuid.UUID       `json:"campaign_id"`
	ClientID   *uuid.UUID      `json:"client_id,omitempty"`
	ClientName string          `json:"client_name,omitempty"`
	Phone      string          `json:"phone"`
	Status     RecipientStatus `json:"status"`
	Error      *string         `json:"error,omitempty"`
	MessageID  *string         `json:"message_id,omitempty"`
	SentAt     *time.Time      `json:"sent_at,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}


