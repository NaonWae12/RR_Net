package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	paymentmethod "rrnet/internal/domain/payment_method"
)

type PaymentMethodRepository struct {
	db *pgxpool.Pool
}

func NewPaymentMethodRepository(db *pgxpool.Pool) *PaymentMethodRepository {
	return &PaymentMethodRepository{db: db}
}

func (r *PaymentMethodRepository) Create(ctx context.Context, pm *paymentmethod.PaymentMethod) error {
	query := `
		INSERT INTO payment_methods (
			id, tenant_id, name, category, provider, account_number, account_name, is_active, metadata, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err := r.db.Exec(ctx, query,
		pm.ID, pm.TenantID, pm.Name, pm.Category, pm.Provider, pm.AccountNumber, pm.AccountName, pm.IsActive, pm.Metadata, pm.CreatedAt, pm.UpdatedAt,
	)
	return err
}

func (r *PaymentMethodRepository) GetByID(ctx context.Context, id uuid.UUID) (*paymentmethod.PaymentMethod, error) {
	query := `
		SELECT id, tenant_id, name, category, provider, account_number, account_name, is_active, metadata, created_at, updated_at
		FROM payment_methods
		WHERE id = $1
	`
	var pm paymentmethod.PaymentMethod
	err := r.db.QueryRow(ctx, query, id).Scan(
		&pm.ID, &pm.TenantID, &pm.Name, &pm.Category, &pm.Provider, &pm.AccountNumber, &pm.AccountName, &pm.IsActive, &pm.Metadata, &pm.CreatedAt, &pm.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("payment method not found")
	}
	return &pm, err
}

func (r *PaymentMethodRepository) ListByTenant(ctx context.Context, tenantID *uuid.UUID) ([]*paymentmethod.PaymentMethod, error) {
	var query string
	var args []interface{}

	if tenantID == nil {
		// Super admin: get platform-level payment methods (tenant_id IS NULL)
		query = `
			SELECT id, tenant_id, name, category, provider, account_number, account_name, is_active, metadata, created_at, updated_at
			FROM payment_methods
			WHERE tenant_id IS NULL
			ORDER BY created_at DESC
		`
	} else {
		// Tenant-specific payment methods
		query = `
			SELECT id, tenant_id, name, category, provider, account_number, account_name, is_active, metadata, created_at, updated_at
			FROM payment_methods
			WHERE tenant_id = $1 OR tenant_id IS NULL
			ORDER BY created_at DESC
		`
		args = append(args, *tenantID)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pms := make([]*paymentmethod.PaymentMethod, 0)
	for rows.Next() {
		var pm paymentmethod.PaymentMethod
		err := rows.Scan(
			&pm.ID, &pm.TenantID, &pm.Name, &pm.Category, &pm.Provider, &pm.AccountNumber, &pm.AccountName, &pm.IsActive, &pm.Metadata, &pm.CreatedAt, &pm.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		pms = append(pms, &pm)
	}
	return pms, nil
}

func (r *PaymentMethodRepository) Update(ctx context.Context, pm *paymentmethod.PaymentMethod) error {
	query := `
		UPDATE payment_methods
		SET name = $2, category = $3, provider = $4, account_number = $5, account_name = $6, is_active = $7, metadata = $8, updated_at = $9
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		pm.ID, pm.Name, pm.Category, pm.Provider, pm.AccountNumber, pm.AccountName, pm.IsActive, pm.Metadata, time.Now(),
	)
	return err
}

func (r *PaymentMethodRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM payment_methods WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	if err != nil {
		if pgErr, ok := err.(*pgconn.PgError); ok {
			if pgErr.Code == "23503" { // foreign_key_violation
				return fmt.Errorf("payment method is in use")
			}
		}
	}
	return err
}
