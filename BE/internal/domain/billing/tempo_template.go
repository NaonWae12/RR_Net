package billing

import (
	"time"

	"github.com/google/uuid"
)

// TempoTemplate is a tenant-scoped named template for monthly due-day (1-31).
type TempoTemplate struct {
	ID          uuid.UUID `json:"id"`
	TenantID    uuid.UUID `json:"tenant_id"`
	Name        string    `json:"name"`
	DueDay      int       `json:"due_day"` // 1-31
	Description *string   `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}


