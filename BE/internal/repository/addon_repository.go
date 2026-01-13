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

// Create creates a new addon
func (r *AddonRepository) Create(ctx context.Context, a *addon.Addon) error {
	query := `
		INSERT INTO addons (id, code, name, description, price, billing_cycle, currency, addon_type, value, is_active, available_for_plans, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	_, err := r.db.Exec(ctx, query,
		a.ID, a.Code, a.Name, a.Description, a.Price, a.BillingCycle, a.Currency, a.Type, a.Value, a.IsActive, a.AvailableForPlans, a.CreatedAt, a.UpdatedAt,
	)
	return err
}

// GetByID retrieves an addon by ID
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
	return &a, nil
}

// GetByCode retrieves an addon by code
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
	for rows.Next() {
		var a addon.Addon
		if err := rows.Scan(
			&a.ID, &a.Code, &a.Name, &a.Description, &a.Price, &a.BillingCycle, &a.Currency, &a.Type, &a.Value, &a.IsActive, &a.AvailableForPlans, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		addons = append(addons, &a)
	}

	return addons, nil
}

// Update updates an addon
func (r *AddonRepository) Update(ctx context.Context, a *addon.Addon) error {
	query := `
		UPDATE addons
		SET name = $2, description = $3, price = $4, billing_cycle = $5, currency = $6, addon_type = $7, value = $8, is_active = $9, available_for_plans = $10, updated_at = NOW()
		WHERE id = $1
	`
	result, err := r.db.Exec(ctx, query,
		a.ID, a.Name, a.Description, a.Price, a.BillingCycle, a.Currency, a.Type, a.Value, a.IsActive, a.AvailableForPlans,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrAddonNotFound
	}
	return nil
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
		SELECT ta.id, ta.tenant_id, ta.addon_id, ta.custom_config, ta.started_at, ta.expires_at, ta.created_at, ta.updated_at,
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
	for rows.Next() {
		var ta addon.TenantAddon
		var a addon.Addon
		if err := rows.Scan(
			&ta.ID, &ta.TenantID, &ta.AddonID, &ta.CustomConfig, &ta.StartedAt, &ta.ExpiresAt, &ta.CreatedAt, &ta.UpdatedAt,
			&a.ID, &a.Code, &a.Name, &a.Description, &a.Price, &a.BillingCycle, &a.Currency, &a.Type, &a.Value, &a.IsActive, &a.AvailableForPlans, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		ta.Addon = &a
		tenantAddons = append(tenantAddons, &ta)
	}

	return tenantAddons, nil
}

// AssignAddonToTenant assigns an addon to a tenant
func (r *AddonRepository) AssignAddonToTenant(ctx context.Context, tenantID, addonID uuid.UUID, expiresAt *time.Time) error {
	query := `
		INSERT INTO tenant_addons (id, tenant_id, addon_id, started_at, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), $4, NOW(), NOW())
		ON CONFLICT (tenant_id, addon_id) DO UPDATE SET expires_at = $4, updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, uuid.New(), tenantID, addonID, expiresAt)
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


