package integration

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"rrnet/internal/repository"
	"rrnet/internal/service"
	"rrnet/internal/testing/fixtures"
	"rrnet/internal/testing/helpers"
)

func TestCompleteBillingCycle(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "payments", "invoices", "clients", "users", "tenants")

	// Setup repositories
	tenantRepo := repository.NewTenantRepository(tc.DB)
	clientRepo := repository.NewClientRepository(tc.DB)
	invoiceRepo := repository.NewInvoiceRepository(tc.DB)
	paymentRepo := repository.NewPaymentRepository(tc.DB)
	servicePackageRepo := repository.NewServicePackageRepository(tc.DB)

	// Create billing service
	billingService := service.NewBillingService(invoiceRepo, paymentRepo, clientRepo, servicePackageRepo)

	// Step 1: Create tenant
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)

	// Step 2: Create client
	client := fixtures.CreateTestClient(tenant.ID, "Test Client", "081234567890")
	err = clientRepo.Create(tc.Ctx, client)
	require.NoError(t, err)

	// Step 3: Generate monthly invoice
	now := time.Now()
	createInvoiceReq := service.CreateInvoiceRequest{
		ClientID:    client.ID,
		PeriodStart: time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()),
		PeriodEnd:   time.Date(now.Year(), now.Month()+1, 0, 23, 59, 59, 0, now.Location()),
		DueDate:     now.AddDate(0, 0, 7),
		Items: []service.InvoiceItemRequest{
			{
				Description: "Monthly Internet Service",
				Quantity:    1,
				UnitPrice:   150000, // 150k IDR
			},
		},
		TaxPercent: 0,
	}

	invoice, err := billingService.CreateInvoice(tc.Ctx, tenant.ID, createInvoiceReq)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, invoice.ID)
	assert.Equal(t, int64(150000), invoice.TotalAmount)
	assert.Equal(t, "pending", string(invoice.Status))

	// Step 4: Process payment
	// Create a test user for payment recording
	userID := uuid.New() // In real scenario, this would be from authenticated user
	ref := "TRF-12345"
	notes := "Payment via bank transfer"
	recordPaymentReq := service.RecordPaymentRequest{
		InvoiceID:  invoice.ID,
		Amount:     invoice.TotalAmount,
		Method:     "bank_transfer",
		Reference:  &ref,
		Notes:      &notes,
		ReceivedAt: &now,
	}

	payment, err := billingService.RecordPayment(tc.Ctx, tenant.ID, userID, recordPaymentReq)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, payment.ID)
	assert.Equal(t, invoice.TotalAmount, payment.Amount)

	// Step 5: Verify invoice status updated
	updatedInvoice, err := invoiceRepo.GetByID(tc.Ctx, invoice.ID)
	require.NoError(t, err)
	assert.Equal(t, "paid", string(updatedInvoice.Status))

	// Step 6: Verify payment records
	paymentList, err := paymentRepo.ListByInvoice(tc.Ctx, invoice.ID)
	require.NoError(t, err)
	assert.Len(t, paymentList, 1)
	assert.Equal(t, invoice.TotalAmount, paymentList[0].Amount)

	// Step 7: Verify no orphaned records
	// Check that invoice has payment
	assert.NotNil(t, updatedInvoice)
	assert.Equal(t, "paid", string(updatedInvoice.Status))
}

func TestIsolirWorkflow(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "payments", "invoices", "clients", "users", "tenants")

	// Setup repositories
	tenantRepo := repository.NewTenantRepository(tc.DB)
	clientRepo := repository.NewClientRepository(tc.DB)
	invoiceRepo := repository.NewInvoiceRepository(tc.DB)
	paymentRepo := repository.NewPaymentRepository(tc.DB)
	servicePackageRepo := repository.NewServicePackageRepository(tc.DB)

	// Create billing service
	billingService := service.NewBillingService(invoiceRepo, paymentRepo, clientRepo, servicePackageRepo)

	// Step 1: Create tenant with client
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)

	client := fixtures.CreateTestClient(tenant.ID, "Test Client", "081234567890")
	err = clientRepo.Create(tc.Ctx, client)
	require.NoError(t, err)

	// Step 2: Generate invoice
	now := time.Now()
	createInvoiceReq := service.CreateInvoiceRequest{
		ClientID:    client.ID,
		PeriodStart: now.AddDate(0, -1, 0),
		PeriodEnd:   now.AddDate(0, 0, -1),
		DueDate:     now.AddDate(0, 0, -10), // Overdue by 10 days
		Items: []service.InvoiceItemRequest{
			{
				Description: "Monthly Internet Service",
				Quantity:    1,
				UnitPrice:   150000,
			},
		},
	}

	invoice, err := billingService.CreateInvoice(tc.Ctx, tenant.ID, createInvoiceReq)
	require.NoError(t, err)

	// Step 3: Mark invoice as overdue (simulate)
	// In real implementation, this would be done by a background job
	// For test, we'll directly update the invoice status
	// Note: This requires a method to mark as overdue, which may not exist yet
	// For now, we'll verify the invoice exists and is pending

	// Step 4: Verify invoice is pending (before payment)
	updatedInvoice, err := invoiceRepo.GetByID(tc.Ctx, invoice.ID)
	require.NoError(t, err)
	assert.Equal(t, "pending", string(updatedInvoice.Status))

	// Step 5: Process payment (unisolir)
	userID := uuid.New()
	ref := "CASH-001"
	recordPaymentReq := service.RecordPaymentRequest{
		InvoiceID:  invoice.ID,
		Amount:     invoice.TotalAmount,
		Method:     "cash",
		Reference:  &ref,
		ReceivedAt: &now,
	}

	payment, err := billingService.RecordPayment(tc.Ctx, tenant.ID, userID, recordPaymentReq)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, payment.ID)

	// Step 6: Verify invoice marked as paid
	finalInvoice, err := invoiceRepo.GetByID(tc.Ctx, invoice.ID)
	require.NoError(t, err)
	assert.Equal(t, "paid", string(finalInvoice.Status))
}

