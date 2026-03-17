package timeoff

import (
	"time"

	"github.com/google/uuid"
)

type Type string

const (
	TypeLeave     Type = "leave"
	TypeSick      Type = "sick"
	TypeEmergency Type = "emergency"
)

type Status string

const (
	StatusPending  Status = "pending_approval"
	StatusApproved Status = "approved"
	StatusRejected Status = "rejected"
)

type TimeOff struct {
	ID              uuid.UUID  `json:"id"`
	TenantID        uuid.UUID  `json:"tenant_id"`
	UserID          uuid.UUID  `json:"user_id"`
	Type            Type       `json:"type"`
	StartDate       time.Time  `json:"start_date"`
	EndDate         time.Time  `json:"end_date"`
	Reason          string     `json:"reason"`
	AttachmentURL   *string    `json:"attachment_url,omitempty"`
	Status          Status     `json:"status"`
	ApprovedBy      *uuid.UUID `json:"approved_by,omitempty"`
	ApprovedAt      *time.Time `json:"approved_at,omitempty"`
	RejectionReason *string    `json:"rejection_reason,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`

	// Joined fields
	UserName  string `json:"user_name,omitempty"`
	DaysCount int    `json:"days_count"`
}
