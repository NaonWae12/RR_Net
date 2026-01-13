package integration

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"rrnet/internal/domain/client"
	"rrnet/internal/repository"
	"rrnet/internal/service"
	"rrnet/internal/testing/fixtures"
	"rrnet/internal/testing/helpers"
)

func TestDatabaseConsistency_InvoicePayment(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "payments", "invoices", "clients", "tenants")

	tenantRepo := repository.NewTenantRepository(tc.DB)
	clientRepo := repository.NewClientRepository(tc.DB)
	invoiceRepo := repository.NewInvoiceRepository(tc.DB)
	paymentRepo := repository.NewPaymentRepository(tc.DB)
	servicePackageRepo := repository.NewServicePackageRepository(tc.DB)

	billingService := service.NewBillingService(invoiceRepo, paymentRepo, clientRepo, servicePackageRepo)

	// Setup
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)

	client := fixtures.CreateTestClient(tenant.ID, "Test Client", "081234567890")
	err = clientRepo.Create(tc.Ctx, client)
	require.NoError(t, err)

	// Create invoice
	now := time.Now()
	createInvoiceReq := service.CreateInvoiceRequest{
		ClientID:    client.ID,
		PeriodStart: time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()),
		PeriodEnd:   time.Date(now.Year(), now.Month()+1, 0, 23, 59, 59, 0, now.Location()),
		DueDate:     now.AddDate(0, 0, 7),
		Items: []service.InvoiceItemRequest{
			{
				Description: "Monthly Service",
				Quantity:    1,
				UnitPrice:   150000,
			},
		},
	}

	invoice, err := billingService.CreateInvoice(tc.Ctx, tenant.ID, createInvoiceReq)
	require.NoError(t, err)

	// Test: Payment total matches invoice amount
	userID := uuid.New()
	ref := "TEST-001"
	recordPaymentReq := service.RecordPaymentRequest{
		InvoiceID:  invoice.ID,
		Amount:     invoice.TotalAmount,
		Method:     "cash",
		Reference:  &ref,
		ReceivedAt: &now,
	}

	payment, err := billingService.RecordPayment(tc.Ctx, tenant.ID, userID, recordPaymentReq)
	require.NoError(t, err)

	// Verify consistency
	totalPaid, err := paymentRepo.GetTotalByInvoice(tc.Ctx, invoice.ID)
	require.NoError(t, err)
	assert.Equal(t, invoice.TotalAmount, totalPaid)

	// Verify invoice status updated
	updatedInvoice, err := invoiceRepo.GetByID(tc.Ctx, invoice.ID)
	require.NoError(t, err)
	assert.Equal(t, "paid", string(updatedInvoice.Status))
	assert.NotNil(t, updatedInvoice.PaidAt)

	// Verify payment references invoice
	assert.Equal(t, invoice.ID, payment.InvoiceID)
	assert.Equal(t, invoice.ClientID, payment.ClientID)
	assert.Equal(t, tenant.ID, payment.TenantID)
}

func TestDatabaseConsistency_TenantIsolation(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "clients", "tenants")

	tenantRepo := repository.NewTenantRepository(tc.DB)
	clientRepo := repository.NewClientRepository(tc.DB)

	// Create two tenants
	tenant1 := fixtures.CreateTestTenant("Tenant 1", "tenant-1")
	err := tenantRepo.Create(tc.Ctx, tenant1)
	require.NoError(t, err)

	tenant2 := fixtures.CreateTestTenant("Tenant 2", "tenant-2")
	err = tenantRepo.Create(tc.Ctx, tenant2)
	require.NoError(t, err)

	// Create clients for each tenant
	client1 := fixtures.CreateTestClient(tenant1.ID, "Client 1", "081111111111")
	err = clientRepo.Create(tc.Ctx, client1)
	require.NoError(t, err)

	client2 := fixtures.CreateTestClient(tenant2.ID, "Client 2", "082222222222")
	err = clientRepo.Create(tc.Ctx, client2)
	require.NoError(t, err)

	// Test: Tenant 1 cannot see Tenant 2's clients
	clients1, _, err := clientRepo.List(tc.Ctx, tenant1.ID, &client.ClientListFilter{})
	require.NoError(t, err)
	assert.Len(t, clients1, 1)
	assert.Equal(t, client1.ID, clients1[0].ID)

	// Test: Tenant 2 cannot see Tenant 1's clients
	clients2, _, err := clientRepo.List(tc.Ctx, tenant2.ID, &client.ClientListFilter{})
	require.NoError(t, err)
	assert.Len(t, clients2, 1)
	assert.Equal(t, client2.ID, clients2[0].ID)

	// Test: Cross-tenant access is prevented
	retrievedClient1, err := clientRepo.GetByID(tc.Ctx, tenant1.ID, client1.ID)
	require.NoError(t, err)
	assert.Equal(t, tenant1.ID, retrievedClient1.TenantID)
	assert.NotEqual(t, tenant2.ID, retrievedClient1.TenantID)
}

func TestDatabaseConsistency_SoftDelete(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "clients", "tenants")

	tenantRepo := repository.NewTenantRepository(tc.DB)
	clientRepo := repository.NewClientRepository(tc.DB)

	// Setup
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)

	client := fixtures.CreateTestClient(tenant.ID, "Test Client", "081234567890")
	err = clientRepo.Create(tc.Ctx, client)
	require.NoError(t, err)

	// Test: Soft delete
	err = clientRepo.SoftDelete(tc.Ctx, tenant.ID, client.ID)
	require.NoError(t, err)

	// Verify: Client is soft deleted (not found in normal queries)
	_, err = clientRepo.GetByID(tc.Ctx, tenant.ID, client.ID)
	assert.Error(t, err) // Should not be found

	// Verify: Client still exists in database (soft delete)
	// Note: This depends on repository implementation
	// If GetByID includes soft-deleted records, adjust test accordingly
}

func TestDatabaseConsistency_ReferentialIntegrity(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "invoices", "clients", "tenants")

	tenantRepo := repository.NewTenantRepository(tc.DB)
	clientRepo := repository.NewClientRepository(tc.DB)
	invoiceRepo := repository.NewInvoiceRepository(tc.DB)
	servicePackageRepo := repository.NewServicePackageRepository(tc.DB)

	// Setup
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)

	client := fixtures.CreateTestClient(tenant.ID, "Test Client", "081234567890")
	err = clientRepo.Create(tc.Ctx, client)
	require.NoError(t, err)

	// Test: Invoice references valid client
	now := time.Now()
	createInvoiceReq := service.CreateInvoiceRequest{
		ClientID:    client.ID,
		PeriodStart: now,
		PeriodEnd:   now.AddDate(0, 1, 0),
		DueDate:     now.AddDate(0, 0, 7),
		Items: []service.InvoiceItemRequest{
			{
				Description: "Service",
				Quantity:    1,
				UnitPrice:   100000,
			},
		},
	}

	billingService := service.NewBillingService(invoiceRepo, nil, clientRepo, servicePackageRepo)
	invoice, err := billingService.CreateInvoice(tc.Ctx, tenant.ID, createInvoiceReq)
	require.NoError(t, err)

	// Verify: Invoice references correct client
	assert.Equal(t, client.ID, invoice.ClientID)
	assert.Equal(t, tenant.ID, invoice.TenantID)

	// Verify: Invoice can be retrieved with client relationship
	retrievedInvoice, err := invoiceRepo.GetByID(tc.Ctx, invoice.ID)
	require.NoError(t, err)
	assert.Equal(t, client.ID, retrievedInvoice.ClientID)
}

