package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/addon"
)

var (
	ErrAddonNotFound  = errors.New("addon not found")
	ErrAddonCodeTaken = errors.New("addon code already taken")
)

// AddonRepository handles addon database operations
type AddonRepository struct {
	db *pgxpool.Pool
}

// NewAddonRepository creates a new addon repository
func NewAddonRepository(db *pgxpool.Pool) *AddonRepository {
	return &AddonRepository{db: db}
}

func (r *AddonRepository) Create(ctx context.Context, a *addon.Addon) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `
		INSERT INTO addons (id, code, name, description, price, billing_cycle, currency, addon_type, value, is_active, available_for_plans, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	_, err = tx.Exec(ctx, query,
		a.ID, a.Code, a.Name, a.Description, a.Price, a.BillingCycle, a.Currency, a.Type, a.Value, a.IsActive, a.AvailableForPlans, a.CreatedAt, a.UpdatedAt,
	)
	if err != nil {
		return err
	}

	// Save relational data
	if len(a.FeaturesList) > 0 {
		if err := r.saveFeatures(ctx, tx, a.ID, a.FeaturesList); err != nil {
			return err
		}
	}
	if len(a.LimitsMap) > 0 {
		if err := r.saveLimits(ctx, tx, a.ID, a.LimitsMap); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *AddonRepository) GetByID(ctx context.Context, id uuid.UUID) (*addon.Addon, error) {
	query := `
		SELECT id, code, name, description, price, billing_cycle, currency, addon_type, value, is_active, available_for_plans, created_at, updated_at
		FROM addons
		WHERE id = $1
	`
	var a addon.Addon
	err := r.db.QueryRow(ctx, query, id).Scan(
		&a.ID, &a.Code, &a.Name, &a.Description, &a.Price, &a.BillingCycle, &a.Currency, &a.Type, &a.Value, &a.IsActive, &a.AvailableForPlans, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAddonNotFound
		}
		return nil, err
	}

	// Fetch relational data
	a.FeaturesList, _ = r.fetchFeatures(ctx, a.ID)
	a.LimitsMap, _ = r.fetchLimits(ctx, a.ID)

	return &a, nil
}

func (r *AddonRepository) GetByCode(ctx context.Context, code string) (*addon.Addon, error) {
	query := `
		SELECT id, code, name, description, price, billing_cycle, currency, addon_type, value, is_active, available_for_plans, created_at, updated_at
		FROM addons
		WHERE code = $1
	`
	var a addon.Addon
	err := r.db.QueryRow(ctx, query, code).Scan(
		&a.ID, &a.Code, &a.Name, &a.Description, &a.Price, &a.BillingCycle, &a.Currency, &a.Type, &a.Value, &a.IsActive, &a.AvailableForPlans, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAddonNotFound
		}
		return nil, err
	}

	// Fetch relational data
	a.FeaturesList, _ = r.fetchFeatures(ctx, a.ID)
	a.LimitsMap, _ = r.fetchLimits(ctx, a.ID)

	return &a, nil
}

// ListAll retrieves all addons (for super admin)
func (r *AddonRepository) ListAll(ctx context.Context) ([]*addon.Addon, error) {
	return r.List(ctx, false, nil)
}

// List retrieves all addons with optional filters
func (r *AddonRepository) List(ctx context.Context, activeOnly bool, addonType *addon.AddonType) ([]*addon.Addon, error) {
	query := `
		SELECT id, code, name, description, price, billing_cycle, currency, addon_type, value, is_active, available_for_plans, created_at, updated_at
		FROM addons
		WHERE 1=1
	`
	args := []interface{}{}
	argNum := 1

	if activeOnly {
		query += ` AND is_active = $` + string(rune('0'+argNum))
		args = append(args, true)
		argNum++
	}
	if addonType != nil {
		query += ` AND addon_type = $` + string(rune('0'+argNum))
		args = append(args, *addonType)
	}
	query += ` ORDER BY name ASC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var addons []*addon.Addon
	addonIDs := []uuid.UUID{}
	addonMap := make(map[uuid.UUID]*addon.Addon)

	for rows.Next() {
		var a addon.Addon
		if err := rows.Scan(
			&a.ID, &a.Code, &a.Name, &a.Description, &a.Price, &a.BillingCycle, &a.Currency, &a.Type, &a.Value, &a.IsActive, &a.AvailableForPlans, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		a.FeaturesList = []string{}
		a.LimitsMap = make(map[string]int)
		addons = append(addons, &a)
		addonIDs = append(addonIDs, a.ID)
		addonMap[a.ID] = &a
	}

	if len(addonIDs) > 0 {
		// Fetch features
		fRows, err := r.db.Query(ctx, `SELECT addon_id, feature_code FROM addon_features WHERE addon_id = ANY($1)`, addonIDs)
		if err == nil {
			defer fRows.Close()
			for fRows.Next() {
				var aid uuid.UUID
				var f string
				if err := fRows.Scan(&aid, &f); err == nil {
					if a, ok := addonMap[aid]; ok {
						a.FeaturesList = append(a.FeaturesList, f)
					}
				}
			}
		}

		// Fetch limits
		lRows, err := r.db.Query(ctx, `SELECT addon_id, limit_name, limit_value FROM addon_limits WHERE addon_id = ANY($1)`, addonIDs)
		if err == nil {
			defer lRows.Close()
			for lRows.Next() {
				var aid uuid.UUID
				var name string
				var val int
				if err := lRows.Scan(&aid, &name, &val); err == nil {
					if a, ok := addonMap[aid]; ok {
						a.LimitsMap[name] = val
					}
				}
			}
		}
	}

	return addons, nil
}

