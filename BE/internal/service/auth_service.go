package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/domain/tenant"
	"rrnet/internal/domain/user"
	"rrnet/internal/repository"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrUserNotFound       = errors.New("email tidak terdaftar")
	ErrWrongPassword      = errors.New("password salah")
	ErrUserNotActive      = errors.New("user account is not active")
	ErrTenantNotActive    = errors.New("tenant is not active")
)

// AuthService handles authentication operations
type AuthService struct {
	userRepo   *repository.UserRepository
	tenantRepo *repository.TenantRepository
	jwtManager *auth.JWTManager
}

// NewAuthService creates a new auth service
func NewAuthService(userRepo *repository.UserRepository, tenantRepo *repository.TenantRepository, jwtManager *auth.JWTManager) *AuthService {
	return &AuthService{
		userRepo:   userRepo,
		tenantRepo: tenantRepo,
		jwtManager: jwtManager,
	}
}

// LoginRequest represents login request data
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse represents login response data
type LoginResponse struct {
	AccessToken  string     `json:"access_token"`
	RefreshToken string     `json:"refresh_token"`
	ExpiresIn    int64      `json:"expires_in"` // seconds
	User         *UserDTO   `json:"user"`
	Tenant       *TenantDTO `json:"tenant,omitempty"`
}

// UserDTO represents user data for API responses
type UserDTO struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	Name      string     `json:"name"`
	Phone     *string    `json:"phone,omitempty"`
	AvatarURL *string    `json:"avatar_url,omitempty"`
	Role      string     `json:"role"`
	TenantID  *uuid.UUID `json:"tenant_id,omitempty"`
}

// TenantDTO represents tenant data for API responses
type TenantDTO struct {
	ID     uuid.UUID `json:"id"`
	Name   string    `json:"name"`
	Slug   string    `json:"slug"`
	Status string    `json:"status"`
}

// Login authenticates a user and returns tokens
func (s *AuthService) Login(ctx context.Context, tenantID *uuid.UUID, req *LoginRequest) (*LoginResponse, error) {
	// Get user by email
	var u *user.User
	var err error

	if tenantID != nil {
		// Tenant-scoped login: find user within specific tenant
		u, err = s.userRepo.GetByEmail(ctx, tenantID, req.Email)
	} else {
		// No tenant context: try to find user from any tenant or super admin
		// First try super admin (tenant_id IS NULL) - prioritize super admin
		u, err = s.userRepo.GetByEmail(ctx, nil, req.Email)
		if err != nil && errors.Is(err, repository.ErrUserNotFound) {
			// If not super admin, try to find from any tenant (tenant users)
			u, err = s.userRepo.GetByEmailAnyTenant(ctx, req.Email)
		}
	}

	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	// Verify password
	if err := auth.VerifyPassword(req.Password, u.PasswordHash); err != nil {
		return nil, ErrWrongPassword
	}

	// Check user status
	if !u.CanLogin() {
		return nil, ErrUserNotActive
	}

	// Check tenant status if tenant-scoped
	var t *tenant.Tenant
	if u.TenantID != nil {
		t, err = s.tenantRepo.GetByID(ctx, *u.TenantID)
		if err != nil {
			return nil, err
		}
		if !t.CanAccess() {
			return nil, ErrTenantNotActive
		}
	}

	// Get tenant ID for token
	tokenTenantID := uuid.Nil
	if u.TenantID != nil {
		tokenTenantID = *u.TenantID
	}

	// Generate tokens
	accessToken, err := s.jwtManager.GenerateAccessToken(u.ID, tokenTenantID, u.Role.Code, u.Email)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.jwtManager.GenerateRefreshToken(u.ID, tokenTenantID, u.Role.Code, u.Email)
	if err != nil {
		return nil, err
	}

	// Update last login
	_ = s.userRepo.UpdateLastLogin(ctx, u.ID)

	// Build response
	response := &LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.jwtManager.GetAccessTokenTTL().Seconds()),
		User: &UserDTO{
			ID:        u.ID,
			Email:     u.Email,
			Name:      u.Name,
			Phone:     u.Phone,
			AvatarURL: u.AvatarURL,
			Role:      u.Role.Code,
			TenantID:  u.TenantID,
		},
	}

	if t != nil {
		response.Tenant = &TenantDTO{
			ID:     t.ID,
			Name:   t.Name,
			Slug:   t.Slug,
			Status: string(t.Status),
		}
	}

	return response, nil
}

