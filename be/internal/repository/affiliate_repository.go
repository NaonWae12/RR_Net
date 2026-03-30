package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/affiliate"
)

var (
	ErrAffiliateNotFound = errors.New("affiliate not found")
	ErrDuplicateCode    = errors.New("referral code already exists")
)

type AffiliateRepository struct {
	db *pgxpool.Pool
}

func NewAffiliateRepository(db *pgxpool.Pool) *AffiliateRepository {
	return &AffiliateRepository{db: db}
}

// Create creates a new affiliate record
func (r *AffiliateRepository) Create(ctx context.Context, a *affiliate.Affiliate) error {
	query := `
		INSERT INTO affiliates (id, user_id, code, tier, wallet_balance, total_earnings, referred_count, status, metadata, tier_expires_at, tier_upgraded_at, joined_campaign_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`
	_, err := r.db.Exec(ctx, query,
		a.ID, a.UserID, a.Code, a.Tier, a.WalletBalance, a.TotalEarnings, a.ReferredCount, a.Status, a.Metadata, a.TierExpiresAt, a.TierUpgradedAt, a.JoinedCampaignID, a.CreatedAt, a.UpdatedAt,
	)
	return err
}

// GetByUserID retrieves an affiliate by user ID
func (r *AffiliateRepository) GetByUserID(ctx context.Context, userID uuid.UUID) (*affiliate.Affiliate, error) {
	query := `
		SELECT id, user_id, code, tier, wallet_balance, total_earnings, referred_count, status, metadata, tier_expires_at, tier_upgraded_at, joined_campaign_id, created_at, updated_at
		FROM affiliates
		WHERE user_id = $1
	`
	var a affiliate.Affiliate
	err := r.db.QueryRow(ctx, query, userID).Scan(
		&a.ID, &a.UserID, &a.Code, &a.Tier, &a.WalletBalance, &a.TotalEarnings, &a.ReferredCount, &a.Status, &a.Metadata, &a.TierExpiresAt, &a.TierUpgradedAt, &a.JoinedCampaignID, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAffiliateNotFound
		}
		return nil, err
	}
	return &a, nil
}

// GetByCode retrieves an affiliate by referral code
func (r *AffiliateRepository) GetByCode(ctx context.Context, code string) (*affiliate.Affiliate, error) {
	query := `
		SELECT id, user_id, code, tier, wallet_balance, total_earnings, referred_count, status, metadata, tier_expires_at, tier_upgraded_at, joined_campaign_id, created_at, updated_at
		FROM affiliates
		WHERE code = $1
	`
	var a affiliate.Affiliate
	err := r.db.QueryRow(ctx, query, code).Scan(
		&a.ID, &a.UserID, &a.Code, &a.Tier, &a.WalletBalance, &a.TotalEarnings, &a.ReferredCount, &a.Status, &a.Metadata, &a.TierExpiresAt, &a.TierUpgradedAt, &a.JoinedCampaignID, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAffiliateNotFound
		}
		return nil, err
	}
	return &a, nil
}

// GetByID retrieves a single affiliate by its direct ID
func (r *AffiliateRepository) GetByID(ctx context.Context, id uuid.UUID) (*affiliate.Affiliate, error) {
	query := `
		SELECT id, user_id, code, tier, wallet_balance, total_earnings, referred_count, status, metadata, tier_expires_at, tier_upgraded_at, joined_campaign_id, created_at, updated_at
		FROM affiliates
		WHERE id = $1
	`
	var a affiliate.Affiliate
	err := r.db.QueryRow(ctx, query, id).Scan(
		&a.ID, &a.UserID, &a.Code, &a.Tier, &a.WalletBalance, &a.TotalEarnings, &a.ReferredCount, &a.Status, &a.Metadata, &a.TierExpiresAt, &a.TierUpgradedAt, &a.JoinedCampaignID, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAffiliateNotFound
		}
		return nil, err
	}
	return &a, nil
}