func (r *AddonRepository) Update(ctx context.Context, a *addon.Addon) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `
		UPDATE addons
		SET name = $2, description = $3, price = $4, billing_cycle = $5, currency = $6, addon_type = $7, value = $8, is_active = $9, available_for_plans = $10, updated_at = NOW()
		WHERE id = $1
	`
	result, err := tx.Exec(ctx, query,
		a.ID, a.Name, a.Description, a.Price, a.BillingCycle, a.Currency, a.Type, a.Value, a.IsActive, a.AvailableForPlans,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrAddonNotFound
	}

	// Save relational data
	if err := r.saveFeatures(ctx, tx, a.ID, a.FeaturesList); err != nil {
		return err
	}
	if err := r.saveLimits(ctx, tx, a.ID, a.LimitsMap); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// Delete deletes an addon
func (r *AddonRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.db.Exec(ctx, `DELETE FROM addons WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrAddonNotFound
	}
	return nil
}

// CodeExists checks if an addon code is already taken
func (r *AddonRepository) CodeExists(ctx context.Context, code string, excludeID *uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM addons WHERE code = $1`
	args := []interface{}{code}

	if excludeID != nil {
		query += ` AND id != $2`
		args = append(args, *excludeID)
	}
	query += `)`

	var exists bool
	err := r.db.QueryRow(ctx, query, args...).Scan(&exists)
	return exists, err
}

// GetTenantAddons retrieves all active addons for a tenant
func (r *AddonRepository) GetTenantAddons(ctx context.Context, tenantID uuid.UUID) ([]*addon.TenantAddon, error) {
	query := `
		SELECT ta.id, ta.tenant_id, ta.addon_id, ta.quantity, ta.status, ta.started_at, ta.expires_at, ta.cancelled_at, ta.created_at, ta.updated_at,
		       a.id, a.code, a.name, a.description, a.price, a.billing_cycle, a.currency, a.addon_type, a.value, a.is_active, a.available_for_plans, a.created_at, a.updated_at
		FROM tenant_addons ta
		INNER JOIN addons a ON a.id = ta.addon_id
		WHERE ta.tenant_id = $1 AND (ta.expires_at IS NULL OR ta.expires_at > NOW())
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tenantAddons []*addon.TenantAddon
	addonIDs := []uuid.UUID{}
	addonMap := make(map[uuid.UUID]*addon.Addon)

	for rows.Next() {
		var ta addon.TenantAddon
		var a addon.Addon
		if err := rows.Scan(
			&ta.ID, &ta.TenantID, &ta.AddonID, &ta.Quantity, &ta.Status, &ta.StartedAt, &ta.ExpiresAt, &ta.CancelledAt, &ta.CreatedAt, &ta.UpdatedAt,
			&a.ID, &a.Code, &a.Name, &a.Description, &a.Price, &a.BillingCycle, &a.Currency, &a.Type, &a.Value, &a.IsActive, &a.AvailableForPlans, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		a.FeaturesList = []string{}
		a.LimitsMap = make(map[string]int)
		ta.Addon = &a
		tenantAddons = append(tenantAddons, &ta)
		addonIDs = append(addonIDs, a.ID)
		addonMap[a.ID] = &a
	}

	if len(addonIDs) > 0 {
		// Fetch features
		fRows, err := r.db.Query(ctx, `SELECT addon_id, feature_code FROM addon_features WHERE addon_id = ANY($1)`, addonIDs)
		if err == nil {
			defer fRows.Close()
			for fRows.Next() {
				var aid uuid.UUID
				var f string
				if err := fRows.Scan(&aid, &f); err == nil {
					if a, ok := addonMap[aid]; ok {
						a.FeaturesList = append(a.FeaturesList, f)
					}
				}
			}
		}

		// Fetch limits
		lRows, err := r.db.Query(ctx, `SELECT addon_id, limit_name, limit_value FROM addon_limits WHERE addon_id = ANY($1)`, addonIDs)
		if err == nil {
			defer lRows.Close()
			for lRows.Next() {
				var aid uuid.UUID
				var name string
				var val int
				if err := lRows.Scan(&aid, &name, &val); err == nil {
					if a, ok := addonMap[aid]; ok {
						a.LimitsMap[name] = val
					}
				}
			}
		}
	}

	return tenantAddons, nil
}

// AssignAddonToTenant assigns an addon to a tenant (with quantity support)
func (r *AddonRepository) AssignAddonToTenant(ctx context.Context, tenantID, addonID uuid.UUID, expiresAt *time.Time, quantity int) error {
	if quantity <= 0 {
		quantity = 1
	}
	query := `
		INSERT INTO tenant_addons (id, tenant_id, addon_id, quantity, started_at, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), $5, NOW(), NOW())
		ON CONFLICT (tenant_id, addon_id) DO UPDATE SET
			quantity = tenant_addons.quantity + $4,
			expires_at = COALESCE($5, tenant_addons.expires_at),
			updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, uuid.New(), tenantID, addonID, quantity, expiresAt)
	return err
}

