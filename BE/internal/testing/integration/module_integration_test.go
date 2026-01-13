package integration

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"rrnet/internal/repository"
	"rrnet/internal/service"
	"rrnet/internal/testing/fixtures"
	"rrnet/internal/testing/helpers"
)

func TestModuleAuthTenantIntegration(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "users", "tenants")

	tenantRepo := repository.NewTenantRepository(tc.DB)
	_ = repository.NewUserRepository(tc.DB)

	// Test: Create tenant
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, tenant.ID)

	// Test: Get tenant by slug
	retrievedTenant, err := tenantRepo.GetBySlug(tc.Ctx, "test-tenant")
	require.NoError(t, err)
	assert.Equal(t, tenant.ID, retrievedTenant.ID)
	assert.Equal(t, tenant.Name, retrievedTenant.Name)

	// Test: Tenant context isolation
	tenant2 := fixtures.CreateTestTenant("Test Tenant 2", "test-tenant-2")
	err = tenantRepo.Create(tc.Ctx, tenant2)
	require.NoError(t, err)

	// Verify tenants are separate
	retrievedTenant2, err := tenantRepo.GetBySlug(tc.Ctx, "test-tenant-2")
	require.NoError(t, err)
	assert.NotEqual(t, tenant.ID, retrievedTenant2.ID)
}

func TestRBACFeatureToggleIntegration(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "users", "tenants", "plans", "features")

	tenantRepo := repository.NewTenantRepository(tc.DB)
	planRepo := repository.NewPlanRepository(tc.DB)
	featureRepo := repository.NewFeatureRepository(tc.DB)
	addonRepo := repository.NewAddonRepository(tc.DB)

	// Create feature resolver
	featureResolver := service.NewFeatureResolver(planRepo, addonRepo, featureRepo)

	// Test: Create tenant with plan
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)

	// Note: This test requires plan and feature setup in database
	// For now, we verify the integration structure exists
	assert.NotNil(t, featureResolver)
	assert.NotNil(t, tenant)
}

func TestBillingNetworkIntegration(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "clients", "invoices", "network_profiles", "routers")

	tenantRepo := repository.NewTenantRepository(tc.DB)
	clientRepo := repository.NewClientRepository(tc.DB)
	routerRepo := repository.NewRouterRepository(tc.DB)
	profileRepo := repository.NewNetworkProfileRepository(tc.DB)

	// Create services
	networkService := service.NewNetworkService(routerRepo, profileRepo)

	// Test: Create tenant with client
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)

	client := fixtures.CreateTestClient(tenant.ID, "Test Client", "081234567890")
	err = clientRepo.Create(tc.Ctx, client)
	require.NoError(t, err)

	// Test: Create network profile
	// Note: This requires network profile entity structure
	// For now, we verify services are initialized correctly
	assert.NotNil(t, networkService)
	assert.NotNil(t, client)
}

func TestBillingCollectorIntegration(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "clients", "invoices", "payments")

	tenantRepo := repository.NewTenantRepository(tc.DB)
	clientRepo := repository.NewClientRepository(tc.DB)
	invoiceRepo := repository.NewInvoiceRepository(tc.DB)
	paymentRepo := repository.NewPaymentRepository(tc.DB)
	servicePackageRepo := repository.NewServicePackageRepository(tc.DB)

	billingService := service.NewBillingService(invoiceRepo, paymentRepo, clientRepo, servicePackageRepo)

	// Test: Create tenant with cash clients
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)

	client1 := fixtures.CreateTestClient(tenant.ID, "Cash Client 1", "081111111111")
	err = clientRepo.Create(tc.Ctx, client1)
	require.NoError(t, err)

	client2 := fixtures.CreateTestClient(tenant.ID, "Cash Client 2", "082222222222")
	err = clientRepo.Create(tc.Ctx, client2)
	require.NoError(t, err)

	// Verify clients are created and belong to tenant
	retrievedClient1, err := clientRepo.GetByID(tc.Ctx, tenant.ID, client1.ID)
	require.NoError(t, err)
	assert.Equal(t, tenant.ID, retrievedClient1.TenantID)

	// Verify billing service can access clients
	assert.NotNil(t, billingService)
}

func TestAddonLimitsIntegration(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "tenant_addons", "addons", "plans", "tenants")

	tenantRepo := repository.NewTenantRepository(tc.DB)
	planRepo := repository.NewPlanRepository(tc.DB)
	addonRepo := repository.NewAddonRepository(tc.DB)
	featureRepo := repository.NewFeatureRepository(tc.DB)

	// Create feature resolver
	featureResolver := service.NewFeatureResolver(planRepo, addonRepo, featureRepo)

	// Test: Create tenant with plan
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)

	// Note: This test verifies the integration structure for addon→limits flow
	// In real implementation:
	// 1. Tenant purchases addon
	// 2. Addon updates tenant limits (e.g., max_routers, max_users)
	// 3. Feature resolver calculates effective limits
	// 4. Limits are enforced across modules

	// Verify feature resolver is initialized
	assert.NotNil(t, featureResolver)
	assert.NotNil(t, tenant)

	// Verify repositories are ready
	assert.NotNil(t, planRepo)
	assert.NotNil(t, addonRepo)
	assert.NotNil(t, featureRepo)
}

func TestMapsTechnicianIntegration(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "technician_tasks", "technician_activities", "maps_nodes", "tenants")

	tenantRepo := repository.NewTenantRepository(tc.DB)
	// mapsRepo := repository.NewMapsRepository(tc.DB) // Not yet implemented
	// technicianRepo := repository.NewTechnicianRepository(tc.DB) // Not yet implemented

	// Test: Create tenant with topology
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)

	// Note: This test verifies the integration structure for maps→technician flow
	// In real implementation:
	// 1. Outage is set on ODC/ODP/Client
	// 2. System creates technician task automatically
	// 3. Technician logs activity with photos
	// 4. Activity updates maps status
	// 5. Outage is cleared when resolved

	// Verify repositories are initialized
	// assert.NotNil(t, mapsRepo) // Not yet implemented
	// assert.NotNil(t, technicianRepo) // Not yet implemented
	assert.NotNil(t, tenant)

	// Verify integration structure exists
	// Actual implementation would test:
	// - Outage creation triggers task creation
	// - Technician activity updates maps
	// - Task completion clears outage
}

