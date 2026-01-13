package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/service"
)

// AuthServiceInterface defines the interface for authentication service
type AuthServiceInterface interface {
	Login(ctx context.Context, tenantID *uuid.UUID, req *service.LoginRequest) (*service.LoginResponse, error)
	RefreshToken(ctx context.Context, req *service.RefreshTokenRequest) (*service.LoginResponse, error)
	Register(ctx context.Context, tenantID uuid.UUID, roleCode string, req *service.RegisterRequest) (*service.UserDTO, error)
	GetProfile(ctx context.Context, userID uuid.UUID) (*service.UserDTO, error)
	ChangePassword(ctx context.Context, userID uuid.UUID, req *service.ChangePasswordRequest) error
}

// AuthHandler handles authentication HTTP endpoints
type AuthHandler struct {
	authService AuthServiceInterface
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService AuthServiceInterface) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Login handles POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req service.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Get tenant ID from context (set by tenant middleware)
	tenantID := getTenantIDFromContext(r.Context())

	response, err := h.authService.Login(r.Context(), tenantID, &req)
	if err != nil {
		switch err {
		case service.ErrUserNotFound:
			sendError(w, http.StatusUnauthorized, "Email tidak terdaftar")
		case service.ErrWrongPassword:
			sendError(w, http.StatusUnauthorized, "Password salah")
		case service.ErrUserNotActive:
			sendError(w, http.StatusForbidden, "User account is not active")
		case service.ErrTenantNotActive:
			sendError(w, http.StatusForbidden, "Tenant is not active")
		default:
			sendError(w, http.StatusInternalServerError, "Internal server error")
		}
		return
	}

	sendJSON(w, http.StatusOK, response)
}

// RefreshToken handles POST /api/v1/auth/refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req service.RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	response, err := h.authService.RefreshToken(r.Context(), &req)
	if err != nil {
		switch err {
		case auth.ErrExpiredToken:
			sendError(w, http.StatusUnauthorized, "Refresh token expired")
		case auth.ErrInvalidToken:
			sendError(w, http.StatusUnauthorized, "Invalid refresh token")
		case service.ErrUserNotActive:
			sendError(w, http.StatusForbidden, "User account is not active")
		default:
			sendError(w, http.StatusInternalServerError, "Internal server error")
		}
		return
	}

	sendJSON(w, http.StatusOK, response)
}

// Register handles POST /api/v1/auth/register
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req service.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Get tenant ID from context
	tenantID := getTenantIDFromContext(r.Context())
	if tenantID == nil {
		sendError(w, http.StatusBadRequest, "Tenant context required for registration")
		return
	}

	// Default role for self-registration is "client"
	user, err := h.authService.Register(r.Context(), *tenantID, "client", &req)
	if err != nil {
		switch err {
		case auth.ErrPasswordTooShort:
			sendError(w, http.StatusBadRequest, "Password must be at least 8 characters")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to register user")
		}
		return
	}

	sendJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "User registered successfully",
		"user":    user,
	})
}

// Me handles GET /api/v1/auth/me
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by auth middleware)
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	user, err := h.authService.GetProfile(r.Context(), userID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to get profile")
		return
	}

	sendJSON(w, http.StatusOK, user)
}

// ChangePassword handles POST /api/v1/auth/change-password
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	var req service.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	err := h.authService.ChangePassword(r.Context(), userID, &req)
	if err != nil {
		switch err {
		case service.ErrInvalidCredentials:
			sendError(w, http.StatusUnauthorized, "Current password is incorrect")
		case auth.ErrPasswordTooShort:
			sendError(w, http.StatusBadRequest, "New password must be at least 8 characters")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to change password")
		}
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{
		"message": "Password changed successfully",
	})
}

// Logout handles POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// Stateless JWT - client discards token
	// Optionally could add token to a blacklist here
	sendJSON(w, http.StatusOK, map[string]string{
		"message": "Logged out successfully",
	})
}

// Helper functions

func getTenantIDFromContext(ctx context.Context) *uuid.UUID {
	id, ok := auth.GetTenantID(ctx)
	if !ok || id == (uuid.UUID{}) {
		return nil
	}
	return &id
}

func sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func sendError(w http.ResponseWriter, status int, message string) {
	sendJSON(w, status, map[string]string{
		"error": message,
	})
}

// Path parameter context key
type pathParamKey string

const PathParamsKey pathParamKey = "path_params"

// getPathParam retrieves a path parameter from context
func getPathParam(r *http.Request, key string) string {
	params, ok := r.Context().Value(PathParamsKey).(map[string]string)
	if !ok {
		return ""
	}
	return params[key]
}

