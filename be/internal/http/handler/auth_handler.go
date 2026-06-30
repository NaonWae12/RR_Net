package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/service"

	"github.com/rs/zerolog/log"
)

// AuthServiceInterface defines the interface for authentication service
type AuthServiceInterface interface {
	Login(ctx context.Context, tenantID *uuid.UUID, req *service.LoginRequest) (*service.LoginResponse, error)
	RefreshToken(ctx context.Context, req *service.RefreshTokenRequest) (*service.LoginResponse, error)
	Register(ctx context.Context, tenantID uuid.UUID, roleCode string, req *service.RegisterRequest) (*service.UserDTO, error)
	GetProfile(ctx context.Context, userID uuid.UUID) (*service.ProfileResponse, error)
	UpdateProfile(ctx context.Context, userID uuid.UUID, req *service.UpdateUserProfileRequest) (*service.UserDTO, error)
	ChangePassword(ctx context.Context, userID uuid.UUID, req *service.ChangePasswordRequest) error
	OAuthLogin(ctx context.Context, oauthUser *auth.OAuthUser) (*service.LoginResponse, error)
	RequestPasswordResetOTP(ctx context.Context, email, method string) (string, error)
	VerifyAndResetPassword(ctx context.Context, email, otp, newPassword string) error
	RequestProfileUpdateOTP(ctx context.Context, userID uuid.UUID, method, value string) error
}

// AuthHandler handles authentication HTTP endpoints
type AuthHandler struct {
	authService  AuthServiceInterface
	oauthManager *auth.OAuthManager
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService AuthServiceInterface, oauthManager *auth.OAuthManager) *AuthHandler {
	return &AuthHandler{
		authService:  authService,
		oauthManager: oauthManager,
	}
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
			log.Error().Err(err).Msg("Login failed with internal error")
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

// UpdateProfile handles PATCH /api/v1/auth/profile
func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	var req service.UpdateUserProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Service uses service.UpdateProfileRequest which we should define or reuse
	user, err := h.authService.UpdateProfile(r.Context(), userID, &req)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to update profile: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Profile updated successfully",
		"user":    user,
	})
}

// RequestProfileUpdateOTP handles POST /api/v1/auth/profile/request-otp
func (h *AuthHandler) RequestProfileUpdateOTP(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Method string `json:"method"` // "email" or "whatsapp"
		Value  string `json:"value"`  // the new email or phone number
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	err := h.authService.RequestProfileUpdateOTP(r.Context(), userID, req.Method, req.Value)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Gagal mengirim OTP: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{
		"message": "OTP berhasil dikirim ke " + req.Value,
	})
}

// OAuthRedirect handles GET /api/v1/auth/{provider}/login
func (h *AuthHandler) OAuthRedirect(w http.ResponseWriter, r *http.Request) {
	provider := auth.OAuthProvider(getPathParam(r, "provider"))
	state := r.URL.Query().Get("state")

	log.Info().Str("provider", string(provider)).Msg("Handling OAuth redirect")

	url, err := h.oauthManager.GetAuthURL(provider, state)
	if err != nil {
		log.Error().Err(err).Str("provider", string(provider)).Msg("Failed to get auth URL")
		sendError(w, http.StatusBadRequest, err.Error())
		return
	}

	log.Info().Str("url", url).Msg("Redirecting to OAuth provider")
	http.Redirect(w, r, url, http.StatusFound)
}

// OAuthCallback handles GET /api/v1/auth/{provider}/callback
func (h *AuthHandler) OAuthCallback(w http.ResponseWriter, r *http.Request) {
	provider := auth.OAuthProvider(getPathParam(r, "provider"))
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")

	log.Info().Str("provider", string(provider)).Str("state", state).Msg("Handling OAuth callback")

	config, err := h.oauthManager.GetConfig(provider)
	if err != nil {
		log.Error().Err(err).Str("provider", string(provider)).Msg("Failed to get config")
		sendError(w, http.StatusBadRequest, err.Error())
		return
	}

	token, err := config.Exchange(r.Context(), code)
	if err != nil {
		log.Error().Err(err).Msg("Failed to exchange token")
		sendError(w, http.StatusBadRequest, "Failed to exchange token")
		return
	}

	oauthUser, err := h.oauthManager.GetUserInfo(r.Context(), provider, token)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get user info")
		sendError(w, http.StatusInternalServerError, "Failed to get user info")
		return
	}

	log.Info().Str("email", oauthUser.Email).Msg("OAuth user info retrieved")

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000" // Fallback
	}

	response, err := h.authService.OAuthLogin(r.Context(), oauthUser)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			// Check if this was a login attempt
			values, parseErr := url.ParseQuery(state)
			if parseErr == nil && values.Get("action") == "login" {
				http.Redirect(w, r, frontendURL+"/login?error=user_not_found", http.StatusFound)
				return
			}

			// Otherwise, redirect back to frontend for registration
			target := fmt.Sprintf("%s/register?email=%s&name=%s&oauth_provider=%s&oauth_id=%s",
				frontendURL, url.QueryEscape(oauthUser.Email), url.QueryEscape(oauthUser.Name), provider, oauthUser.ID)
			
			// If state is present (e.g. plan/billing info), append it
			if state != "" {
				target += "&" + state
			}
			
			http.Redirect(w, r, target, http.StatusFound)
			return
		}
		
		// Handle active status errors
		if errors.Is(err, service.ErrUserNotActive) {
			http.Redirect(w, r, frontendURL+"/login?error=user_inactive", http.StatusFound)
			return
		}
		if errors.Is(err, service.ErrTenantNotActive) {
			http.Redirect(w, r, frontendURL+"/login?error=tenant_inactive", http.StatusFound)
			return
		}

		// General auth failure
		http.Redirect(w, r, frontendURL+"/login?error=auth_failed", http.StatusFound)
		return
	}

	// Success: Redirect with tokens
	target := fmt.Sprintf("%s/callback?access_token=%s&refresh_token=%s",
		frontendURL, response.AccessToken, response.RefreshToken)
	http.Redirect(w, r, target, http.StatusFound)
}

// Logout handles POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// Stateless JWT - client discards token
	// Optionally could add token to a blacklist here
	sendJSON(w, http.StatusOK, map[string]string{
		"message": "Logged out successfully",
	})
}

// ForgotPassword handles POST /api/v1/auth/forgot-password
func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email  string `json:"email"`
		Method string `json:"method"` // "whatsapp" or "email"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Method == "" {
		req.Method = "email" // default to email
	}

	if req.Email == "" {
		sendError(w, http.StatusBadRequest, "Email is required")
		return
	}

	maskedInfo, err := h.authService.RequestPasswordResetOTP(r.Context(), req.Email, req.Method)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			sendError(w, http.StatusNotFound, "Email tidak ditemukan")
			return
		}
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{
		"message": "OTP sent via " + req.Method,
		"info":    maskedInfo,
	})
}

// ResetPassword handles POST /api/v1/auth/reset-password
func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		OTP      string `json:"otp"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	err := h.authService.VerifyAndResetPassword(r.Context(), req.Email, req.OTP, req.Password)
	if err != nil {
		sendError(w, http.StatusBadRequest, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{
		"message": "Password has been reset successfully",
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
