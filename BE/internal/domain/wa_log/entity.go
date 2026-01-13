package wa_log

import (
	"time"

	"github.com/google/uuid"
)

type Source string

const (
	SourceSingle   Source = "single"
	SourceCampaign Source = "campaign"
	SourceSystem   Source = "system"
)

type Status string

const (
	StatusQueued Status = "queued"
	StatusSent   Status = "sent"
	StatusFailed Status = "failed"
)

type MessageLog struct {
	ID        uuid.UUID `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	Source    Source    `json:"source"`

	CampaignID          *uuid.UUID `json:"campaign_id,omitempty"`
	CampaignRecipientID *uuid.UUID `json:"campaign_recipient_id,omitempty"`

	ClientID   *uuid.UUID `json:"client_id,omitempty"`
	ClientName *string    `json:"client_name,omitempty"`

	ToPhone     string     `json:"to_phone"`
	MessageText string     `json:"message_text"`
	TemplateID  *uuid.UUID `json:"template_id,omitempty"`

	Status          Status  `json:"status"`
	GatewayMessageID *string `json:"gateway_message_id,omitempty"`
	Error           *string `json:"error,omitempty"`

	CreatedAt time.Time  `json:"created_at"`
	SentAt    *time.Time `json:"sent_at,omitempty"`
}