// UpdateTier updates an affiliate's tier and expiry
func (r *AffiliateRepository) UpdateTier(ctx context.Context, id uuid.UUID, tier affiliate.Tier, expiresAt *time.Time) error {
	var query string
	var err error
	if tier != "" {
		// If tier is changing or being refreshed/upgraded
		query = `
			UPDATE affiliates 
			SET tier = $2, 
			    tier_expires_at = $3, 
			    tier_upgraded_at = CASE WHEN tier != $2 THEN NOW() ELSE tier_upgraded_at END,
			    updated_at = NOW() 
			WHERE id = $1
		`
		_, err = r.db.Exec(ctx, query, id, tier, expiresAt)
	} else {
		// Just update expiry
		query = `UPDATE affiliates SET tier_expires_at = $2, updated_at = NOW() WHERE id = $1`
		_, err = r.db.Exec(ctx, query, id, expiresAt)
	}
	return err
}

// RegisterReferral records a new referral linkage
func (r *AffiliateRepository) RegisterReferral(ctx context.Context, ref *affiliate.Referral) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Insert referral record
	queryRef := `
		INSERT INTO affiliate_referrals (id, affiliate_id, referred_tenant_id, commission_percentage, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err = tx.Exec(ctx, queryRef,
		ref.ID, ref.AffiliateID, ref.ReferredTenantID, ref.CommissionPercentage, ref.Status, ref.CreatedAt,
	)
	if err != nil {
		return err
	}

	// 2. Increment referred_count in affiliates table
	queryUpdateCount := `UPDATE affiliates SET referred_count = referred_count + 1 WHERE id = $1`
	_, err = tx.Exec(ctx, queryUpdateCount, ref.AffiliateID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// GetReferralByTenantID retrieves a referral by referred tenant ID
func (r *AffiliateRepository) GetReferralByTenantID(ctx context.Context, tenantID uuid.UUID) (*affiliate.Referral, error) {
	query := `
		SELECT id, affiliate_id, referred_tenant_id, commission_percentage, status, created_at
		FROM affiliate_referrals
		WHERE referred_tenant_id = $1
	`
	var ref affiliate.Referral
	err := r.db.QueryRow(ctx, query, tenantID).Scan(
		&ref.ID, &ref.AffiliateID, &ref.ReferredTenantID, &ref.CommissionPercentage, &ref.Status, &ref.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAffiliateNotFound
		}
		return nil, err
	}
	return &ref, nil
}

// CountCommissionsByReferral returns the number of times commission was distributed for a referral
func (r *AffiliateRepository) CountCommissionsByReferral(ctx context.Context, referralID uuid.UUID) (int, error) {
	query := `SELECT count(*) FROM affiliate_commissions WHERE referral_id = $1`
	var count int
	err := r.db.QueryRow(ctx, query, referralID).Scan(&count)
	return count, err
}

// AddCommission adds a new commission entry and updates the affiliate's wallet
func (r *AffiliateRepository) AddCommission(ctx context.Context, comm *affiliate.Commission) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Insert commission record
	queryComm := `
		INSERT INTO affiliate_commissions (id, affiliate_id, referral_id, invoice_id, amount, percentage, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err = tx.Exec(ctx, queryComm,
		comm.ID, comm.AffiliateID, comm.ReferralID, comm.InvoiceID, comm.Amount, comm.Percentage, comm.Status, comm.CreatedAt,
	)
	if err != nil {
		return err
	}

	// 2. Update affiliate balance (wallet_balance and total_earnings)
	queryUpdateBalance := `
		UPDATE affiliates 
		SET wallet_balance = wallet_balance + $2, 
		    total_earnings = total_earnings + $2,
		    updated_at = NOW()
		WHERE id = $1
	`
	_, err = tx.Exec(ctx, queryUpdateBalance, comm.AffiliateID, comm.Amount)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// GetStats returns summary stats for an affiliate
func (r *AffiliateRepository) GetStats(ctx context.Context, affiliateID uuid.UUID) (float64, int, float64, error) {
	query := `
		SELECT wallet_balance, referred_count, total_earnings 
		FROM affiliates WHERE id = $1
	`
	var balance float64
	var count int
	var total float64
	err := r.db.QueryRow(ctx, query, affiliateID).Scan(&balance, &count, &total)
	return balance, count, total, err
}

// GetActiveReferralCount returns the number of referrals that still have commission claims left (< 4)
func (r *AffiliateRepository) GetActiveReferralCount(ctx context.Context, affiliateID uuid.UUID) (int, error) {
	query := `
		SELECT COUNT(*) 
		FROM affiliate_referrals ar
		WHERE ar.affiliate_id = $1 
		AND ar.status = 'active'
		AND (SELECT COUNT(*) FROM affiliate_commissions ac WHERE ac.referral_id = ar.id) < 4
	`
	var count int
	err := r.db.QueryRow(ctx, query, affiliateID).Scan(&count)
	return count, err
}

// ListReferrals returns referrals for an affiliate
func (r *AffiliateRepository) ListReferrals(ctx context.Context, affiliateID uuid.UUID) ([]map[string]interface{}, error) {
	query := `
		SELECT 
			ar.id, 
			t.name as tenant_name, 
			t.company_name, 
			ar.commission_percentage, 
			ar.status, 
			ar.created_at,
			(SELECT p.name FROM platform_invoices pi JOIN plans p ON pi.plan_id = p.id WHERE pi.tenant_id = t.id ORDER BY pi.created_at DESC LIMIT 1) as plan_name,
			(SELECT pi.amount FROM platform_invoices pi WHERE pi.tenant_id = t.id ORDER BY pi.created_at DESC LIMIT 1) as base_price,
			(SELECT count(*) FROM affiliate_commissions ac WHERE ac.referral_id = ar.id) as commission_count,
			(SELECT ac.created_at FROM affiliate_commissions ac WHERE ac.referral_id = ar.id ORDER BY ac.created_at DESC LIMIT 1) as last_payment_at
		FROM affiliate_referrals ar
		JOIN tenants t ON ar.referred_tenant_id = t.id
		WHERE ar.affiliate_id = $1
		ORDER BY ar.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, affiliateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var id uuid.UUID
		var tenantName, companyName, status, planName string
		var percentage float64
		var createdAt time.Time
		var basePrice int64
		var commissionCount int
		var lastPaymentAt *time.Time
		
		err := rows.Scan(&id, &tenantName, &companyName, &percentage, &status, &createdAt, &planName, &basePrice, &commissionCount, &lastPaymentAt)
		if err != nil {
			return nil, err
		}
		
		results = append(results, map[string]interface{}{
			"id":                    id,
			"tenant_name":           tenantName,
			"company_name":          companyName,
			"commission_percentage": percentage,
			"status":                status,
			"created_at":            createdAt,
			"plan_name":             planName,
			"base_price":            basePrice,
			"commission_count":      commissionCount,
			"max_commissions":       4, // Hardcoded for now
			"last_payment_at":       lastPaymentAt,
		})
	}
	return results, nil
}

// ListAllAffiliates returns all affiliates with user info
func (r *AffiliateRepository) ListAllAffiliates(ctx context.Context) ([]map[string]interface{}, error) {
	query := `
		SELECT a.id, a.user_id, u.name, u.email, u.phone, a.code, a.tier, a.wallet_balance, a.total_earnings, a.referred_count, a.status, a.created_at
		FROM affiliates a
		JOIN users u ON a.user_id = u.id
		ORDER BY a.created_at DESC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var id, userID uuid.UUID
		var name, email, code, tier, status string
		var phone *string
		var balance, earnings float64
		var count int
		var createdAt time.Time

		err := rows.Scan(&id, &userID, &name, &email, &phone, &code, &tier, &balance, &earnings, &count, &status, &createdAt)
		if err != nil {
			return nil, err
		}

		results = append(results, map[string]interface{}{
			"id":             id,
			"user_id":        userID,
			"name":           name,
			"email":          email,
			"phone":          phone,
			"code":           code,
			"tier":           tier,
			"wallet_balance": balance,
			"total_earnings": earnings,
			"referred_count": count,
			"status":         status,
			"created_at":     createdAt,
		})
	}
	return results, nil
}

