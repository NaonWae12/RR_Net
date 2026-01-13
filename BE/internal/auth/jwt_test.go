package auth

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJWTManager_GenerateAccessToken(t *testing.T) {
	manager := NewJWTManager("test-secret-key-for-jwt-tests-min-32-chars", 15*time.Minute, 7*24*time.Hour)

	userID := uuid.New()
	tenantID := uuid.New()
	role := "admin"
	email := "test@example.com"

	token, err := manager.GenerateAccessToken(userID, tenantID, role, email)
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	// Validate the token
	claims, err := manager.ValidateAccessToken(token)
	require.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, tenantID, claims.TenantID)
	assert.Equal(t, role, claims.Role)
	assert.Equal(t, email, claims.Email)
	assert.Equal(t, AccessToken, claims.TokenType)
}

func TestJWTManager_GenerateRefreshToken(t *testing.T) {
	manager := NewJWTManager("test-secret-key-for-jwt-tests-min-32-chars", 15*time.Minute, 7*24*time.Hour)

	userID := uuid.New()
	tenantID := uuid.New()
	role := "admin"
	email := "test@example.com"

	token, err := manager.GenerateRefreshToken(userID, tenantID, role, email)
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	// Validate the token
	claims, err := manager.ValidateRefreshToken(token)
	require.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, tenantID, claims.TenantID)
	assert.Equal(t, role, claims.Role)
	assert.Equal(t, RefreshToken, claims.TokenType)
}

func TestJWTManager_InvalidToken(t *testing.T) {
	manager := NewJWTManager("test-secret-key-for-jwt-tests-min-32-chars", 15*time.Minute, 7*24*time.Hour)

	// Test with invalid token
	_, err := manager.ValidateAccessToken("invalid-token")
	assert.Error(t, err)
	assert.Equal(t, ErrInvalidToken, err)

	// Test with empty token
	_, err = manager.ValidateAccessToken("")
	assert.Error(t, err)
}

func TestJWTManager_TokenTypeMismatch(t *testing.T) {
	manager := NewJWTManager("test-secret-key-for-jwt-tests-min-32-chars", 15*time.Minute, 7*24*time.Hour)

	userID := uuid.New()
	tenantID := uuid.New()

	// Generate access token
	accessToken, err := manager.GenerateAccessToken(userID, tenantID, "admin", "test@example.com")
	require.NoError(t, err)

	// Try to validate as refresh token (should fail)
	_, err = manager.ValidateRefreshToken(accessToken)
	assert.Error(t, err)
	assert.Equal(t, ErrInvalidToken, err)

	// Generate refresh token
	refreshToken, err := manager.GenerateRefreshToken(userID, tenantID, "admin", "test@example.com")
	require.NoError(t, err)

	// Try to validate as access token (should fail)
	_, err = manager.ValidateAccessToken(refreshToken)
	assert.Error(t, err)
	assert.Equal(t, ErrInvalidToken, err)
}

func TestJWTManager_DifferentSecrets(t *testing.T) {
	manager1 := NewJWTManager("secret-key-1-for-jwt-tests-min-32-chars", 15*time.Minute, 7*24*time.Hour)
	manager2 := NewJWTManager("secret-key-2-for-jwt-tests-min-32-chars", 15*time.Minute, 7*24*time.Hour)

	userID := uuid.New()
	tenantID := uuid.New()

	// Generate token with manager1
	token, err := manager1.GenerateAccessToken(userID, tenantID, "admin", "test@example.com")
	require.NoError(t, err)

	// Try to validate with manager2 (should fail - different secret)
	_, err = manager2.ValidateAccessToken(token)
	assert.Error(t, err)
}

func TestJWTManager_TokenExpiration(t *testing.T) {
	// Use very short TTL for testing
	manager := NewJWTManager("test-secret-key-for-jwt-tests-min-32-chars", 1*time.Second, 7*24*time.Hour)

	userID := uuid.New()
	tenantID := uuid.New()

	// Generate token
	token, err := manager.GenerateAccessToken(userID, tenantID, "admin", "test@example.com")
	require.NoError(t, err)

	// Token should be valid immediately
	_, err = manager.ValidateAccessToken(token)
	assert.NoError(t, err)

	// Wait for token to expire
	time.Sleep(2 * time.Second)

	// Token should now be expired
	_, err = manager.ValidateAccessToken(token)
	assert.Error(t, err)
	assert.Equal(t, ErrExpiredToken, err)
}

