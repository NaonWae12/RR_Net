package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/domain/billing"
	"rrnet/internal/domain/tenant"
	"rrnet/internal/domain/user"
	"rrnet/internal/domain/affiliate"
	"rrnet/internal/infra/wa_gateway"
	"rrnet/internal/repository"
)

var (
	ErrSlugTaken          = errors.New("slug already taken")
	ErrInvalidOTP         = errors.New("kode OTP tidak valid atau sudah kadaluarsa")
	ErrTenantNotFound     = errors.New("tenant not found")
	ErrInvalidPhoneNumber = errors.New("nomor WhatsApp tidak valid atau tidak terdaftar")
)

// TenantService handles tenant business logic
type TenantService struct {
	tenantRepo             *repository.TenantRepository
	userRepo               *repository.UserRepository
	planRepo               *repository.PlanRepository
	jwtManager             *auth.JWTManager
	redis                  *redis.Client
	waClient               *wa_gateway.Client
	platformBillingService *PlatformBillingService
	affiliateService       *AffiliateService
}

// NewTenantService creates a new tenant service
func NewTenantService(
	tenantRepo *repository.TenantRepository,
	userRepo *repository.UserRepository,
	planRepo *repository.PlanRepository,
	jwtManager *auth.JWTManager,
	redisClient *redis.Client,
	waClient *wa_gateway.Client,
	platformBillingService *PlatformBillingService,
	affiliateService *AffiliateService,
) *TenantService {
	return &TenantService{
		tenantRepo:             tenantRepo,
		userRepo:               userRepo,
		planRepo:               planRepo,
		jwtManager:             jwtManager,
		redis:                  redisClient,
		waClient:               waClient,
		platformBillingService: platformBillingService,
		affiliateService:       affiliateService,
	}
}

