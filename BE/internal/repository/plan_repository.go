package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/plan"
)

var (
	ErrPlanNotFound   = errors.New("plan not found")
	ErrPlanCodeTaken  = errors.New("plan code already taken")
)

// PlanRepository handles plan database operations
type PlanRepository struct {
	db *pgxpool.Pool
}

// NewPlanRepository creates a new plan repository
func NewPlanRepository(db *pgxpool.Pool) *PlanRepository {
	return &PlanRepository{db: db}
}

// Create creates a new plan
func (r *PlanRepository) Create(ctx context.Context, p *plan.Plan) error {
	query := `
		INSERT INTO plans (id, code, name, description, price_monthly, price_yearly, currency, limits, features, is_active, is_public, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`
	_, err := r.db.Exec(ctx, query,
		p.ID, p.Code, p.Name, p.Description, p.PriceMonthly, p.PriceYearly, p.Currency, p.Limits, p.Features, p.IsActive, p.IsPublic, p.SortOrder, p.CreatedAt, p.UpdatedAt,
	)
	return err
}

// GetByID retrieves a plan by ID
func (r *PlanRepository) GetByID(ctx context.Context, id uuid.UUID) (*plan.Plan, error) {
	query := `
		SELECT id, code, name, description, price_monthly, price_yearly, currency, limits, features, is_active, is_public, sort_order, created_at, updated_at
		FROM plans
		WHERE id = $1
	`
	var p plan.Plan
	err := r.db.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.Code, &p.Name, &p.Description, &p.PriceMonthly, &p.PriceYearly, &p.Currency, &p.Limits, &p.Features, &p.IsActive, &p.IsPublic, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPlanNotFound
		}
		return nil, err
	}
	return &p, nil
}

// GetByCode retrieves a plan by code
func (r *PlanRepository) GetByCode(ctx context.Context, code string) (*plan.Plan, error) {
	query := `
		SELECT id, code, name, description, price_monthly, price_yearly, currency, limits, features, is_active, is_public, sort_order, created_at, updated_at
		FROM plans
		WHERE code = $1
	`
	var p plan.Plan
	err := r.db.QueryRow(ctx, query, code).Scan(
		&p.ID, &p.Code, &p.Name, &p.Description, &p.PriceMonthly, &p.PriceYearly, &p.Currency, &p.Limits, &p.Features, &p.IsActive, &p.IsPublic, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPlanNotFound
		}
		return nil, err
	}
	return &p, nil
}

// ListAll retrieves all plans (for super admin)
func (r *PlanRepository) ListAll(ctx context.Context) ([]*plan.Plan, error) {
	return r.List(ctx, false, false)
}

// List retrieves all plans with optional filters
func (r *PlanRepository) List(ctx context.Context, activeOnly bool, publicOnly bool) ([]*plan.Plan, error) {
	query := `
		SELECT id, code, name, description, price_monthly, price_yearly, currency, limits, features, is_active, is_public, sort_order, created_at, updated_at
		FROM plans
		WHERE 1=1
	`
	args := []interface{}{}
	argNum := 1

	if activeOnly {
		query += ` AND is_active = $` + string(rune('0'+argNum))
		args = append(args, true)
		argNum++
	}
	if publicOnly {
		query += ` AND is_public = $` + string(rune('0'+argNum))
		args = append(args, true)
	}
	query += ` ORDER BY sort_order ASC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var plans []*plan.Plan
	for rows.Next() {
		var p plan.Plan
		if err := rows.Scan(
			&p.ID, &p.Code, &p.Name, &p.Description, &p.PriceMonthly, &p.PriceYearly, &p.Currency, &p.Limits, &p.Features, &p.IsActive, &p.IsPublic, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		plans = append(plans, &p)
	}

	return plans, nil
}

// Update updates a plan
func (r *PlanRepository) Update(ctx context.Context, p *plan.Plan) error {
	query := `
		UPDATE plans
		SET name = $2, description = $3, price_monthly = $4, price_yearly = $5, currency = $6, limits = $7, features = $8, is_active = $9, is_public = $10, sort_order = $11, updated_at = NOW()
		WHERE id = $1
	`
	result, err := r.db.Exec(ctx, query,
		p.ID, p.Name, p.Description, p.PriceMonthly, p.PriceYearly, p.Currency, p.Limits, p.Features, p.IsActive, p.IsPublic, p.SortOrder,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrPlanNotFound
	}
	return nil
}

// Delete deletes a plan
func (r *PlanRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.db.Exec(ctx, `DELETE FROM plans WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrPlanNotFound
	}
	return nil
}

// CodeExists checks if a plan code is already taken
func (r *PlanRepository) CodeExists(ctx context.Context, code string, excludeID *uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM plans WHERE code = $1`
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

// GetTenantPlan retrieves the plan assigned to a tenant
func (r *PlanRepository) GetTenantPlan(ctx context.Context, tenantID uuid.UUID) (*plan.Plan, error) {
	query := `
		SELECT p.id, p.code, p.name, p.description, p.price_monthly, p.price_yearly, p.currency, p.limits, p.features, p.is_active, p.is_public, p.sort_order, p.created_at, p.updated_at
		FROM plans p
		INNER JOIN tenants t ON t.plan_id = p.id
		WHERE t.id = $1 AND t.deleted_at IS NULL
	`
	var p plan.Plan
	err := r.db.QueryRow(ctx, query, tenantID).Scan(
		&p.ID, &p.Code, &p.Name, &p.Description, &p.PriceMonthly, &p.PriceYearly, &p.Currency, &p.Limits, &p.Features, &p.IsActive, &p.IsPublic, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPlanNotFound
		}
		return nil, err
	}
	return &p, nil
}

// AssignPlanToTenant assigns a plan to a tenant
func (r *PlanRepository) AssignPlanToTenant(ctx context.Context, tenantID, planID uuid.UUID) error {
	query := `UPDATE tenants SET plan_id = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`
	result, err := r.db.Exec(ctx, query, tenantID, planID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrTenantNotFound
	}
	return nil
}