// UpdateStatus changes the status of an affiliate
func (r *AffiliateRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string) error {
	query := `UPDATE affiliates SET status = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, status)
	return err
}

// GetGlobalStats returns summary stats for all affiliates
func (r *AffiliateRepository) GetGlobalStats(ctx context.Context) (map[string]interface{}, error) {
	query := `
		SELECT 
			COUNT(*) as total_partners,
			COALESCE(SUM(referred_count), 0) as total_referrals,
			COALESCE(SUM(total_earnings), 0) as total_payouts,
			COALESCE(COUNT(*) FILTER (WHERE status = 'pending'), 0) as pending_review
		FROM affiliates
	`
	var totalPartners, totalReferrals, pendingReview int
	var totalPayouts float64
	err := r.db.QueryRow(ctx, query).Scan(&totalPartners, &totalReferrals, &totalPayouts, &pendingReview)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total_partners":  totalPartners,
		"total_referrals": totalReferrals,
		"total_payouts":   totalPayouts,
		"pending_review":  pendingReview,
	}, nil
}

// CreateWithdrawal saves a new withdrawal request and deducts from wallet_balance
func (r *AffiliateRepository) CreateWithdrawal(ctx context.Context, w *affiliate.Withdrawal) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Insert withdrawal record
	queryW := `
		INSERT INTO affiliate_withdrawals (id, affiliate_id, amount, bank_name, account_number, account_name, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err = tx.Exec(ctx, queryW,
		w.ID, w.AffiliateID, w.Amount, w.BankName, w.AccountNumber, w.AccountName, w.Status, w.CreatedAt,
	)
	if err != nil {
		return err
	}

	// 2. Deduct from wallet_balance (but NOT total_earnings, as earnings tracks lifetime)
	queryUpdateBalance := `UPDATE affiliates SET wallet_balance = wallet_balance - $2, updated_at = NOW() WHERE id = $1`
	_, err = tx.Exec(ctx, queryUpdateBalance, w.AffiliateID, w.Amount)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// GetWithdrawals retrieves withdrawal history for an affiliate
func (r *AffiliateRepository) GetWithdrawals(ctx context.Context, affiliateID uuid.UUID) ([]*affiliate.Withdrawal, error) {
	query := `
		SELECT id, affiliate_id, amount, bank_name, account_number, account_name, status, processed_at, rejection_reason, created_at
		FROM affiliate_withdrawals
		WHERE affiliate_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, affiliateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []*affiliate.Withdrawal{}
	for rows.Next() {
		var w affiliate.Withdrawal
		err := rows.Scan(&w.ID, &w.AffiliateID, &w.Amount, &w.BankName, &w.AccountNumber, &w.AccountName, &w.Status, &w.ProcessedAt, &w.RejectionReason, &w.CreatedAt)
		if err != nil {
			return nil, err
		}
		results = append(results, &w)
	}
	return results, nil
}

// UpdateMetadata updates the metadata field for an affiliate (used for bank details info)
// GetCurrentCampaign finding the active promo campaign, or fallback to default
func (r *AffiliateRepository) GetCurrentCampaign(ctx context.Context) (*affiliate.Campaign, error) {
	// 1. Try to find an active promo campaign that hasn't expired or reached quota
	queryPromo := `
		SELECT id, name, description, tier_config, max_affiliates, current_affiliates_count, starts_at, ends_at, is_active, is_default, created_at, updated_at
		FROM affiliate_campaigns
		WHERE is_default = false 
		AND is_active = true
		AND starts_at <= NOW()
		AND (ends_at IS NULL OR ends_at > NOW())
		AND (max_affiliates = 0 OR current_affiliates_count < max_affiliates)
		ORDER BY created_at DESC
		LIMIT 1
	`
	var c affiliate.Campaign
	err := r.db.QueryRow(ctx, queryPromo).Scan(
		&c.ID, &c.Name, &c.Description, &c.TierConfig, &c.MaxAffiliates, &c.CurrentAffiliatesCount, &c.StartsAt, &c.EndsAt, &c.IsActive, &c.IsDefault, &c.CreatedAt, &c.UpdatedAt,
	)
	if err == nil {
		return &c, nil
	}

	// 2. Fallback to default
	queryDefault := `
		SELECT id, name, description, tier_config, max_affiliates, current_affiliates_count, starts_at, ends_at, is_active, is_default, created_at, updated_at
		FROM affiliate_campaigns
		WHERE is_default = true
		LIMIT 1
	`
	err = r.db.QueryRow(ctx, queryDefault).Scan(
		&c.ID, &c.Name, &c.Description, &c.TierConfig, &c.MaxAffiliates, &c.CurrentAffiliatesCount, &c.StartsAt, &c.EndsAt, &c.IsActive, &c.IsDefault, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *AffiliateRepository) IncrementCampaignCount(ctx context.Context, campaignID uuid.UUID) error {
	query := `UPDATE affiliate_campaigns SET current_affiliates_count = current_affiliates_count + 1 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, campaignID)
	return err
}

func (r *AffiliateRepository) ListCampaigns(ctx context.Context) ([]*affiliate.Campaign, error) {
	query := `SELECT id, name, description, tier_config, max_affiliates, current_affiliates_count, starts_at, ends_at, is_active, is_default, created_at, updated_at FROM affiliate_campaigns ORDER BY is_default DESC, created_at DESC`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []*affiliate.Campaign{}
	for rows.Next() {
		var c affiliate.Campaign
		err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.TierConfig, &c.MaxAffiliates, &c.CurrentAffiliatesCount, &c.StartsAt, &c.EndsAt, &c.IsActive, &c.IsDefault, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			return nil, err
		}
		results = append(results, &c)
	}
	return results, nil
}

