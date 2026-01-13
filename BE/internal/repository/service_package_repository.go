package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/service_package"
)

var (
	ErrServicePackageNotFound  = errors.New("service package not found")
	ErrServicePackageNameTaken = errors.New("service package name already taken")
)

type ServicePackageRepository struct {
	db *pgxpool.Pool
}

func NewServicePackageRepository(db *pgxpool.Pool) *ServicePackageRepository {
	return &ServicePackageRepository{db: db}
}

func (r *ServicePackageRepository) Create(ctx context.Context, p *service_package.ServicePackage) error {
	query := `
		INSERT INTO service_packages (
			id, tenant_id, name, category, pricing_model,
			price_monthly, price_per_device, billing_day_default,
			network_profile_id, is_active, metadata,
			created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
	`
	_, err := r.db.Exec(ctx, query,
		p.ID, p.TenantID, p.Name, p.Category, p.PricingModel,
		p.PriceMonthly, p.PricePerDevice, p.BillingDayDefault,
		p.NetworkProfileID, p.IsActive, p.Metadata,
		p.CreatedAt, p.UpdatedAt,
	)
	return err
}

func (r *ServicePackageRepository) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*service_package.ServicePackage, error) {
	query := `
		SELECT id, tenant_id, name, category, pricing_model,
		       price_monthly, price_per_device, billing_day_default,
		       network_profile_id, is_active, metadata,
		       created_at, updated_at, deleted_at
		FROM service_packages
		WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
	`
	var p service_package.ServicePackage
	err := r.db.QueryRow(ctx, query, id, tenantID).Scan(
		&p.ID, &p.TenantID, &p.Name, &p.Category, &p.PricingModel,
		&p.PriceMonthly, &p.PricePerDevice, &p.BillingDayDefault,
		&p.NetworkProfileID, &p.IsActive, &p.Metadata,
		&p.CreatedAt, &p.UpdatedAt, &p.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrServicePackageNotFound
		}
		return nil, err
	}
	return &p, nil
}

func (r *ServicePackageRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID, activeOnly bool, category *service_package.Category) ([]*service_package.ServicePackage, error) {
	query := `
		SELECT id, tenant_id, name, category, pricing_model,
		       price_monthly, price_per_device, billing_day_default,
		       network_profile_id, is_active, metadata,
		       created_at, updated_at, deleted_at
		FROM service_packages
		WHERE tenant_id = $1 AND deleted_at IS NULL
	`
	args := []interface{}{tenantID}
	argNum := 2

	if activeOnly {
		query += ` AND is_active = true`
	}
	if category != nil && *category != "" {
		query += ` AND category = $2`
		args = append(args, *category)
		argNum++
		_ = argNum // keep pattern consistent if extended later
	}
	query += ` ORDER BY name ASC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*service_package.ServicePackage
	for rows.Next() {
		var p service_package.ServicePackage
		if err := rows.Scan(
			&p.ID, &p.TenantID, &p.Name, &p.Category, &p.PricingModel,
			&p.PriceMonthly, &p.PricePerDevice, &p.BillingDayDefault,
			&p.NetworkProfileID, &p.IsActive, &p.Metadata,
			&p.CreatedAt, &p.UpdatedAt, &p.DeletedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, &p)
	}
	return out, nil
}

func (r *ServicePackageRepository) Update(ctx context.Context, p *service_package.ServicePackage) error {
	query := `
		UPDATE service_packages
		SET name = $3,
		    category = $4,
		    pricing_model = $5,
		    price_monthly = $6,
		    price_per_device = $7,
		    billing_day_default = $8,
		    network_profile_id = $9,
		    is_active = $10,
		    metadata = $11,
		    updated_at = NOW()
		WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
	`
	res, err := r.db.Exec(ctx, query,
		p.ID, p.TenantID,
		p.Name, p.Category, p.PricingModel,
		p.PriceMonthly, p.PricePerDevice, p.BillingDayDefault,
		p.NetworkProfileID, p.IsActive, p.Metadata,
	)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrServicePackageNotFound
	}
	return nil
}

func (r *ServicePackageRepository) SoftDelete(ctx context.Context, tenantID, id uuid.UUID) error {
	query := `UPDATE service_packages SET deleted_at = $3, updated_at = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`
	now := time.Now()
	res, err := r.db.Exec(ctx, query, id, tenantID, now)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrServicePackageNotFound
	}
	return nil
}

func (r *ServicePackageRepository) NameExists(ctx context.Context, tenantID uuid.UUID, name string, excludeID *uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM service_packages WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL`
	args := []interface{}{tenantID, name}
	if excludeID != nil {
		query += ` AND id != $3`
		args = append(args, *excludeID)
	}
	query += `)`
	var exists bool
	if err := r.db.QueryRow(ctx, query, args...).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}