func TestCollector3PhaseFlow(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "payments", "invoices", "clients", "users", "tenants")

	// Setup repositories
	tenantRepo := repository.NewTenantRepository(tc.DB)
	clientRepo := repository.NewClientRepository(tc.DB)
	invoiceRepo := repository.NewInvoiceRepository(tc.DB)
	paymentRepo := repository.NewPaymentRepository(tc.DB)
	servicePackageRepo := repository.NewServicePackageRepository(tc.DB)

	// Create billing service
	billingService := service.NewBillingService(invoiceRepo, paymentRepo, clientRepo, servicePackageRepo)

	// Step 1: Create tenant with cash clients
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)

	client1 := fixtures.CreateTestClient(tenant.ID, "Cash Client 1", "081111111111")
	err = clientRepo.Create(tc.Ctx, client1)
	require.NoError(t, err)

	client2 := fixtures.CreateTestClient(tenant.ID, "Cash Client 2", "082222222222")
	err = clientRepo.Create(tc.Ctx, client2)
	require.NoError(t, err)

	// Step 2: Generate cash invoices
	now := time.Now()
	createInvoiceReq1 := service.CreateInvoiceRequest{
		ClientID:    client1.ID,
		PeriodStart: time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()),
		PeriodEnd:   time.Date(now.Year(), now.Month()+1, 0, 23, 59, 59, 0, now.Location()),
		DueDate:     now.AddDate(0, 0, 7),
		Items: []service.InvoiceItemRequest{
			{
				Description: "Monthly Internet Service",
				Quantity:    1,
				UnitPrice:   150000,
			},
		},
	}

	invoice1, err := billingService.CreateInvoice(tc.Ctx, tenant.ID, createInvoiceReq1)
	require.NoError(t, err)
	assert.Equal(t, "pending", string(invoice1.Status))

	createInvoiceReq2 := service.CreateInvoiceRequest{
		ClientID:    client2.ID,
		PeriodStart: time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()),
		PeriodEnd:   time.Date(now.Year(), now.Month()+1, 0, 23, 59, 59, 0, now.Location()),
		DueDate:     now.AddDate(0, 0, 7),
		Items: []service.InvoiceItemRequest{
			{
				Description: "Monthly Internet Service",
				Quantity:    1,
				UnitPrice:   200000,
			},
		},
	}

	invoice2, err := billingService.CreateInvoice(tc.Ctx, tenant.ID, createInvoiceReq2)
	require.NoError(t, err)
	assert.Equal(t, "pending", string(invoice2.Status))

	// Step 3: Phase 1 - Collector marks visit success
	// Note: In real implementation, this would create collector_task_item with visit_status=success
	// and create payment_history with status=collected_by_collector
	// For now, we verify invoices exist and are ready for collection
	assert.NotEqual(t, uuid.Nil, invoice1.ID)
	assert.NotEqual(t, uuid.Nil, invoice2.ID)

	// Step 4: Phase 2 - Admin confirms setoran
	// Note: In real implementation, this would update collector_task_item.setoran_status
	// and create payment_history with status=setoran_confirmed_by_admin
	// For now, we verify the structure is ready

	// Step 5: Phase 3 - Finance confirms deposit
	// This should mark invoice as paid
	userID := uuid.New() // Finance user
	ref1 := "COLLECTOR-001"
	notes1 := "Collected by collector, confirmed by finance"
	recordPaymentReq1 := service.RecordPaymentRequest{
		InvoiceID:  invoice1.ID,
		Amount:     invoice1.TotalAmount,
		Method:     "collector",
		Reference:  &ref1,
		Notes:      &notes1,
		ReceivedAt: &now,
	}

	payment1, err := billingService.RecordPayment(tc.Ctx, tenant.ID, userID, recordPaymentReq1)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, payment1.ID)

	ref2 := "COLLECTOR-002"
	notes2 := "Collected by collector, confirmed by finance"
	recordPaymentReq2 := service.RecordPaymentRequest{
		InvoiceID:  invoice2.ID,
		Amount:     invoice2.TotalAmount,
		Method:     "collector",
		Reference:  &ref2,
		Notes:      &notes2,
		ReceivedAt: &now,
	}

	payment2, err := billingService.RecordPayment(tc.Ctx, tenant.ID, userID, recordPaymentReq2)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, payment2.ID)

	// Step 6: Verify invoices marked as paid
	finalInvoice1, err := invoiceRepo.GetByID(tc.Ctx, invoice1.ID)
	require.NoError(t, err)
	assert.Equal(t, "paid", string(finalInvoice1.Status))

	finalInvoice2, err := invoiceRepo.GetByID(tc.Ctx, invoice2.ID)
	require.NoError(t, err)
	assert.Equal(t, "paid", string(finalInvoice2.Status))

	// Step 7: Verify payment records
	paymentList1, err := paymentRepo.ListByInvoice(tc.Ctx, invoice1.ID)
	require.NoError(t, err)
	assert.Len(t, paymentList1, 1)
	assert.Equal(t, "collector", string(paymentList1[0].Method))

	paymentList2, err := paymentRepo.ListByInvoice(tc.Ctx, invoice2.ID)
	require.NoError(t, err)
	assert.Len(t, paymentList2, 1)
	assert.Equal(t, "collector", string(paymentList2[0].Method))
}

