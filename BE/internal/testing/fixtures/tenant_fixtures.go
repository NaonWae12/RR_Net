package fixtures

import (
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/tenant"
)

// CreateTestTenant creates a test tenant entity
func CreateTestTenant(name, slug string) *tenant.Tenant {
	now := time.Now()
	return &tenant.Tenant{
		ID:            uuid.New(),
		Name:          name,
		Slug:          slug,
		Status:        tenant.StatusActive,
		BillingStatus: tenant.BillingStatusActive,
		Settings:      make(map[string]interface{}),
		CreatedAt:     now,
		UpdatedAt:     now,
	}
}

// CreateTestTenantWithPlan creates a test tenant with plan ID
func CreateTestTenantWithPlan(name, slug string, planID uuid.UUID) *tenant.Tenant {
	t := CreateTestTenant(name, slug)
	t.PlanID = &planID
	return t
}

// CreateSuspendedTenant creates a suspended test tenant
func CreateSuspendedTenant(name, slug string) *tenant.Tenant {
	t := CreateTestTenant(name, slug)
	t.Status = tenant.StatusSuspended
	return t
}

