package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"rrnet/internal/auth"
	"rrnet/internal/service"
)

// MockAuthService is a mock implementation of AuthService
type MockAuthService struct {
	mock.Mock
}

func (m *MockAuthService) Login(ctx context.Context, tenantID *uuid.UUID, req *service.LoginRequest) (*service.LoginResponse, error) {
	args := m.Called(ctx, tenantID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.LoginResponse), args.Error(1)
}

func (m *MockAuthService) RefreshToken(ctx context.Context, req *service.RefreshTokenRequest) (*service.LoginResponse, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.LoginResponse), args.Error(1)
}

func (m *MockAuthService) Register(ctx context.Context, tenantID uuid.UUID, roleCode string, req *service.RegisterRequest) (*service.UserDTO, error) {
	args := m.Called(ctx, tenantID, roleCode, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.UserDTO), args.Error(1)
}

func (m *MockAuthService) GetProfile(ctx context.Context, userID uuid.UUID) (*service.UserDTO, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.UserDTO), args.Error(1)
}

func (m *MockAuthService) ChangePassword(ctx context.Context, userID uuid.UUID, req *service.ChangePasswordRequest) error {
	args := m.Called(ctx, userID, req)
	return args.Error(0)
}

// Ensure MockAuthService implements AuthServiceInterface
var _ AuthServiceInterface = (*MockAuthService)(nil)

func TestAuthHandler_Login_Success(t *testing.T) {
	mockService := new(MockAuthService)
	handler := NewAuthHandler(mockService)

	userID := uuid.New()
	tenantID := uuid.New()
	jwtManager := auth.NewJWTManager("test-secret-key-for-tests-min-32-chars", 15*time.Minute, 7*24*time.Hour)

	accessToken, _ := jwtManager.GenerateAccessToken(userID, tenantID, "admin", "test@example.com")
	refreshToken, _ := jwtManager.GenerateRefreshToken(userID, tenantID, "admin", "test@example.com")

	expectedResponse := &service.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    900,
		User: &service.UserDTO{
			ID:    userID,
			Email: "test@example.com",
			Name:  "Test User",
			Role:  "admin",
		},
	}

	mockService.On("Login", mock.Anything, (*uuid.UUID)(nil), mock.Anything).
		Return(expectedResponse, nil)

	reqBody := service.LoginRequest{
		Email:    "test@example.com",
		Password: "password123",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Login(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response service.LoginResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.NotEmpty(t, response.AccessToken)
	assert.NotEmpty(t, response.RefreshToken)
	assert.Equal(t, "test@example.com", response.User.Email)

	mockService.AssertExpectations(t)
}

func TestAuthHandler_Login_InvalidCredentials(t *testing.T) {
	mockService := new(MockAuthService)
	handler := NewAuthHandler(mockService)

	// Test with user not found error
	mockService.On("Login", mock.Anything, (*uuid.UUID)(nil), mock.Anything).
		Return(nil, service.ErrUserNotFound)

	reqBody := service.LoginRequest{
		Email:    "test@example.com",
		Password: "wrongpassword",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Login(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "Email tidak terdaftar", response["error"])

	mockService.AssertExpectations(t)
}

func TestAuthHandler_Login_InvalidJSON(t *testing.T) {
	mockService := new(MockAuthService)
	handler := NewAuthHandler(mockService)

	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Login(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "Invalid request body")
}

func TestAuthHandler_RefreshToken_Success(t *testing.T) {
	mockService := new(MockAuthService)
	handler := NewAuthHandler(mockService)

	userID := uuid.New()
	tenantID := uuid.New()
	jwtManager := auth.NewJWTManager("test-secret-key-for-tests-min-32-chars", 15*time.Minute, 7*24*time.Hour)

	accessToken, _ := jwtManager.GenerateAccessToken(userID, tenantID, "admin", "test@example.com")
	refreshToken, _ := jwtManager.GenerateRefreshToken(userID, tenantID, "admin", "test@example.com")

	expectedResponse := &service.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    900,
		User: &service.UserDTO{
			ID:    userID,
			Email: "test@example.com",
			Name:  "Test User",
			Role:  "admin",
		},
	}

	mockService.On("RefreshToken", mock.Anything, mock.Anything).
		Return(expectedResponse, nil)

	reqBody := service.RefreshTokenRequest{
		RefreshToken: refreshToken,
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/api/v1/auth/refresh", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.RefreshToken(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response service.LoginResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.NotEmpty(t, response.AccessToken)
	assert.NotEmpty(t, response.RefreshToken)

	mockService.AssertExpectations(t)
}
