package wa_template

import (
	"time"

	"github.com/google/uuid"
)

// Template is a tenant-scoped plain-text WhatsApp template.
type Template struct {
	ID        uuid.UUID `json:"id"`
	TenantID  uuid.UUID `json:"tenant_id"`
	Name      string    `json:"name"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}


