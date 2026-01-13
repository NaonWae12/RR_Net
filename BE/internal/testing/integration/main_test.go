package integration

import (
	"os"
	"testing"
)

// TestMain skips integration tests unless required env vars are configured.
// These tests require a running database and other services; in local/unit runs
// we allow `go test ./...` to pass without external dependencies.
func TestMain(m *testing.M) {
	if os.Getenv("DATABASE_URL") == "" {
		os.Exit(0)
	}
	os.Exit(m.Run())
}