func (r *AffiliateRepository) CreateCampaign(ctx context.Context, c *affiliate.Campaign) error {
	query := `
		INSERT INTO affiliate_campaigns (id, name, description, tier_config, max_affiliates, starts_at, ends_at, is_active, is_default)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.db.Exec(ctx, query, c.ID, c.Name, c.Description, c.TierConfig, c.MaxAffiliates, c.StartsAt, c.EndsAt, c.IsActive, c.IsDefault)
	return err
}

func (r *AffiliateRepository) UpdateCampaign(ctx context.Context, c *affiliate.Campaign) error {
	query := `
		UPDATE affiliate_campaigns 
		SET name = $2, description = $3, tier_config = $4, max_affiliates = $5, starts_at = $6, ends_at = $7, is_active = $8, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, c.ID, c.Name, c.Description, c.TierConfig, c.MaxAffiliates, c.StartsAt, c.EndsAt, c.IsActive)
	return err
}

func (r *AffiliateRepository) GetCampaignByID(ctx context.Context, id uuid.UUID) (*affiliate.Campaign, error) {
	query := `
		SELECT id, name, description, tier_config, max_affiliates, current_affiliates_count, starts_at, ends_at, is_active, is_default, created_at, updated_at
		FROM affiliate_campaigns WHERE id = $1
	`
	var c affiliate.Campaign
	err := r.db.QueryRow(ctx, query, id).Scan(
		&c.ID, &c.Name, &c.Description, &c.TierConfig, &c.MaxAffiliates, &c.CurrentAffiliatesCount, &c.StartsAt, &c.EndsAt, &c.IsActive, &c.IsDefault, &c.CreatedAt, &c.UpdatedAt,
	)
	return &c, err
}

// UpdateMetadata updates the metadata field for an affiliate
func (r *AffiliateRepository) UpdateMetadata(ctx context.Context, id uuid.UUID, metadata map[string]interface{}) error {
	query := `UPDATE affiliates SET metadata = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, metadata)
	return err
}
