package helpers

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	redisclient "github.com/go-redis/redis/v8"

	"rrnet/internal/config"
	"rrnet/internal/infra/postgres"
	redisinfra "rrnet/internal/infra/redis"
)

// TestConfig holds test configuration
type TestConfig struct {
	DB    *pgxpool.Pool
	Redis *redisclient.Client
	Ctx   context.Context
}

// SetupTestEnvironment sets up test environment with database and redis
func SetupTestEnvironment(t *testing.T) *TestConfig {
	t.Helper()

	ctx := context.Background()

	// Load test config
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	// Override with test database if TEST_DATABASE_URL is set
	testDBURL := os.Getenv("TEST_DATABASE_URL")
	if testDBURL == "" {
		testDBURL = cfg.Database.URL
	}

	// Setup database
	dbPool, err := postgres.NewPool(ctx, testDBURL)
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	// Setup redis
	testRedisAddr := os.Getenv("TEST_REDIS_ADDR")
	if testRedisAddr == "" {
		testRedisAddr = cfg.Redis.Addr
	}

	rdb := redisinfra.NewClient(testRedisAddr, cfg.Redis.Password, cfg.Redis.DB)

	// Test redis connection
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Fatalf("Failed to connect to test redis: %v", err)
	}

	return &TestConfig{
		DB:    dbPool,
		Redis: rdb,
		Ctx:   ctx,
	}
}

// CleanupTestEnvironment cleans up test environment
func (tc *TestConfig) CleanupTestEnvironment(t *testing.T) {
	t.Helper()

	if tc.DB != nil {
		tc.DB.Close()
	}

	if tc.Redis != nil {
		tc.Redis.Close()
	}
}

// TruncateTables truncates all tables for clean test state
func (tc *TestConfig) TruncateTables(t *testing.T, tables ...string) {
	t.Helper()

	if len(tables) == 0 {
		// Default tables to truncate
		tables = []string{
			"payments",
			"invoices",
			"clients",
			"users",
			"tenants",
		}
	}

	for _, table := range tables {
		_, err := tc.DB.Exec(tc.Ctx, "TRUNCATE TABLE "+table+" CASCADE")
		if err != nil {
			t.Logf("Warning: Failed to truncate table %s: %v", table, err)
		}
	}
}

