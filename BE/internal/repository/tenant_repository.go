package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/tenant"
)

var (
	ErrTenantNotFound = errors.New("tenant not found")
	ErrSlugTaken      = errors.New("slug already taken")
)

// TenantRepository handles tenant database operations
type TenantRepository struct {
	db *pgxpool.Pool
}

// NewTenantRepository creates a new tenant repository
func NewTenantRepository(db *pgxpool.Pool) *TenantRepository {
	return &TenantRepository{db: db}
}

// Create creates a new tenant
func (r *TenantRepository) Create(ctx context.Context, t *tenant.Tenant) error {
	query := `
		INSERT INTO tenants (id, name, slug, domain, status, plan_id, billing_status, trial_ends_at, settings, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err := r.db.Exec(ctx, query,
		t.ID, t.Name, t.Slug, t.Domain, t.Status, t.PlanID, t.BillingStatus, t.TrialEndsAt, t.Settings, t.CreatedAt, t.UpdatedAt,
	)
	return err
}

// GetByID retrieves a tenant by ID
func (r *TenantRepository) GetByID(ctx context.Context, id uuid.UUID) (*tenant.Tenant, error) {
	query := `
		SELECT id, name, slug, domain, status, plan_id, billing_status, trial_ends_at, settings, created_at, updated_at, deleted_at
		FROM tenants
		WHERE id = $1 AND deleted_at IS NULL
	`
	var t tenant.Tenant
	err := r.db.QueryRow(ctx, query, id).Scan(
		&t.ID, &t.Name, &t.Slug, &t.Domain, &t.Status, &t.PlanID, &t.BillingStatus, &t.TrialEndsAt, &t.Settings, &t.CreatedAt, &t.UpdatedAt, &t.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTenantNotFound
		}
		return nil, err
	}
	return &t, nil
}

// GetBySlug retrieves a tenant by slug (subdomain)
func (r *TenantRepository) GetBySlug(ctx context.Context, slug string) (*tenant.Tenant, error) {
	query := `
		SELECT id, name, slug, domain, status, plan_id, billing_status, trial_ends_at, settings, created_at, updated_at, deleted_at
		FROM tenants
		WHERE slug = $1 AND deleted_at IS NULL
	`
	var t tenant.Tenant
	err := r.db.QueryRow(ctx, query, slug).Scan(
		&t.ID, &t.Name, &t.Slug, &t.Domain, &t.Status, &t.PlanID, &t.BillingStatus, &t.TrialEndsAt, &t.Settings, &t.CreatedAt, &t.UpdatedAt, &t.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTenantNotFound
		}
		return nil, err
	}
	return &t, nil
}

// Update updates a tenant
func (r *TenantRepository) Update(ctx context.Context, t *tenant.Tenant) error {
	query := `
		UPDATE tenants
		SET name = $2, slug = $3, domain = $4, status = $5, plan_id = $6, billing_status = $7, trial_ends_at = $8, settings = $9, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`
	result, err := r.db.Exec(ctx, query,
		t.ID, t.Name, t.Slug, t.Domain, t.Status, t.PlanID, t.BillingStatus, t.TrialEndsAt, t.Settings,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrTenantNotFound
	}
	return nil
}

// UpdateSettings updates only the tenant settings JSON.
func (r *TenantRepository) UpdateSettings(ctx context.Context, tenantID uuid.UUID, settings map[string]interface{}) error {
	query := `
		UPDATE tenants
		SET settings = $2, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`
	res, err := r.db.Exec(ctx, query, tenantID, settings)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrTenantNotFound
	}
	return nil
}

// ListAll retrieves all tenants (for super admin)
func (r *TenantRepository) ListAll(ctx context.Context) ([]*tenant.Tenant, error) {
	query := `
		SELECT id, name, slug, domain, status, plan_id, billing_status, trial_ends_at, settings, created_at, updated_at, deleted_at
		FROM tenants
		WHERE deleted_at IS NULL
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tenants []*tenant.Tenant
	for rows.Next() {
		var t tenant.Tenant
		err := rows.Scan(
			&t.ID, &t.Name, &t.Slug, &t.Domain, &t.Status, &t.PlanID, &t.BillingStatus, &t.TrialEndsAt, &t.Settings, &t.CreatedAt, &t.UpdatedAt, &t.DeletedAt,
		)
		if err != nil {
			return nil, err
		}
		tenants = append(tenants, &t)
	}
	return tenants, nil
}

// SoftDelete soft deletes a tenant
func (r *TenantRepository) SoftDelete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE tenants SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`
	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrTenantNotFound
	}
	return nil
}

// SlugExists checks if a slug is already taken
func (r *TenantRepository) SlugExists(ctx context.Context, slug string, excludeID *uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM tenants WHERE slug = $1 AND deleted_at IS NULL`
	args := []interface{}{slug}

	if excludeID != nil {
		query += ` AND id != $2`
		args = append(args, *excludeID)
	}
	query += `)`

	var exists bool
	err := r.db.QueryRow(ctx, query, args...).Scan(&exists)
	return exists, err
}

