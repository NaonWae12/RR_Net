package tenant

import (
	"time"

	"github.com/google/uuid"
)

// Status represents tenant status
type Status string

const (
	StatusActive    Status = "active"
	StatusSuspended Status = "suspended"
	StatusPending   Status = "pending"
	StatusDeleted   Status = "deleted"
)

// BillingStatus represents tenant billing status
type BillingStatus string

const (
	BillingStatusActive    BillingStatus = "active"
	BillingStatusOverdue   BillingStatus = "overdue"
	BillingStatusSuspended BillingStatus = "suspended"
)

// Tenant represents a tenant/organization in the system
type Tenant struct {
	ID            uuid.UUID              `json:"id"`
	Name          string                 `json:"name"`
	Slug          string                 `json:"slug"`
	Domain        *string                `json:"domain,omitempty"`
	Status        Status                 `json:"status"`
	PlanID        *uuid.UUID             `json:"plan_id,omitempty"`
	BillingStatus BillingStatus          `json:"billing_status"`
	TrialEndsAt   *time.Time             `json:"trial_ends_at,omitempty"`
	Settings      map[string]interface{} `json:"settings"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
	DeletedAt     *time.Time             `json:"deleted_at,omitempty"`
}

// IsActive checks if tenant is active
func (t *Tenant) IsActive() bool {
	return t.Status == StatusActive && t.DeletedAt == nil
}

// CanAccess checks if tenant can be accessed
func (t *Tenant) CanAccess() bool {
	return t.Status == StatusActive || t.Status == StatusPending
}





























