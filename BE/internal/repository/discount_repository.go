package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/discount"
)

var (
	ErrDiscountNotFound  = errors.New("discount not found")
	ErrDiscountNameTaken = errors.New("discount name already taken")
)

// DiscountRepository handles discount database operations
type DiscountRepository struct {
	db *pgxpool.Pool
}

// NewDiscountRepository creates a new discount repository
func NewDiscountRepository(db *pgxpool.Pool) *DiscountRepository {
	return &DiscountRepository{db: db}
}

// Create creates a new discount
func (r *DiscountRepository) Create(ctx context.Context, d *discount.Discount) error {
	query := `
		INSERT INTO discounts (
			id, tenant_id, name, description, type, value, expires_at, is_active,
			created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.Exec(ctx, query,
		d.ID, d.TenantID, d.Name, d.Description, d.Type, d.Value, d.ExpiresAt, d.IsActive,
		d.CreatedAt, d.UpdatedAt,
	)
	return err
}

// GetByID retrieves a discount by ID (tenant-scoped)
func (r *DiscountRepository) GetByID(ctx context.Context, discountID, tenantID uuid.UUID) (*discount.Discount, error) {
	query := `
		SELECT id, tenant_id, name, description, type, value, expires_at, is_active,
			   created_at, updated_at, deleted_at
		FROM discounts
		WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
	`
	return r.scanDiscount(r.db.QueryRow(ctx, query, discountID, tenantID))
}

// List retrieves discounts with filters (tenant-scoped)
func (r *DiscountRepository) List(ctx context.Context, tenantID uuid.UUID, includeInactive bool) ([]*discount.Discount, error) {
	query := `
		SELECT id, tenant_id, name, description, type, value, expires_at, is_active,
			   created_at, updated_at, deleted_at
		FROM discounts
		WHERE tenant_id = $1 AND deleted_at IS NULL
	`
	args := []interface{}{tenantID}

	if !includeInactive {
		query += ` AND is_active = true`
	}

	query += ` ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var discounts []*discount.Discount
	for rows.Next() {
		d, err := r.scanDiscountFromRows(rows)
		if err != nil {
			return nil, err
		}
		discounts = append(discounts, d)
	}

	return discounts, nil
}

// ListValid retrieves only valid (active, not expired) discounts
func (r *DiscountRepository) ListValid(ctx context.Context, tenantID uuid.UUID) ([]*discount.Discount, error) {
	query := `
		SELECT id, tenant_id, name, description, type, value, expires_at, is_active,
			   created_at, updated_at, deleted_at
		FROM discounts
		WHERE tenant_id = $1 
		  AND deleted_at IS NULL
		  AND is_active = true
		  AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var discounts []*discount.Discount
	for rows.Next() {
		d, err := r.scanDiscountFromRows(rows)
		if err != nil {
			return nil, err
		}
		discounts = append(discounts, d)
	}

	return discounts, nil
}

// Update updates a discount
func (r *DiscountRepository) Update(ctx context.Context, d *discount.Discount) error {
	query := `
		UPDATE discounts
		SET name = $3, description = $4, type = $5, value = $6, expires_at = $7,
		    is_active = $8, updated_at = $9
		WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
	`
	result, err := r.db.Exec(ctx, query,
		d.ID, d.TenantID, d.Name, d.Description, d.Type, d.Value, d.ExpiresAt,
		d.IsActive, d.UpdatedAt,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrDiscountNotFound
	}
	return nil
}

// Delete soft deletes a discount
func (r *DiscountRepository) Delete(ctx context.Context, discountID, tenantID uuid.UUID) error {
	query := `
		UPDATE discounts
		SET deleted_at = NOW()
		WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
	`
	result, err := r.db.Exec(ctx, query, discountID, tenantID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrDiscountNotFound
	}
	return nil
}

// NameExists checks if a discount name is already taken in a tenant
func (r *DiscountRepository) NameExists(ctx context.Context, tenantID uuid.UUID, name string, excludeID *uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM discounts WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL`
	args := []interface{}{tenantID, name}

	if excludeID != nil {
		query += ` AND id != $3`
		args = append(args, *excludeID)
	}
	query += `)`

	var exists bool
	err := r.db.QueryRow(ctx, query, args...).Scan(&exists)
	return exists, err
}

// scanDiscount scans a single row into a Discount
func (r *DiscountRepository) scanDiscount(row pgx.Row) (*discount.Discount, error) {
	var d discount.Discount
	err := row.Scan(
		&d.ID, &d.TenantID, &d.Name, &d.Description, &d.Type, &d.Value, &d.ExpiresAt,
		&d.IsActive, &d.CreatedAt, &d.UpdatedAt, &d.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrDiscountNotFound
		}
		return nil, err
	}
	return &d, nil
}

// scanDiscountFromRows scans rows into a Discount
func (r *DiscountRepository) scanDiscountFromRows(rows pgx.Rows) (*discount.Discount, error) {
	var d discount.Discount
	err := rows.Scan(
		&d.ID, &d.TenantID, &d.Name, &d.Description, &d.Type, &d.Value, &d.ExpiresAt,
		&d.IsActive, &d.CreatedAt, &d.UpdatedAt, &d.DeletedAt,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}
