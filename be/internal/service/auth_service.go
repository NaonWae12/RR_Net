package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/domain/tenant"
	"rrnet/internal/domain/user"
	"rrnet/internal/infra/mail"
	wagw "rrnet/internal/infra/wa_gateway"
	"rrnet/internal/rbac"
	"rrnet/internal/repository"
	"strings"

	"github.com/go-redis/redis/v8"
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
	userRepo     *repository.UserRepository
	tenantRepo   *repository.TenantRepository
	jwtManager   *auth.JWTManager
	oauthManager *auth.OAuthManager
	redis        *redis.Client
	waGateway    *wagw.Client
	mailProvider mail.MailProvider
}

// NewAuthService creates a new auth service
func NewAuthService(
	userRepo *repository.UserRepository,
	tenantRepo *repository.TenantRepository,
	jwtManager *auth.JWTManager,
	oauthManager *auth.OAuthManager,
	redis *redis.Client,
	waGateway *wagw.Client,
	mailProvider mail.MailProvider,
) *AuthService {
	return &AuthService{
		userRepo:     userRepo,
		tenantRepo:   tenantRepo,
		jwtManager:   jwtManager,
		oauthManager: oauthManager,
		redis:        redis,
		waGateway:    waGateway,
		mailProvider: mailProvider,
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
	ID           uuid.UUID  `json:"id"`
	Email        string     `json:"email"`
	Name         string     `json:"name"`
	Phone        *string    `json:"phone,omitempty"`
	AvatarURL    *string    `json:"avatar_url,omitempty"`
	Role         string     `json:"role"`
	Capabilities []string   `json:"capabilities"`
	TenantID     *uuid.UUID `json:"tenant_id,omitempty"`
	BaseSalary   float64    `json:"base_salary"`
}

// TenantDTO represents tenant data for API responses
type TenantDTO struct {
	ID                        uuid.UUID `json:"id"`
	Name                      string    `json:"name"`
	Slug                      string    `json:"slug"`
	Status                    string    `json:"status"`
	DefaultVoucherDesignSlug  []string  `json:"default_voucher_design_slug"`
	ResellerVoucherDesignSlug []string  `json:"reseller_voucher_design_slug"`
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
			ID:           u.ID,
			Email:        u.Email,
			Name:         u.Name,
			Phone:        u.Phone,
			AvatarURL:    u.AvatarURL,
			Role:         u.Role.Code,
			Capabilities: s.capabilitiesToStrings(rbac.GetCapabilitiesForRoleString(u.Role.Code)),
			TenantID:     u.TenantID,
			BaseSalary:   u.BaseSalary,
		},
	}

	if t != nil {
		var defaultSlugs []string
		if t.DefaultVoucherDesignSlug != "" {
			defaultSlugs = strings.Split(t.DefaultVoucherDesignSlug, ",")
		}
		
		var resellerSlugs []string
		if t.ResellerVoucherDesignSlug != "" {
			resellerSlugs = strings.Split(t.ResellerVoucherDesignSlug, ",")
		}
		
		response.Tenant = &TenantDTO{
			ID:                        t.ID,
			Name:                      t.Name,
			Slug:                      t.Slug,
			Status:                    string(t.Status),
			DefaultVoucherDesignSlug:  defaultSlugs,
			ResellerVoucherDesignSlug: resellerSlugs,
		}
	}

	return response, nil
}

