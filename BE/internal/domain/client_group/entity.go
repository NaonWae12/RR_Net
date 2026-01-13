package client_group

import (
	"time"

	"github.com/google/uuid"
)

// ClientGroup is a tenant-scoped label to organize clients.
type ClientGroup struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}