// RemoveAddonFromTenant removes an addon from a tenant
func (r *AddonRepository) RemoveAddonFromTenant(ctx context.Context, tenantID, addonID uuid.UUID) error {
	result, err := r.db.Exec(ctx, `DELETE FROM tenant_addons WHERE tenant_id = $1 AND addon_id = $2`, tenantID, addonID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrAddonNotFound
	}
	return nil
}

// CancelAddonRenewal marks a tenant's addon as cancelled so it won't be renewed
func (r *AddonRepository) CancelAddonRenewal(ctx context.Context, tenantID, addonID uuid.UUID) error {
	query := `
		UPDATE tenant_addons
		SET cancelled_at = NOW(), updated_at = NOW()
		WHERE tenant_id = $1 AND addon_id = $2 AND status = 'active' AND cancelled_at IS NULL
	`
	result, err := r.db.Exec(ctx, query, tenantID, addonID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrAddonNotFound
	}
	return nil
}

func (r *AddonRepository) fetchFeatures(ctx context.Context, addonID uuid.UUID) ([]string, error) {
	rows, err := r.db.Query(ctx, `SELECT feature_code FROM addon_features WHERE addon_id = $1`, addonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var features []string
	for rows.Next() {
		var f string
		if err := rows.Scan(&f); err != nil {
			return nil, err
		}
		features = append(features, f)
	}
	return features, nil
}

func (r *AddonRepository) fetchLimits(ctx context.Context, addonID uuid.UUID) (map[string]int, error) {
	rows, err := r.db.Query(ctx, `SELECT limit_name, limit_value FROM addon_limits WHERE addon_id = $1`, addonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	limits := make(map[string]int)
	for rows.Next() {
		var name string
		var val int
		if err := rows.Scan(&name, &val); err != nil {
			return nil, err
		}
		limits[name] = val
	}
	return limits, nil
}

func (r *AddonRepository) saveFeatures(ctx context.Context, tx pgx.Tx, addonID uuid.UUID, features []string) error {
	_, err := tx.Exec(ctx, `DELETE FROM addon_features WHERE addon_id = $1`, addonID)
	if err != nil {
		return err
	}
	for _, f := range features {
		_, err = tx.Exec(ctx, `INSERT INTO addon_features (addon_id, feature_code) VALUES ($1, $2)`, addonID, f)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *AddonRepository) saveLimits(ctx context.Context, tx pgx.Tx, addonID uuid.UUID, limits map[string]int) error {
	_, err := tx.Exec(ctx, `DELETE FROM addon_limits WHERE addon_id = $1`, addonID)
	if err != nil {
		return err
	}
	for name, val := range limits {
		_, err = tx.Exec(ctx, `INSERT INTO addon_limits (addon_id, limit_name, limit_value) VALUES ($1, $2, $3)`, addonID, name, val)
		if err != nil {
			return err
		}
	}
	return nil
}