// OAuthLogin handles login via OAuth
func (s *AuthService) OAuthLogin(ctx context.Context, oauthUser *auth.OAuthUser) (*LoginResponse, error) {
	// Try to find user by email
	u, err := s.userRepo.GetByEmailAnyTenant(ctx, oauthUser.Email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			// User not found, frontend should handle registration
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	// Check user status
	if !u.CanLogin() {
		return nil, ErrUserNotActive
	}

	// Check tenant status if user belongs to one
	var t *tenant.Tenant
	var tenantID uuid.UUID
	if u.TenantID != nil {
		tenantID = *u.TenantID
		t, err = s.tenantRepo.GetByID(ctx, tenantID)
		if err != nil {
			return nil, err
		}
		if !t.CanAccess() {
			return nil, ErrTenantNotActive
		}
	}

	// Generate tokens
	accessToken, err := s.jwtManager.GenerateAccessToken(u.ID, tenantID, u.Role.Code, u.Email)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.jwtManager.GenerateRefreshToken(u.ID, tenantID, u.Role.Code, u.Email)
	if err != nil {
		return nil, err
	}

	// Update last login
	_ = s.userRepo.UpdateLastLogin(ctx, u.ID)

	res := &LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.jwtManager.GetAccessTokenTTL().Seconds()),
		User: &UserDTO{
			ID:           u.ID,
			Email:        u.Email,
			Name:         u.Name,
			Phone:        u.Phone,
			AvatarURL:    u.AvatarURL,
			Role:         u.Role.Code,
			Capabilities: s.capabilitiesToStrings(rbac.GetCapabilitiesForRoleString(u.Role.Code)),
			TenantID:     u.TenantID,
			BaseSalary:   u.BaseSalary,
		},
	}

	if t != nil {
		var defaultSlugs []string
		if t.DefaultVoucherDesignSlug != "" {
			defaultSlugs = strings.Split(t.DefaultVoucherDesignSlug, ",")
		}
		
		var resellerSlugs []string
		if t.ResellerVoucherDesignSlug != "" {
			resellerSlugs = strings.Split(t.ResellerVoucherDesignSlug, ",")
		}

		res.Tenant = &TenantDTO{
			ID:                        t.ID,
			Name:                      t.Name,
			Slug:                      t.Slug,
			Status:                    string(t.Status),
			DefaultVoucherDesignSlug:  defaultSlugs,
			ResellerVoucherDesignSlug: resellerSlugs,
		}
	}

	return res, nil
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
			ID:           u.ID,
			Email:        u.Email,
			Name:         u.Name,
			Phone:        u.Phone,
			AvatarURL:    u.AvatarURL,
			Role:         u.Role.Code,
			Capabilities: s.capabilitiesToStrings(rbac.GetCapabilitiesForRoleString(u.Role.Code)),
			TenantID:     u.TenantID,
			BaseSalary:   u.BaseSalary,
		},
	}, nil
}

// RegisterRequest represents registration request
type RegisterRequest struct {
	Email      string  `json:"email"`
	Password   string  `json:"password"`
	Name       string  `json:"name"`
	Phone      string  `json:"phone,omitempty"`
	BaseSalary float64 `json:"base_salary,omitempty"`
}

// UpdateUserProfileRequest represents update user profile request
type UpdateUserProfileRequest struct {
	Name  string  `json:"name"`
	Email *string `json:"email,omitempty"`
	Phone *string `json:"phone,omitempty"`
	OTP   *string `json:"otp,omitempty"`
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
		BaseSalary:   req.BaseSalary,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if req.Phone != "" {
		u.Phone = &req.Phone
	}

	if err := s.userRepo.Create(ctx, u); err != nil {
		return nil, err
	}

	// Send Welcome Email (Non-blocking)
	go func() {
		_ = s.SendWelcomeEmail(context.Background(), u.Email, u.Name)
	}()

	return &UserDTO{
		ID:           u.ID,
		Email:        u.Email,
		Name:         u.Name,
		Phone:        u.Phone,
		Role:         roleCode,
		Capabilities: s.capabilitiesToStrings(rbac.GetCapabilitiesForRoleString(roleCode)),
		TenantID:     u.TenantID,
		BaseSalary:   u.BaseSalary,
	}, nil
}

// ProfileResponse represents user profile data
type ProfileResponse struct {
	User   *UserDTO   `json:"user"`
	Tenant *TenantDTO `json:"tenant,omitempty"`
}

// GetProfile retrieves user profile
func (s *AuthService) GetProfile(ctx context.Context, userID uuid.UUID) (*ProfileResponse, error) {
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	res := &ProfileResponse{
		User: &UserDTO{
			ID:           u.ID,
			Email:        u.Email,
			Name:         u.Name,
			Phone:        u.Phone,
			AvatarURL:    u.AvatarURL,
			Role:         u.Role.Code,
			Capabilities: s.capabilitiesToStrings(rbac.GetCapabilitiesForRoleString(u.Role.Code)),
			TenantID:     u.TenantID,
			BaseSalary:   u.BaseSalary,
		},
	}

	if u.TenantID != nil {
		t, err := s.tenantRepo.GetByID(ctx, *u.TenantID)
		if err == nil {
			var defaultSlugs []string
			if t.DefaultVoucherDesignSlug != "" {
				defaultSlugs = strings.Split(t.DefaultVoucherDesignSlug, ",")
			}
			
			var resellerSlugs []string
			if t.ResellerVoucherDesignSlug != "" {
				resellerSlugs = strings.Split(t.ResellerVoucherDesignSlug, ",")
			}

			res.Tenant = &TenantDTO{
				ID:                        t.ID,
				Name:                      t.Name,
				Slug:                      t.Slug,
				Status:                    string(t.Status),
				DefaultVoucherDesignSlug:  defaultSlugs,
				ResellerVoucherDesignSlug: resellerSlugs,
			}
		}
	}
	return res, nil
}

