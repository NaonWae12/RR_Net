package fixtures

import (
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/client"
)

// CreateTestClient creates a test client entity
func CreateTestClient(tenantID uuid.UUID, name, phone string) *client.Client {
	now := time.Now()
	phonePtr := &phone
	return &client.Client{
		ID:        uuid.New(),
		TenantID:  tenantID,
		Name:      name,
		Phone:     phonePtr,
		Status:    client.StatusActive,
		CreatedAt: now,
		UpdatedAt: now,
	}
}

// CreateSuspendedClient creates a suspended test client
func CreateSuspendedClient(tenantID uuid.UUID, name, phone string) *client.Client {
	c := CreateTestClient(tenantID, name, phone)
	c.Status = client.StatusSuspended
	return c
}