// RefreshTokenRequest represents refresh token request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// RefreshToken generates new access token from refresh token
func (s *AuthService) RefreshToken(ctx context.Context, req *RefreshTokenRequest) (*LoginResponse, error) {
	// Validate refresh token
	claims, err := s.jwtManager.ValidateRefreshToken(req.RefreshToken)
	if err != nil {
		return nil, err
	}

	// Get user to verify still active
	u, err := s.userRepo.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, err
	}

	if !u.CanLogin() {
		return nil, ErrUserNotActive
	}

	// Generate new tokens
	accessToken, err := s.jwtManager.GenerateAccessToken(u.ID, claims.TenantID, u.Role.Code, u.Email)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.jwtManager.GenerateRefreshToken(u.ID, claims.TenantID, u.Role.Code, u.Email)
	if err != nil {
		return nil, err
	}

	return &LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.jwtManager.GetAccessTokenTTL().Seconds()),
		User: &UserDTO{
			ID:        u.ID,
			Email:     u.Email,
			Name:      u.Name,
			Phone:     u.Phone,
			AvatarURL: u.AvatarURL,
			Role:      u.Role.Code,
			TenantID:  u.TenantID,
		},
	}, nil
}

// RegisterRequest represents registration request
type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
	Phone    string `json:"phone,omitempty"`
}

// Register creates a new user in a tenant
func (s *AuthService) Register(ctx context.Context, tenantID uuid.UUID, roleCode string, req *RegisterRequest) (*UserDTO, error) {
	// Validate password
	if err := auth.ValidatePassword(req.Password); err != nil {
		return nil, err
	}

	// Check email uniqueness
	exists, err := s.userRepo.EmailExists(ctx, &tenantID, req.Email, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, repository.ErrEmailTaken
	}

	// Get role
	role, err := s.userRepo.GetRoleByCode(ctx, roleCode)
	if err != nil {
		return nil, err
	}

	// Hash password
	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	// Create user
	now := time.Now()
	u := &user.User{
		ID:           uuid.New(),
		TenantID:     &tenantID,
		RoleID:       role.ID,
		Email:        req.Email,
		PasswordHash: passwordHash,
		Name:         req.Name,
		Status:       user.StatusActive,
		Metadata:     make(map[string]interface{}),
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if req.Phone != "" {
		u.Phone = &req.Phone
	}

	if err := s.userRepo.Create(ctx, u); err != nil {
		return nil, err
	}

	return &UserDTO{
		ID:       u.ID,
		Email:    u.Email,
		Name:     u.Name,
		Phone:    u.Phone,
		Role:     roleCode,
		TenantID: u.TenantID,
	}, nil
}

// GetProfile retrieves user profile
func (s *AuthService) GetProfile(ctx context.Context, userID uuid.UUID) (*UserDTO, error) {
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &UserDTO{
		ID:        u.ID,
		Email:     u.Email,
		Name:      u.Name,
		Phone:     u.Phone,
		AvatarURL: u.AvatarURL,
		Role:      u.Role.Code,
		TenantID:  u.TenantID,
	}, nil
}

// ChangePasswordRequest represents change password request
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// ChangePassword changes user password
func (s *AuthService) ChangePassword(ctx context.Context, userID uuid.UUID, req *ChangePasswordRequest) error {
	// Get user
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// Verify current password
	if err := auth.VerifyPassword(req.CurrentPassword, u.PasswordHash); err != nil {
		return ErrInvalidCredentials
	}

	// Validate new password
	if err := auth.ValidatePassword(req.NewPassword); err != nil {
		return err
	}

	// Hash new password
	passwordHash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		return err
	}

	// Update password
	return s.userRepo.UpdatePassword(ctx, userID, passwordHash)
}





















