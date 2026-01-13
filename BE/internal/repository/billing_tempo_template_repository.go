package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/billing"
)

var (
	ErrTempoTemplateNotFound  = errors.New("tempo template not found")
	ErrTempoTemplateNameTaken = errors.New("tempo template name already taken")
)

type BillingTempoTemplateRepository struct {
	db *pgxpool.Pool
}

func NewBillingTempoTemplateRepository(db *pgxpool.Pool) *BillingTempoTemplateRepository {
	return &BillingTempoTemplateRepository{db: db}
}

func (r *BillingTempoTemplateRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*billing.TempoTemplate, error) {
	query := `
		SELECT id, tenant_id, name, due_day, description, created_at, updated_at
		FROM billing_tempo_templates
		WHERE tenant_id = $1
		ORDER BY name ASC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*billing.TempoTemplate
	for rows.Next() {
		var t billing.TempoTemplate
		if err := rows.Scan(&t.ID, &t.TenantID, &t.Name, &t.DueDay, &t.Description, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, &t)
	}
	return out, nil
}

func (r *BillingTempoTemplateRepository) Create(ctx context.Context, t *billing.TempoTemplate) error {
	query := `
		INSERT INTO billing_tempo_templates (id, tenant_id, name, due_day, description, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`
	_, err := r.db.Exec(ctx, query, t.ID, t.TenantID, t.Name, t.DueDay, t.Description, t.CreatedAt, t.UpdatedAt)
	return err
}

func (r *BillingTempoTemplateRepository) Update(ctx context.Context, t *billing.TempoTemplate) error {
	query := `
		UPDATE billing_tempo_templates
		SET name = $3,
		    due_day = $4,
		    description = $5,
		    updated_at = $6
		WHERE id = $1 AND tenant_id = $2
	`
	res, err := r.db.Exec(ctx, query, t.ID, t.TenantID, t.Name, t.DueDay, t.Description, t.UpdatedAt)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrTempoTemplateNotFound
	}
	return nil
}

func (r *BillingTempoTemplateRepository) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	query := `DELETE FROM billing_tempo_templates WHERE id = $1 AND tenant_id = $2`
	res, err := r.db.Exec(ctx, query, id, tenantID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrTempoTemplateNotFound
	}
	return nil
}

func (r *BillingTempoTemplateRepository) NameExists(ctx context.Context, tenantID uuid.UUID, name string, excludeID *uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM billing_tempo_templates WHERE tenant_id = $1 AND name = $2`
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