// GetPendingRegistrationInvoice retrieves the initial pending invoice for a tenant
func (s *TenantService) GetPendingRegistrationInvoice(ctx context.Context, tenantID uuid.UUID) (interface{}, error) {
	invoices, err := s.platformBillingService.GetTenantInvoices(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	for _, inv := range invoices {
		if inv.Status == "pending" {
			return inv, nil
		}
	}

	return nil, errors.New("no pending invoice found")
}

// UpdateRegistrationPlan updates the tenant's plan and the corresponding pending invoice
func (s *TenantService) UpdateRegistrationPlan(ctx context.Context, tenantID uuid.UUID, planCode string, billingCycle string) (*billing.PlatformInvoice, error) {
	// 1. Get plan
	plan, err := s.planRepo.GetByCode(ctx, planCode)
	if err != nil {
		return nil, err
	}

	// 2. Update tenant
	t, err := s.tenantRepo.GetByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	t.PlanID = &plan.ID
	if err := s.tenantRepo.Update(ctx, t); err != nil {
		return nil, err
	}

	// 3. Find existing pending invoice
	invoices, err := s.platformBillingService.GetTenantInvoices(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	var pendingInv *billing.PlatformInvoice
	for _, inv := range invoices {
		if inv.Status == billing.PlatformInvoiceStatusPending {
			pendingInv = inv
			break
		}
	}

	if pendingInv == nil {
		return nil, errors.New("no pending invoice found to update")
	}

	// 4. Update the invoice
	if err := s.platformBillingService.UpdateInvoicePlan(ctx, pendingInv.ID, plan.ID, billingCycle); err != nil {
		return nil, err
	}

	// 5. Return the updated invoice
	return s.platformBillingService.GetInvoice(ctx, pendingInv.ID)
}

// RegisterTenantRequest represents tenant registration request
type RegisterTenantRequest struct {
	// Plan
	PlanCode string `json:"plan_code"`

	// User (Owner)
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Password string `json:"password"`

	// Organization
	CompanyName string `json:"company_name"`
	Slug        string `json:"slug"`

	BillingCycle string `json:"billing_cycle"`
	IsOAuth      bool   `json:"is_oauth"`
	ReferralCode string `json:"referral_code"` // The code from the affiliate
}

// RegisterTenantResponse represents tenant registration response
type RegisterTenantResponse struct {
	AccessToken  string                   `json:"access_token"`
	RefreshToken string                   `json:"refresh_token"`
	ExpiresIn    int64                    `json:"expires_in"`
	User         *UserDTO                 `json:"user"`
	Tenant       *TenantDTO               `json:"tenant"`
	Invoice      *billing.PlatformInvoice `json:"invoice,omitempty"`
}

// RegisterTenant creates a new tenant with owner user
func (s *TenantService) RegisterTenant(ctx context.Context, req *RegisterTenantRequest) (*RegisterTenantResponse, error) {
	log.Info().Str("email", req.Email).Str("slug", req.Slug).Msg("Processing tenant registration")

	// 1. Validate password
	if err := auth.ValidatePassword(req.Password); err != nil {
		log.Warn().Err(err).Msg("Password validation failed")
		return nil, err
	}

	// 2. Check slug uniqueness
	slugExists, err := s.tenantRepo.SlugExists(ctx, req.Slug, nil)
	if err != nil {
		return nil, err
	}
	if slugExists {
		log.Warn().Str("slug", req.Slug).Msg("Slug already taken")
		return nil, ErrSlugTaken
	}

	// 3. Check email uniqueness (global check for super admin + all tenants)
	emailExists, err := s.userRepo.EmailExists(ctx, nil, req.Email, nil)
	if err != nil {
		return nil, err
	}
	if emailExists {
		log.Warn().Str("email", req.Email).Msg("Email already taken")
		return nil, repository.ErrEmailTaken
	}

	// 4. Get plan by code
	plan, err := s.planRepo.GetByCode(ctx, req.PlanCode)
	if err != nil {
		log.Warn().Str("plan_code", req.PlanCode).Msg("Invalid plan code")
		return nil, errors.New("invalid plan code")
	}

	log.Info().Str("plan", plan.Name).Msg("Plan validated")

	// 5. Validate WhatsApp number by sending OTP BEFORE creating tenant/user (Skip for OAuth)
	var otpCode string
	if !req.IsOAuth {
		// Generate OTP
		rand.Seed(time.Now().UnixNano())
		otpCode = fmt.Sprintf("%06d", rand.Intn(1000000))

		// Try to send OTP via WhatsApp - this validates the phone number
		if s.waClient != nil && req.Phone != "" {
			message := fmt.Sprintf("Halo %s, berikut adalah Kode OTP Anda untuk proses registrasi di RRNET: %s. Kode ini bersifat rahasia dan berlaku selama 10 menit. Mohon tidak memberikan kode ini kepada siapapun.", req.Name, otpCode)
			_, err := s.waClient.Send(ctx, "platform", req.Phone, message)
			if err != nil {
				log.Error().Err(err).Str("phone", req.Phone).Msg("Failed to send registration OTP via WhatsApp - invalid phone number")
				return nil, ErrInvalidPhoneNumber
			}
			log.Info().Str("phone", req.Phone).Msg("Registration OTP sent via WhatsApp successfully")
		} else {
			log.Warn().Msg("WhatsApp client not available or phone empty")
			return nil, errors.New("WhatsApp service is currently unavailable")
		}

		// Store OTP in Redis (expires in 10 minutes)
		otpKey := "otp:reg:" + req.Email
		if err := s.redis.Set(ctx, otpKey, otpCode, 10*time.Minute).Err(); err != nil {
			log.Error().Err(err).Str("email", req.Email).Msg("Failed to store OTP in Redis")
			return nil, errors.New("failed to generate OTP")
		}

		// Log OTP for development
		log.Info().
			Str("email", req.Email).
			Str("otp", otpCode).
			Msg(">>> REGISTRATION OTP GENERATED <<<")
		fmt.Printf("REGISTRATION OTP FOR %s (%s): %s\n", req.Email, req.Phone, otpCode)
		fmt.Printf("========================================\n\n")
	} else {
		log.Info().Str("email", req.Email).Msg("Register via OAuth, skipping OTP")
	}

	// 5b. Handle Referral if provided
	var affiliateProfile *affiliate.Affiliate
	if req.ReferralCode != "" {
		aff, err := s.affiliateService.GetByCode(ctx, req.ReferralCode)
		if err == nil && aff != nil {
			affiliateProfile = aff
			log.Info().Str("code", req.ReferralCode).Str("affiliate_id", aff.ID.String()).Msg("Valid referral code found")
		} else {
			if err != nil {
				log.Warn().Err(err).Str("code", req.ReferralCode).Msg("Invalid referral code provided")
			} else {
				log.Warn().Str("code", req.ReferralCode).Msg("Invalid referral code provided")
			}
		}
	}

	// 6. NOW create tenant (only after WhatsApp validation succeeds)
	now := time.Now()
	tenantID := uuid.New()

	// Set trial period (30 days from now)
	trialEndsAt := now.AddDate(0, 0, 30)

	newTenant := &tenant.Tenant{
		ID:            tenantID,
		Name:          req.CompanyName,
		CompanyName:   &req.CompanyName,
		Slug:          req.Slug,
		Status:        tenant.StatusPending, // Start as pending for approval
		PlanID:        &plan.ID,
		BillingStatus: tenant.BillingStatusActive,
		TrialEndsAt:   &trialEndsAt,
		Settings:      make(map[string]interface{}),
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := s.tenantRepo.Create(ctx, newTenant); err != nil {
		log.Error().Err(err).Msg("Failed to create tenant")
		return nil, err
	}

	log.Info().Str("tenant_id", tenantID.String()).Msg("Tenant created")

	// Record the referral if present
	if affiliateProfile != nil {
		commissionRate := s.affiliateService.GetCommissionRate(ctx, affiliateProfile.Tier)

		ref := &affiliate.Referral{
			ID:                   uuid.New(),
			AffiliateID:          affiliateProfile.ID,
			ReferredTenantID:     tenantID,
			CommissionPercentage: commissionRate,
			Status:               "active",
			CreatedAt:            now,
		}
		if err := s.affiliateService.ProcessReferral(ctx, ref); err != nil {
			log.Error().Err(err).Msg("Failed to record affiliate referral")
		}
	}

	// 6. Get owner role
	ownerRole, err := s.userRepo.GetRoleByCode(ctx, "owner")
	if err != nil {
		return nil, err
	}

	// 7. Hash password
	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	// 8. Create owner user
	userID := uuid.New()
	var emailVerifiedAt *time.Time
	if req.IsOAuth {
		emailVerifiedAt = &now
	}

	newUser := &user.User{
		ID:              userID,
		TenantID:        &tenantID,
		RoleID:          ownerRole.ID,
		Email:           req.Email,
		Phone:           &req.Phone,
		PasswordHash:    passwordHash,
		Name:            req.Name,
		Status:          user.StatusActive,
		EmailVerifiedAt: emailVerifiedAt,
		Metadata:        make(map[string]interface{}),
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := s.userRepo.Create(ctx, newUser); err != nil {
		log.Error().Err(err).Msg("Failed to create owner user")
		return nil, err
	}

	log.Info().Str("user_id", userID.String()).Msg("Owner user created")

	// OTP already generated and sent before tenant creation (for phone validation)
	// No need to generate/send again

	// 9. Generate tokens (Access still granted but restricted by status)
	accessToken, err := s.jwtManager.GenerateAccessToken(userID, tenantID, "owner", req.Email)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.jwtManager.GenerateRefreshToken(userID, tenantID, "owner", req.Email)
	if err != nil {
		return nil, err
	}

	// 10. Generate initial invoice
	invoice, err := s.platformBillingService.CreateInitialInvoice(ctx, tenantID, plan.ID, req.BillingCycle)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID.String()).Msg("Failed to create initial registration invoice")
		// Don't fail registration if invoice creation fails, but it's an issue
	}

	// 11. Build response
	return &RegisterTenantResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.jwtManager.GetAccessTokenTTL().Seconds()),
		User: &UserDTO{
			ID:       userID,
			Email:    req.Email,
			Name:     req.Name,
			Role:     "owner",
			TenantID: &tenantID,
		},
		Tenant: &TenantDTO{
			ID:     tenantID,
			Name:   req.CompanyName,
			Slug:   req.Slug,
			Status: string(tenant.StatusPending),
		},
		Invoice: invoice,
	}, nil
}

type VerifyOTPRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

func (s *TenantService) VerifyOTP(ctx context.Context, req *VerifyOTPRequest) error {
	otpKey := "otp:reg:" + req.Email
	val, err := s.redis.Get(ctx, otpKey).Result()
	if err != nil {
		return ErrInvalidOTP
	}

	if val != req.Code {
		return ErrInvalidOTP
	}

	// OTP valid, delete it
	s.redis.Del(ctx, otpKey)

	// Update user email_verified_at
	now := time.Now()
	// Get user by email (any tenant since it's global registration)
	u, err := s.userRepo.GetByEmailAnyTenant(ctx, req.Email)
	if err != nil {
		return err
	}

	u.EmailVerifiedAt = &now
	if err := s.userRepo.Update(ctx, u); err != nil {
		return err
	}

	return nil
}

type ResendOTPRequest struct {
	Email string `json:"email"`
}

func (s *TenantService) ResendOTP(ctx context.Context, req *ResendOTPRequest) error {
	// Check if user exists
	u, err := s.userRepo.GetByEmailAnyTenant(ctx, req.Email)
	if err != nil {
		return errors.New("email tidak terdaftar")
	}

	// Generate new OTP
	rand.Seed(time.Now().UnixNano())
	otpCode := fmt.Sprintf("%06d", rand.Intn(1000000))
	otpKey := "otp:reg:" + req.Email
	if err := s.redis.Set(ctx, otpKey, otpCode, 10*time.Minute).Err(); err != nil {
		log.Error().Err(err).Str("email", req.Email).Msg("Failed to resend OTP to Redis")
		return err
	}

	log.Info().
		Str("email", req.Email).
		Str("otp", otpCode).
		Msg(">>> REGISTRATION OTP RESENT <<<")

	// Send via WhatsApp if available
	if s.waClient != nil && u.Phone != nil && *u.Phone != "" {
		message := fmt.Sprintf("Halo %s, Kode OTP baru Anda untuk registrasi di RRNET adalah: %s. Kode ini berlaku selama 10 menit. Mohon tidak memberikan kode ini kepada siapapun.", u.Name, otpCode)
		_, err := s.waClient.Send(ctx, "platform", *u.Phone, message)
		if err != nil {
			log.Error().Err(err).Str("phone", *u.Phone).Msg("Failed to resend OTP via WhatsApp")
		}
	}

	return nil
}

