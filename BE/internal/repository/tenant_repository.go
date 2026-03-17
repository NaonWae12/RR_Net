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
		INSERT INTO tenants (id, name, company_name, slug, domain, status, plan_id, billing_status, trial_ends_at, settings, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	_, err := r.db.Exec(ctx, query,
		t.ID, t.Name, t.CompanyName, t.Slug, t.Domain, t.Status, t.PlanID, t.BillingStatus, t.TrialEndsAt, t.Settings, t.CreatedAt, t.UpdatedAt,
	)
	return err
}

// GetByID retrieves a tenant by ID
func (r *TenantRepository) GetByID(ctx context.Context, id uuid.UUID) (*tenant.Tenant, error) {
	query := `
		SELECT id, name, company_name, slug, domain, status, plan_id, billing_status, trial_ends_at, settings, created_at, updated_at, deleted_at
		FROM tenants
		WHERE id = $1
	`
	var t tenant.Tenant
	err := r.db.QueryRow(ctx, query, id).Scan(
		&t.ID, &t.Name, &t.CompanyName, &t.Slug, &t.Domain, &t.Status, &t.PlanID, &t.BillingStatus, &t.TrialEndsAt, &t.Settings, &t.CreatedAt, &t.UpdatedAt, &t.DeletedAt,
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
		SELECT id, name, company_name, slug, domain, status, plan_id, billing_status, trial_ends_at, settings, created_at, updated_at, deleted_at
		FROM tenants
		WHERE slug = $1 AND deleted_at IS NULL
	`
	var t tenant.Tenant
	err := r.db.QueryRow(ctx, query, slug).Scan(
		&t.ID, &t.Name, &t.CompanyName, &t.Slug, &t.Domain, &t.Status, &t.PlanID, &t.BillingStatus, &t.TrialEndsAt, &t.Settings, &t.CreatedAt, &t.UpdatedAt, &t.DeletedAt,
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
		SET name = $2, company_name = $3, slug = $4, domain = $5, status = $6, plan_id = $7, billing_status = $8, trial_ends_at = $9, settings = $10, updated_at = NOW()
		WHERE id = $1
	`
	result, err := r.db.Exec(ctx, query,
		t.ID, t.Name, t.CompanyName, t.Slug, t.Domain, t.Status, t.PlanID, t.BillingStatus, t.TrialEndsAt, t.Settings,
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
		WHERE id = $1
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

// ListAll retrieves all tenants with their plan details (for super admin)
func (r *TenantRepository) ListAll(ctx context.Context) ([]*tenant.Tenant, error) {
	query := `
		SELECT 
			t.id, t.name, t.company_name, t.slug, t.domain, t.status, t.plan_id, t.billing_status, 
			t.trial_ends_at, t.settings, t.created_at, t.updated_at, t.deleted_at,
			p.code as plan_code, p.name as plan_name
		FROM tenants t
		LEFT JOIN plans p ON t.plan_id = p.id
		WHERE t.deleted_at IS NULL
		ORDER BY t.created_at DESC
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
			&t.ID, &t.Name, &t.CompanyName, &t.Slug, &t.Domain, &t.Status, &t.PlanID, &t.BillingStatus, 
			&t.TrialEndsAt, &t.Settings, &t.CreatedAt, &t.UpdatedAt, &t.DeletedAt,
			&t.PlanCode, &t.PlanName,
		)
		if err != nil {
			return nil, err
		}
		tenants = append(tenants, &t)
	}
	return tenants, nil
}

// Delete soft-deletes a tenant and mangles the slug to free it up
func (r *TenantRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// We mangle the slug by appending the timestamp so the original slug can be reused
	query := `
		UPDATE tenants 
		SET deleted_at = NOW(), 
		    status = 'deleted',
		    slug = slug || '_del_' || EXTRACT(EPOCH FROM NOW())::TEXT
		WHERE id = $1 AND deleted_at IS NULL`
	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrTenantNotFound
	}
	return nil
}

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
