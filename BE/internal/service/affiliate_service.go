package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/domain/affiliate"
	"rrnet/internal/domain/site_setting"
	"rrnet/internal/domain/user"
	"rrnet/internal/rbac"
	"rrnet/internal/repository"
)

type AffiliateService struct {
	userRepo         *repository.UserRepository
	affiliateRepo    *repository.AffiliateRepository
	siteSettingsRepo repository.SiteSettingRepository
}

func NewAffiliateService(userRepo *repository.UserRepository, affiliateRepo *repository.AffiliateRepository, siteSettingsRepo repository.SiteSettingRepository) *AffiliateService {
	return &AffiliateService{
		userRepo:         userRepo,
		affiliateRepo:    affiliateRepo,
		siteSettingsRepo: siteSettingsRepo,
	}
}

type AffiliateTierSettings struct {
	Silver             int     `json:"silver"`
	Gold               int     `json:"gold"`
	Platinum           int     `json:"platinum"`
	CommissionSilver   float64 `json:"commission_silver"`
	CommissionGold     float64 `json:"commission_gold"`
	CommissionPlatinum float64 `json:"commission_platinum"`
	RetentionMonths    int     `json:"retention_months"`
}

// RegisterAffiliateRequest represents the data for new partner registration
type RegisterAffiliateRequest struct {
	Name     string `json:"name" validate:"required"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
	Phone    string `json:"phone" validate:"required"`
}

// Register creates a new user with the affiliate role and an affiliate profile
func (s *AffiliateService) Register(ctx context.Context, req *RegisterAffiliateRequest) (*affiliate.Affiliate, error) {
	// 1. Check if email/phone exists
	emailExists, _ := s.userRepo.CheckEmailExists(ctx, req.Email)
	if emailExists {
		return nil, fmt.Errorf("email sudah terdaftar")
	}

	phoneExists, _ := s.userRepo.CheckPhoneExists(ctx, req.Phone)
	if phoneExists {
		return nil, fmt.Errorf("nomor telepon sudah terdaftar")
	}

	// 2. Clear role for affiliate (no tenant_id needed initially)
	role, err := s.userRepo.GetRoleByCode(ctx, string(rbac.RoleAffiliate))
	if err != nil {
		return nil, fmt.Errorf("role affiliate tidak ditemukan: %w", err)
	}

	// 3. Hash password
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	// 4. Create User
	userID := uuid.New()
	u := &user.User{
		ID:           userID,
		RoleID:       role.ID,
		Email:        req.Email,
		PasswordHash: hash,
		Name:         req.Name,
		Phone:        &req.Phone,
		Status:       "active",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.userRepo.Create(ctx, u); err != nil {
		return nil, fmt.Errorf("gagal membuat user: %w", err)
	}

	// 5. Get current active campaign for new partner
	campaign, err := s.affiliateRepo.GetCurrentCampaign(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed fetching current campaign for new affiliate")
	}

	// 6. Create Affiliate Profile
	aff := &affiliate.Affiliate{
		ID:            uuid.New(),
		UserID:        userID,
		Code:          s.generateReferralCode(),
		Tier:          affiliate.TierSilver,
		Status:        affiliate.StatusActive, // Start as active
		JoinedCampaignID: nil,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if campaign != nil && !campaign.IsDefault {
		aff.JoinedCampaignID = &campaign.ID
	}

	if err := s.affiliateRepo.Create(ctx, aff); err != nil {
		return nil, fmt.Errorf("gagal membuat profil affiliate: %w", err)
	}

	// 7. Increment campaign count if using a promo
	if campaign != nil && !campaign.IsDefault {
		_ = s.affiliateRepo.IncrementCampaignCount(ctx, campaign.ID)
	}

	return aff, nil
}

// GetDashboard returns summary data for the affiliate portal
func (s *AffiliateService) GetDashboard(ctx context.Context, userID uuid.UUID) (map[string]interface{}, error) {
	aff, err := s.affiliateRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	referrals, err := s.affiliateRepo.ListReferrals(ctx, aff.ID)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"affiliate": aff,
		"referrals": referrals,
		"stats": map[string]interface{}{
			"wallet_balance": aff.WalletBalance,
			"total_earnings": aff.TotalEarnings,
			"referred_count": aff.ReferredCount,
		},
	}, nil
}

// generateReferralCode creates a random unique code
func (s *AffiliateService) generateReferralCode() string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 6)
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	for i := range b {
		b[i] = charset[r.Intn(len(charset))]
	}
	return fmt.Sprintf("RRNET-%s", string(b))
}

// ListAll returns all affiliates in the system (Admin only)
func (s *AffiliateService) ListAll(ctx context.Context) ([]map[string]interface{}, error) {
	return s.affiliateRepo.ListAllAffiliates(ctx)
}

// UpdateStatus changes an affiliate's status (Admin only)
func (s *AffiliateService) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	return s.affiliateRepo.UpdateStatus(ctx, id, status)
}

// GetGlobalStats returns aggregate data for admin dashboard
// GetByCode retrieves an affiliate profile by referral code
func (s *AffiliateService) GetByCode(ctx context.Context, code string) (*affiliate.Affiliate, error) {
	return s.affiliateRepo.GetByCode(ctx, code)
}

// GetCommissionRate returns the commission percentage based on current strategy
func (s *AffiliateService) GetCommissionRate(ctx context.Context, tier affiliate.Tier) float64 {
	campaign, err := s.affiliateRepo.GetCurrentCampaign(ctx)
	if err != nil {
		return 10.0 // Hard fallback
	}
	settings := s.getTierSettingsFromCampaign(campaign)

	switch tier {
	case affiliate.TierPlatinum:
		return settings.CommissionPlatinum
	case affiliate.TierGold:
		return settings.CommissionGold
	default:
		return settings.CommissionSilver
	}
}

// ProcessReferral registers a new referral and checks for tier upgrade
func (s *AffiliateService) ProcessReferral(ctx context.Context, ref *affiliate.Referral) error {
	// 1. Register the referral in repo
	if err := s.affiliateRepo.RegisterReferral(ctx, ref); err != nil {
		return err
	}

	// 2. Trigger automatic tier upgrade check
	return s.CheckAndUpgradeTier(ctx, ref.AffiliateID)
}

func (s *AffiliateService) GetGlobalStats(ctx context.Context) (map[string]interface{}, error) {
	return s.affiliateRepo.GetGlobalStats(ctx)
}

// ProcessCommission calculates and attributes earnings for a referral when a payment is processed
func (s *AffiliateService) ProcessCommission(ctx context.Context, tenantID uuid.UUID, invoiceID uuid.UUID, totalPaid float64) error {
	// 1. Check if the tenant was referred
	ref, err := s.affiliateRepo.GetReferralByTenantID(ctx, tenantID)
	if err != nil {
		if errors.Is(err, repository.ErrAffiliateNotFound) {
			return nil // No referral, ignore
		}
		return err
	}

	// 2. Check if referral is still active
	if ref.Status != "active" {
		log.Info().Str("tenant_id", tenantID.String()).Msg("Referral found but not active, skipping commission")
		return nil
	}

	// 3. Check 4x max limit
	count, err := s.affiliateRepo.CountCommissionsByReferral(ctx, ref.ID)
	if err != nil {
		return err
	}
	if count >= 4 { // Only up to 4 recurring payments
		log.Info().Str("tenant_id", tenantID.String()).Msg("Tenant referral reached 4x commission limit, skipping")
		return nil
	}

	// 4. Calculate commission amount
	commissionAmount := (totalPaid * ref.CommissionPercentage) / 100.0

	// 5. Create Commission entry
	now := time.Now()
	comm := &affiliate.Commission{
		ID:          uuid.New(),
		AffiliateID: ref.AffiliateID,
		ReferralID:  ref.ID,
		InvoiceID:   invoiceID,
		Amount:      commissionAmount,
		Percentage:  ref.CommissionPercentage,
		Status:      "paid", // Ready to be withdrawn inside wallet_balance
		PaidAt:      &now,
		CreatedAt:   now,
	}

	if err := s.affiliateRepo.AddCommission(ctx, comm); err != nil {
		log.Error().Err(err).Msg("Failed adding commission to affiliate repository")
		return err
	}

	log.Info().
		Str("affiliate_id", ref.AffiliateID.String()).
		Str("tenant_id", tenantID.String()).
		Float64("commission_amount", commissionAmount).
		Int("commission_count", count+1).
		Msg("Processed affiliate commission successfully")

	return nil
}

// getTierSettingsFromCampaign parses the JSONB tier config into a struct
func (s *AffiliateService) getTierSettingsFromCampaign(c *affiliate.Campaign) AffiliateTierSettings {
	var settings AffiliateTierSettings
	if c == nil || c.TierConfig == nil {
		// Fallback defaults
		return AffiliateTierSettings{Silver: 0, Gold: 5, Platinum: 15, CommissionSilver: 10, CommissionGold: 20, CommissionPlatinum: 30, RetentionMonths: 3}
	}

	configBytes, _ := json.Marshal(c.TierConfig)
	if err := json.Unmarshal(configBytes, &settings); err != nil {
		return AffiliateTierSettings{Silver: 0, Gold: 5, Platinum: 15, CommissionSilver: 10, CommissionGold: 20, CommissionPlatinum: 30, RetentionMonths: 3}
	}
	return settings
}

// CheckAndUpgradeTier checks if affiliate's referral count reached higher tier thresholds
func (s *AffiliateService) CheckAndUpgradeTier(ctx context.Context, affiliateID uuid.UUID) error {
	// 1. Get affiliate profile
	aff, err := s.affiliateRepo.GetByUserID(ctx, affiliateID)
	if err != nil {
		aff, err = s.affiliateRepo.GetByID(ctx, affiliateID)
		if err != nil {
			return err
		}
	}

	// 2. Get current active strategy rules
	campaign, err := s.affiliateRepo.GetCurrentCampaign(ctx)
	if err != nil {
		return err
	}
	settings := s.getTierSettingsFromCampaign(campaign)

	// 3. Get ACTIVE referral count
	activeCount, err := s.affiliateRepo.GetActiveReferralCount(ctx, aff.ID)
	if err != nil {
		return err
	}

	// 4. Determine calculated tier based on ACTIVE count and CURRENT STRATEGY
	calculatedTier := affiliate.TierSilver
	if activeCount >= settings.Platinum {
		calculatedTier = affiliate.TierPlatinum
	} else if activeCount >= settings.Gold {
		calculatedTier = affiliate.TierGold
	}

	// 5. Logic for UPGRADE or RETENTION
	now := time.Now()
	
	// Case A: Upgrade (Active count qualifies for a HIGHER tier than current)
	if s.tierValue(calculatedTier) > s.tierValue(aff.Tier) {
		// Instant upgrade, clear any expiry
		return s.affiliateRepo.UpdateTier(ctx, aff.ID, calculatedTier, nil)
	}

	// Case B: Downgrade protection
	if s.tierValue(aff.Tier) > s.tierValue(calculatedTier) {
		// Use retention from strategy
		retention := settings.RetentionMonths
		if retention <= 0 {
			retention = 3
		}

		if aff.TierExpiresAt == nil {
			expiresAt := now.AddDate(0, retention, 0)
			return s.affiliateRepo.UpdateTier(ctx, aff.ID, aff.Tier, &expiresAt)
		} else if now.After(*aff.TierExpiresAt) {
			return s.affiliateRepo.UpdateTier(ctx, aff.ID, calculatedTier, nil)
		}
		return nil
	}

	// Case C: Matches or Silver
	if aff.TierExpiresAt != nil {
		return s.affiliateRepo.UpdateTier(ctx, aff.ID, calculatedTier, nil)
	}

	return nil
}

// tierValue returns a numeric weight for tiers to simplify comparison
func (s *AffiliateService) tierValue(t affiliate.Tier) int {
	switch t {
	case affiliate.TierPlatinum:
		return 3
	case affiliate.TierGold:
		return 2
	default:
		return 1
	}
}

// GetSettings (Admin)
func (s *AffiliateService) GetSettings(ctx context.Context) (*AffiliateTierSettings, error) {
	defaults := &AffiliateTierSettings{
		Silver:             0,
		Gold:               5,
		Platinum:           15,
		CommissionSilver:   15,
		CommissionGold:     25,
		CommissionPlatinum: 35,
		RetentionMonths:    3,
	}

	setting, err := s.siteSettingsRepo.GetByKey(ctx, "affiliate_tier_thresholds")
	if err != nil || setting == nil {
		// Key doesn't exist yet — return defaults without error
		return defaults, nil
	}

	var settings AffiliateTierSettings
	if err := json.Unmarshal(setting.Value, &settings); err != nil {
		// Corrupt data — return defaults without error
		return defaults, nil
	}
	return &settings, nil
}

// UpdateSettings (Admin)
func (s *AffiliateService) UpdateSettings(ctx context.Context, settingsData *AffiliateTierSettings) error {
	val, _ := json.Marshal(settingsData)
	return s.siteSettingsRepo.Upsert(ctx, &site_setting.SiteSetting{
		Key:   "affiliate_tier_thresholds",
		Value: val,
	})
}

// CreateWithdrawal creates a new withdrawal request if sufficient funds exist
func (s *AffiliateService) CreateWithdrawal(ctx context.Context, userID uuid.UUID, amount float64, bank, number, name string) error {
	aff, err := s.affiliateRepo.GetByUserID(ctx, userID)
	if err != nil {
		return err
	}

	if aff.WalletBalance < amount {
		return fmt.Errorf("saldo tidak mencukupi untuk penarikan")
	}

	if amount < 100000 {
		return fmt.Errorf("minimal penarikan adalah Rp 100.000")
	}

	w := &affiliate.Withdrawal{
		ID:            uuid.New(),
		AffiliateID:    aff.ID,
		Amount:        amount,
		BankName:      bank,
		AccountNumber: number,
		AccountName:   name,
		Status:        affiliate.WithdrawalPending,
		CreatedAt:     time.Now(),
	}

	return s.affiliateRepo.CreateWithdrawal(ctx, w)
}

// GetWithdrawals history for affiliate
func (s *AffiliateService) GetWithdrawals(ctx context.Context, userID uuid.UUID) ([]*affiliate.Withdrawal, error) {
	aff, err := s.affiliateRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	return s.affiliateRepo.GetWithdrawals(ctx, aff.ID)
}

// UpdateProfileMetadata updates affiliate portal settings (bank info, etc)
func (s *AffiliateService) UpdateProfileMetadata(ctx context.Context, userID uuid.UUID, metadata map[string]interface{}) error {
	aff, err := s.affiliateRepo.GetByUserID(ctx, userID)
	if err != nil {
		return err
	}
	return s.affiliateRepo.UpdateMetadata(ctx, aff.ID, metadata)
}

// Campaign Methods

func (s *AffiliateService) ListCampaigns(ctx context.Context) ([]*affiliate.Campaign, error) {
	return s.affiliateRepo.ListCampaigns(ctx)
}

func (s *AffiliateService) CreateCampaign(ctx context.Context, c *affiliate.Campaign) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return s.affiliateRepo.CreateCampaign(ctx, c)
}

func (s *AffiliateService) UpdateCampaign(ctx context.Context, c *affiliate.Campaign) error {
	return s.affiliateRepo.UpdateCampaign(ctx, c)
}

func (s *AffiliateService) GetCampaign(ctx context.Context, id uuid.UUID) (*affiliate.Campaign, error) {
	return s.affiliateRepo.GetCampaignByID(ctx, id)
}

func (s *AffiliateService) GetByIDDetail(ctx context.Context, id uuid.UUID) (map[string]interface{}, error) {
	aff, err := s.affiliateRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.GetDashboard(ctx, aff.UserID)
}
