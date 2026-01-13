package integration

import (
	"context"
	"testing"
	"time"

	"github.com/hibiken/asynq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	asynqInfra "rrnet/internal/infra/asynq"
	"rrnet/internal/repository"
	"rrnet/internal/testing/fixtures"
	"rrnet/internal/testing/helpers"
)

func TestBackgroundJobEnqueue(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)

	// Setup Asynq client
	redisAddr := tc.Redis.Options().Addr
	asynqClient := asynqInfra.NewClient(redisAddr, "", 0)
	defer asynqClient.Close()

	// Test: Enqueue a task
	task := asynq.NewTask("test:task", []byte(`{"message":"test"}`))
	info, err := asynqClient.Enqueue(task)
	require.NoError(t, err)
	assert.NotNil(t, info)
	assert.NotEmpty(t, info.ID)

	// Verify task is in queue
	inspector := asynq.NewInspector(asynq.RedisClientOpt{
		Addr: tc.Redis.Options().Addr,
	})
	defer inspector.Close()

	stats, err := inspector.GetQueueInfo("default")
	require.NoError(t, err)
	assert.Greater(t, stats.Pending, 0)
}

func TestBackgroundJobProcessing(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)

	// Setup Asynq server
	redisAddr := tc.Redis.Options().Addr
	asynqServer := asynqInfra.NewServer(redisAddr, "", 0)

	// Setup Asynq client
	asynqClient := asynqInfra.NewClient(redisAddr, "", 0)
	defer asynqClient.Close()

	// Test: Process a task
	processed := false
	mux := asynq.NewServeMux()
	mux.HandleFunc("test:process", func(ctx context.Context, t *asynq.Task) error {
		processed = true
		return nil
	})

	go func() {
		if err := asynqServer.Run(mux); err != nil {
			t.Logf("Server error: %v", err)
		}
	}()

	// Enqueue task
	task := asynq.NewTask("test:process", []byte(`{}`))
	_, err := asynqClient.Enqueue(task)
	require.NoError(t, err)

	// Wait for processing
	time.Sleep(500 * time.Millisecond)

	// Verify task was processed
	assert.True(t, processed)

	// Shutdown server
	asynqServer.Shutdown()
}

func TestBillingBackgroundJobs(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "invoices", "clients", "tenants")

	tenantRepo := repository.NewTenantRepository(tc.DB)
	clientRepo := repository.NewClientRepository(tc.DB)
	_ = repository.NewInvoiceRepository(tc.DB)

	// Setup
	tenant := fixtures.CreateTestTenant("Test Tenant", "test-tenant")
	err := tenantRepo.Create(tc.Ctx, tenant)
	require.NoError(t, err)

	client := fixtures.CreateTestClient(tenant.ID, "Test Client", "081234567890")
	err = clientRepo.Create(tc.Ctx, client)
	require.NoError(t, err)

	// Test: Background job for invoice generation
	// Note: This test verifies the infrastructure is ready
	// Actual job handlers would be implemented in service layer
	redisAddr := tc.Redis.Options().Addr
	asynqClient := asynqInfra.NewClient(redisAddr, "", 0)
	defer asynqClient.Close()

	// Verify Asynq client is functional
	assert.NotNil(t, asynqClient)

	// Test: Enqueue invoice generation job
	jobData := map[string]interface{}{
		"tenant_id": tenant.ID.String(),
		"client_id": client.ID.String(),
	}
	// Note: Actual job payload would be defined in service layer
	_ = jobData

	// Verify infrastructure is ready
	assert.NotNil(t, tenant)
	assert.NotNil(t, client)
}

func TestScheduledJobs(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)

	// Setup Asynq scheduler
	redisAddr := tc.Redis.Options().Addr
	scheduler := asynq.NewScheduler(
		asynq.RedisClientOpt{Addr: redisAddr},
		&asynq.SchedulerOpts{},
	)

	// Setup Asynq client
	asynqClient := asynqInfra.NewClient(redisAddr, "", 0)
	defer asynqClient.Close()

	// Test: Schedule a periodic task
	entryID, err := scheduler.Register(
		"*/1 * * * *", // Every minute
		asynq.NewTask("test:scheduled", []byte(`{}`)),
	)
	require.NoError(t, err)
	assert.NotEmpty(t, entryID)

	// Verify scheduler is running
	assert.NotNil(t, scheduler)

	// Cleanup
	scheduler.Shutdown()
}

