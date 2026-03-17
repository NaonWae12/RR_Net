package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/billing"
)

type PlatformDiscountRepository struct {
	db *pgxpool.Pool
}

func NewPlatformDiscountRepository(db *pgxpool.Pool) *PlatformDiscountRepository {
	return &PlatformDiscountRepository{db: db}
}

func (r *PlatformDiscountRepository) Create(ctx context.Context, d *billing.PlatformDiscount) error {
	query := `
		INSERT INTO platform_discounts (
			id, code, name, description, type, value, 
			min_purchase, max_discount, usage_limit, used_count,
			expires_at, is_active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`
	_, err := r.db.Exec(ctx, query,
		d.ID, d.Code, d.Name, d.Description, d.Type, d.Value,
		d.MinPurchase, d.MaxDiscount, d.UsageLimit, d.UsedCount,
		d.ExpiresAt, d.IsActive, d.CreatedAt, d.UpdatedAt,
	)
	return err
}

func (r *PlatformDiscountRepository) GetByID(ctx context.Context, id uuid.UUID) (*billing.PlatformDiscount, error) {
	query := `
		SELECT 
			id, code, name, description, type, value, 
			min_purchase, max_discount, usage_limit, used_count,
			expires_at, is_active, created_at, updated_at, deleted_at
		FROM platform_discounts
		WHERE id = $1 AND deleted_at IS NULL
	`
	var d billing.PlatformDiscount
	err := r.db.QueryRow(ctx, query, id).Scan(
		&d.ID, &d.Code, &d.Name, &d.Description, &d.Type, &d.Value,
		&d.MinPurchase, &d.MaxDiscount, &d.UsageLimit, &d.UsedCount,
		&d.ExpiresAt, &d.IsActive, &d.CreatedAt, &d.UpdatedAt, &d.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("platform discount not found")
		}
		return nil, err
	}
	return &d, nil
}

func (r *PlatformDiscountRepository) GetByCode(ctx context.Context, code string) (*billing.PlatformDiscount, error) {
	query := `
		SELECT 
			id, code, name, description, type, value, 
			min_purchase, max_discount, usage_limit, used_count,
			expires_at, is_active, created_at, updated_at, deleted_at
		FROM platform_discounts
		WHERE code = $1 AND deleted_at IS NULL
	`
	var d billing.PlatformDiscount
	err := r.db.QueryRow(ctx, query, code).Scan(
		&d.ID, &d.Code, &d.Name, &d.Description, &d.Type, &d.Value,
		&d.MinPurchase, &d.MaxDiscount, &d.UsageLimit, &d.UsedCount,
		&d.ExpiresAt, &d.IsActive, &d.CreatedAt, &d.UpdatedAt, &d.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("invalid discount code")
		}
		return nil, err
	}
	return &d, nil
}

func (r *PlatformDiscountRepository) List(ctx context.Context, includeInactive bool) ([]*billing.PlatformDiscount, error) {
	query := `
		SELECT 
			id, code, name, description, type, value, 
			min_purchase, max_discount, usage_limit, used_count,
			expires_at, is_active, created_at, updated_at, deleted_at
		FROM platform_discounts
		WHERE deleted_at IS NULL
	`
	if !includeInactive {
		query += " AND is_active = true"
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var discounts []*billing.PlatformDiscount
	for rows.Next() {
		var d billing.PlatformDiscount
		err := rows.Scan(
			&d.ID, &d.Code, &d.Name, &d.Description, &d.Type, &d.Value,
			&d.MinPurchase, &d.MaxDiscount, &d.UsageLimit, &d.UsedCount,
			&d.ExpiresAt, &d.IsActive, &d.CreatedAt, &d.UpdatedAt, &d.DeletedAt,
		)
		if err != nil {
			return nil, err
		}
		discounts = append(discounts, &d)
	}
	return discounts, nil
}

func (r *PlatformDiscountRepository) Update(ctx context.Context, d *billing.PlatformDiscount) error {
	query := `
		UPDATE platform_discounts 
		SET code = $2, name = $3, description = $4, type = $5, value = $6,
			min_purchase = $7, max_discount = $8, usage_limit = $9, used_count = $10,
			expires_at = $11, is_active = $12, updated_at = $13
		WHERE id = $1 AND deleted_at IS NULL
	`
	_, err := r.db.Exec(ctx, query,
		d.ID, d.Code, d.Name, d.Description, d.Type, d.Value,
		d.MinPurchase, d.MaxDiscount, d.UsageLimit, d.UsedCount,
		d.ExpiresAt, d.IsActive, d.UpdatedAt,
	)
	return err
}

func (r *PlatformDiscountRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE platform_discounts SET deleted_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *PlatformDiscountRepository) IncrementUsedCount(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE platform_discounts SET used_count = used_count + 1 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *PlatformDiscountRepository) CodeExists(ctx context.Context, code string, excludeID *uuid.UUID) (bool, error) {
	var query string
	var args []interface{}
	if excludeID != nil {
		query = "SELECT EXISTS(SELECT 1 FROM platform_discounts WHERE code = $1 AND id != $2 AND deleted_at IS NULL)"
		args = []interface{}{code, *excludeID}
	} else {
		query = "SELECT EXISTS(SELECT 1 FROM platform_discounts WHERE code = $1 AND deleted_at IS NULL)"
		args = []interface{}{code}
	}

	var exists bool
	err := r.db.QueryRow(ctx, query, args...).Scan(&exists)
	return exists, err
}