// ApproveTenant approves a pending tenant (superadmin only)
func (s *TenantService) ApproveTenant(ctx context.Context, tenantID uuid.UUID) error {
	log.Info().Str("tenant_id", tenantID.String()).Msg("Approving tenant")

	t, err := s.tenantRepo.GetByID(ctx, tenantID)
	if err != nil {
		return ErrTenantNotFound
	}

	// Update status to active
	t.Status = tenant.StatusActive
	if err := s.tenantRepo.Update(ctx, t); err != nil {
		log.Error().Err(err).Msg("Failed to approve tenant")
		return err
	}

	log.Info().Str("tenant_id", tenantID.String()).Str("name", t.Name).Msg("Tenant approved successfully")
	return nil
}

// RejectTenant rejects/suspends a tenant (superadmin only)
func (s *TenantService) RejectTenant(ctx context.Context, tenantID uuid.UUID, reason string) error {
	log.Info().Str("tenant_id", tenantID.String()).Str("reason", reason).Msg("Rejecting tenant")

	t, err := s.tenantRepo.GetByID(ctx, tenantID)
	if err != nil {
		return ErrTenantNotFound
	}

	// Update status to suspended
	t.Status = tenant.StatusSuspended
	if err := s.tenantRepo.Update(ctx, t); err != nil {
		log.Error().Err(err).Msg("Failed to reject tenant")
		return err
	}

	log.Info().Str("tenant_id", tenantID.String()).Str("name", t.Name).Msg("Tenant rejected/suspended")
	return nil
}

// DeleteTenant deletes a tenant and all its users (superadmin only)
func (s *TenantService) DeleteTenant(ctx context.Context, tenantID uuid.UUID) error {
	log.Info().Str("tenant_id", tenantID.String()).Msg("Deleting tenant and its users")

	// 1. Delete all users belonging to this tenant
	if err := s.userRepo.DeleteByTenant(ctx, tenantID); err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID.String()).Msg("Failed to delete tenant users")
		return err
	}

	// 2. Delete the tenant itself (this also mangles the slug)
	if err := s.tenantRepo.Delete(ctx, tenantID); err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID.String()).Msg("Failed to delete tenant")
		return err
	}

	log.Info().Str("tenant_id", tenantID.String()).Msg("Tenant and its users deleted successfully")
	return nil
}