// UpdateProfile updates user profile information
func (s *AuthService) UpdateProfile(ctx context.Context, userID uuid.UUID, req *UpdateUserProfileRequest) (*UserDTO, error) {
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Update name if provided (always allowed)
	if req.Name != "" {
		u.Name = req.Name
	}

	// Handle Sensitive Changes (Email/Phone)
	isSensitiveChange := (req.Email != nil && *req.Email != "" && *req.Email != u.Email) ||
		(req.Phone != nil && *req.Phone != "" && (u.Phone == nil || *req.Phone != *u.Phone))

	if isSensitiveChange {
		if req.OTP == nil || *req.OTP == "" {
			return nil, errors.New("OTP_REQUIRED")
		}

		// Verify OTP
		var targetValue string
		if req.Email != nil && *req.Email != u.Email {
			targetValue = *req.Email
		} else {
			targetValue = *req.Phone
		}

		otpKey := fmt.Sprintf("otp:profile:%s:%s", userID, targetValue)
		val, err := s.redis.Get(ctx, otpKey).Result()
		if err != nil {
			return nil, errors.New("kode OTP kadaluarsa atau tidak ditemukan")
		}
		if val != *req.OTP {
			return nil, errors.New("kode OTP tidak valid")
		}

		// Update fields after verification
		if req.Email != nil && *req.Email != u.Email {
			// Double check uniqueness again before final save
			exists, _ := s.userRepo.EmailExists(ctx, u.TenantID, *req.Email, &userID)
			if exists {
				return nil, repository.ErrEmailTaken
			}
			u.Email = *req.Email
		}
		if req.Phone != nil && (u.Phone == nil || *req.Phone != *u.Phone) {
			exists, _ := s.userRepo.CheckPhoneExists(ctx, *req.Phone)
			if exists {
				existingUser, _ := s.userRepo.GetByPhone(ctx, *req.Phone)
				if existingUser != nil && existingUser.ID != userID {
					return nil, errors.New("nomor WhatsApp sudah digunakan oleh akun lain")
				}
			}
			u.Phone = req.Phone
		}

		// Cleanup OTP
		s.redis.Del(ctx, otpKey)
	}

	if err := s.userRepo.Update(ctx, u); err != nil {
		return nil, err
	}

	return &UserDTO{
		ID:           u.ID,
		Email:        u.Email,
		Name:         u.Name,
		Phone:        u.Phone,
		AvatarURL:    u.AvatarURL,
		Role:         u.Role.Code,
		Capabilities: s.capabilitiesToStrings(rbac.GetCapabilitiesForRoleString(u.Role.Code)),
		TenantID:     u.TenantID,
		BaseSalary:   u.BaseSalary,
	}, nil
}

func (s *AuthService) RequestProfileUpdateOTP(ctx context.Context, userID uuid.UUID, method, value string) error {
	// 1. Generate OTP
	otpCode := fmt.Sprintf("%06d", rand.Intn(1000000))

	// 2. Send OTP
	if method == "email" {
		if err := s.SendOTPEmail(ctx, value, otpCode); err != nil {
			return err
		}
	} else if method == "whatsapp" {
		if s.waGateway == nil {
			return errors.New("WhatsApp gateway not configured")
		}
		message := fmt.Sprintf("Kode OTP Verifikasi Perubahan Akun RRNET Anda adalah: %s. Berlaku 10 menit.", otpCode)
		if _, err := s.waGateway.Send(ctx, "platform", value, message); err != nil {
			return err
		}
	}

	// 3. Store in Redis
	otpKey := fmt.Sprintf("otp:profile:%s:%s", userID, value)
	return s.redis.Set(ctx, otpKey, otpCode, 10*time.Minute).Err()
}

// SendOTPEmail sends an OTP to user's email
func (s *AuthService) SendOTPEmail(ctx context.Context, email, otp string) error {
	subject := "Kode OTP Verifikasi - RRNet ERP"
	body := fmt.Sprintf(`
		<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
			<h2 style="color: #4f46e5; text-align: center;">Kode Verifikasi Anda</h2>
			<p>Halo,</p>
			<p>Gunakan kode OTP berikut untuk melanjutkan proses verifikasi akun Anda di RRNet ERP:</p>
			<div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e293b; border-radius: 8px; margin: 20px 0;">
				%s
			</div>
			<p style="color: #64748b; font-size: 14px;">Kode ini hanya berlaku selama 5 menit. Jangan bagikan kode ini kepada siapapun.</p>
			<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
			<p style="color: #94a3b8; font-size: 12px; text-align: center;">
				Email ini dikirim secara otomatis oleh sistem RRNet ERP.
			</p>
		</div>
	`, otp)

	return s.mailProvider.Send(ctx, []string{email}, subject, body)
}

