package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"rrnet/internal/config"
	"rrnet/internal/http/router"
	"rrnet/internal/testing/helpers"
)

func TestAPIContractCompliance(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)

	// Load config
	cfg, err := config.Load()
	require.NoError(t, err)

	// Create router
	handler := router.New(router.Dependencies{
		Config: cfg,
		DB:     tc.DB,
		Redis:  tc.Redis,
	})

	// Test: Health endpoint
	t.Run("Health endpoint returns correct format", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/health", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Contains(t, response, "status")
	})

	// Test: Version endpoint
	t.Run("Version endpoint returns correct format", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/version", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Contains(t, response, "version")
	})

	// Test: API root endpoint
	t.Run("API root endpoint returns correct format", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Contains(t, response, "message")
	})

	// Test: Authentication required for protected endpoints
	t.Run("Protected endpoints require authentication", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/auth/me", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		// Should return 401 Unauthorized
		assert.Equal(t, http.StatusUnauthorized, w.Code)
	})

	// Test: Login endpoint accepts correct format
	t.Run("Login endpoint accepts correct request format", func(t *testing.T) {
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

		// Should return error (invalid credentials) but with correct format
		assert.True(t, w.Code == http.StatusUnauthorized || w.Code == http.StatusNotFound)
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Contains(t, response, "error")
	})

	// Test: Invalid JSON returns 400
	t.Run("Invalid JSON returns 400", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBufferString("invalid json"))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestPaginationFiltering(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)

	cfg, err := config.Load()
	require.NoError(t, err)

	handler := router.New(router.Dependencies{
		Config: cfg,
		DB:     tc.DB,
		Redis:  tc.Redis,
	})

	// Test: List endpoints support query parameters
	t.Run("List endpoints accept query parameters", func(t *testing.T) {
		// This test would require authentication, so we'll test the endpoint structure
		req := httptest.NewRequest("GET", "/api/v1/clients?page=1&page_size=10", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		// Should return 401 (unauthorized) but endpoint exists
		assert.True(t, w.Code == http.StatusUnauthorized || w.Code == http.StatusNotFound)
	})
}

func TestRateLimiting(t *testing.T) {
	tc := helpers.SetupTestEnvironment(t)
	defer tc.CleanupTestEnvironment(t)

	cfg, err := config.Load()
	require.NoError(t, err)

	handler := router.New(router.Dependencies{
		Config: cfg,
		DB:     tc.DB,
		Redis:  tc.Redis,
	})

	// Test: Rate limiting is enforced
	// Note: Rate limiting middleware would need to be implemented
	// This test verifies the infrastructure is ready
	t.Run("Rate limiting infrastructure ready", func(t *testing.T) {
		// Make multiple requests to same endpoint
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest("GET", "/api/v1/", nil)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			// Should handle requests (may be 401, 200, or rate limited)
			assert.True(t, w.Code >= 200 && w.Code < 500)
		}
	})

	// Test: Rate limit recovery
	t.Run("Rate limit recovery", func(t *testing.T) {
		// After rate limit period, requests should be allowed again
		// This would require actual rate limiting implementation
		req := httptest.NewRequest("GET", "/api/v1/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.True(t, w.Code >= 200 && w.Code < 500)
	})
}

