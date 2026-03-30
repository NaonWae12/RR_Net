package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"rrnet/internal/auth"
	"rrnet/internal/domain/tenant"
	"rrnet/internal/domain/user"
	"rrnet/internal/repository"
	"rrnet/internal/testing/helpers"
)

func TestAuthEndpoints_Login(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "users", "tenants", "roles")

	// Setup test data
	tenantRepo := repository.NewTenantRepository(tc.DB)
	userRepo := repository.NewUserRepository(tc.DB)

	// Create tenant
	tenantID := uuid.New()
	now := time.Now()
	tenantEntity := &tenant.Tenant{
		ID:            tenantID,
		Name:          "Test Tenant",
		Slug:          "test-tenant",
		Status:        tenant.StatusActive,
		BillingStatus: tenant.BillingStatusActive,
		Settings:      make(map[string]interface{}),
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	err := tenantRepo.Create(tc.Ctx, tenantEntity)
	require.NoError(t, err)

	// Get role (assuming roles are seeded)
	role, err := userRepo.GetRoleByCode(tc.Ctx, "admin")
	if err != nil {
		// Skip test if roles not set up
		t.Skip("Roles not set up in test database")
	}

	// Create user
	passwordHash, err := auth.HashPassword("testpassword123")
	require.NoError(t, err)

	userID := uuid.New()
	userEntity := &user.User{
		ID:           userID,
		TenantID:     &tenantID,
		RoleID:       role.ID,
		Email:        "test@example.com",
		PasswordHash: passwordHash,
		Name:         "Test User",
		Status:       user.StatusActive,
		Metadata:     make(map[string]interface{}),
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	err = userRepo.Create(tc.Ctx, userEntity)
	require.NoError(t, err)

	// Setup router
	handler := setupTestRouter(tc)

	// Test login
	loginReq := map[string]string{
		"email":    "test@example.com",
		"password": "testpassword123",
	}
	body, _ := json.Marshal(loginReq)

	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-Slug", "test-tenant")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.NotEmpty(t, response["access_token"])
	assert.NotEmpty(t, response["refresh_token"])
}

func TestAuthEndpoints_Login_InvalidCredentials(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)
	defer tc.TruncateTables(t, "users", "tenants", "roles")

	handler := setupTestRouter(tc)

	loginReq := map[string]string{
		"email":    "nonexistent@example.com",
		"password": "wrongpassword",
	}
	body, _ := json.Marshal(loginReq)

	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "Invalid")
}

func TestAuthEndpoints_HealthCheck(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)

	handler := setupTestRouter(tc)

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.NotEmpty(t, response["status"])
}

func TestAuthEndpoints_Version(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)

	handler := setupTestRouter(tc)

	req := httptest.NewRequest("GET", "/version", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.NotEmpty(t, response)
}

// setupTestRouter creates a test router with minimal dependencies
func setupTestRouter(_ *helpers.TestConfig) http.Handler {
	// This is a simplified version - in real implementation,
	// you'd use the actual router.New() with test dependencies
	// For now, this serves as a template

	// Note: This requires the actual router setup which depends on
	// many dependencies. In a real scenario, you'd create a test helper
	// that sets up all dependencies properly.

	// Placeholder - actual implementation would use router.New()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotImplemented)
	})
}