// SendWelcomeEmail sends a welcome email to a newly registered user
func (s *AuthService) SendWelcomeEmail(ctx context.Context, email, name string) error {
	subject := "Selamat Datang di RRNet ERP!"
	body := fmt.Sprintf(`
		<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
			<div style="text-align: center; margin-bottom: 20px;">
				<h1 style="color: #4f46e5; margin: 0;">RRNet ERP</h1>
			</div>
			<h2 style="color: #1e293b;">Selamat Datang, %s!</h2>
			<p>Akun Anda telah berhasil didaftarkan di sistem RRNet ERP.</p>
			<p>Sekarang Anda dapat masuk ke dashboard menggunakan email Anda dan password yang telah ditentukan oleh Admin.</p>
			<div style="margin: 30px 0; text-align: center;">
				<a href="https://erp.rrnet.id/login" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Login ke Dashboard</a>
			</div>
			<p style="color: #64748b; font-size: 14px;">Jika Anda memiliki kendala, silakan hubungi tim IT Support RRNet.</p>
			<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
			<p style="color: #94a3b8; font-size: 12px; text-align: center;">
				© 2026 RRNet Cloud ERP. All rights reserved.
			</p>
		</div>
	`, name)

	return s.mailProvider.Send(ctx, []string{email}, subject, body)
}

func (s *AuthService) capabilitiesToStrings(caps []rbac.Capability) []string {
	res := make([]string, len(caps))
	for i, c := range caps {
		res[i] = string(c)
	}
	return res
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

// RequestPasswordResetOTP initiates the password reset process by sending an OTP via Email or WhatsApp
func (s *AuthService) RequestPasswordResetOTP(ctx context.Context, email, method string) (string, error) {
	// 1. Find user by email
	u, err := s.userRepo.GetByEmailAnyTenant(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return "", ErrUserNotFound
		}
		return "", err
	}

	// 2. Generate 6-digit OTP
	otpCode := fmt.Sprintf("%06d", rand.Intn(1000000))

	var info string

	// 3. Send OTP based on method
	switch method {
	case "whatsapp":
		if u.Phone == nil || *u.Phone == "" {
			return "", errors.New("akun tidak memiliki nomor WhatsApp terdaftar")
		}
		if s.waGateway == nil {
			return "", errors.New("layanan WhatsApp sedang tidak tersedia")
		}

		message := fmt.Sprintf("Halo %s, berikut adalah Kode OTP Anda untuk Mereset Password di RRNET: %s. Kode ini berlaku selama 10 menit. Jangan berikan kode ini kepada siapapun.", u.Name, otpCode)
		_, err := s.waGateway.Send(ctx, "platform", *u.Phone, message)
		if err != nil {
			return "", fmt.Errorf("gagal mengirim WhatsApp OTP: %w", err)
		}

		phone := *u.Phone
		info = phone
		if len(phone) > 7 {
			info = phone[:4] + "******" + phone[len(phone)-2:]
		}

	case "email":
		fallthrough
	default:
		if err := s.SendOTPEmail(ctx, u.Email, otpCode); err != nil {
			return "", fmt.Errorf("gagal mengirim Email OTP: %w", err)
		}
		info = u.Email
		// Mask email for security feedback
		parts := strings.Split(u.Email, "@")
		if len(parts) == 2 {
			name := parts[0]
			if len(name) > 3 {
				info = name[:2] + "****" + name[len(name)-1:] + "@" + parts[1]
			}
		}
	}

	// 5. Store OTP in Redis
	otpKey := "otp:reset:" + email
	if err := s.redis.Set(ctx, otpKey, otpCode, 10*time.Minute).Err(); err != nil {
		return "", err
	}

	return info, nil
}

// VerifyAndResetPassword verifies the OTP and updates the user's password
func (s *AuthService) VerifyAndResetPassword(ctx context.Context, email, otp, newPassword string) error {
	// 1. Verify OTP from Redis
	otpKey := "otp:reset:" + email
	val, err := s.redis.Get(ctx, otpKey).Result()
	if err != nil {
		return errors.New("kode OTP sudah kadaluarsa atau tidak ditemukan")
	}

	if val != otp {
		return errors.New("kode OTP tidak valid")
	}

	// 2. Find user
	u, err := s.userRepo.GetByEmailAnyTenant(ctx, email)
	if err != nil {
		return err
	}

	// 3. Hash and update password
	if err := auth.ValidatePassword(newPassword); err != nil {
		return err
	}

	passwordHash, err := auth.HashPassword(newPassword)
	if err != nil {
		return err
	}

	if err := s.userRepo.UpdatePassword(ctx, u.ID, passwordHash); err != nil {
		return err
	}

	// 4. Clear OTP
	_ = s.redis.Del(ctx, otpKey)

	return nil
}

