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
	ErrPlanNotFound  = errors.New("plan not found")
	ErrPlanCodeTaken = errors.New("plan code already taken")
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
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `
		INSERT INTO plans (id, code, name, description, price_monthly, price_yearly, currency, limits, features, hidden_features, is_active, is_public, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`
	_, err = tx.Exec(ctx, query,
		p.ID, p.Code, p.Name, p.Description, p.PriceMonthly, p.PriceYearly, p.Currency, p.Limits, p.Features, p.HiddenFeatures, p.IsActive, p.IsPublic, p.SortOrder, p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		return err
	}

	// Save relational data
	if len(p.FeaturesList) > 0 {
		if err := r.saveFeatures(ctx, tx, p.ID, p.FeaturesList); err != nil {
			return err
		}
	}
	if len(p.LimitsMap) > 0 {
		if err := r.saveLimits(ctx, tx, p.ID, p.LimitsMap); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *PlanRepository) GetByID(ctx context.Context, id uuid.UUID) (*plan.Plan, error) {
	query := `
		SELECT id, code, name, description, price_monthly, price_yearly, currency, limits, features, hidden_features, is_active, is_public, sort_order, created_at, updated_at
		FROM plans
		WHERE id = $1
	`
	var p plan.Plan
	err := r.db.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.Code, &p.Name, &p.Description, &p.PriceMonthly, &p.PriceYearly, &p.Currency, &p.Limits, &p.Features, &p.HiddenFeatures, &p.IsActive, &p.IsPublic, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPlanNotFound
		}
		return nil, err
	}

	// Fetch relational data
	p.FeaturesList, _ = r.fetchFeatures(ctx, p.ID)
	p.LimitsMap, _ = r.fetchLimits(ctx, p.ID)

	return &p, nil
}

func (r *PlanRepository) GetByCode(ctx context.Context, code string) (*plan.Plan, error) {
	query := `
		SELECT id, code, name, description, price_monthly, price_yearly, currency, limits, features, hidden_features, is_active, is_public, sort_order, created_at, updated_at
		FROM plans
		WHERE code = $1
	`
	var p plan.Plan
	err := r.db.QueryRow(ctx, query, code).Scan(
		&p.ID, &p.Code, &p.Name, &p.Description, &p.PriceMonthly, &p.PriceYearly, &p.Currency, &p.Limits, &p.Features, &p.HiddenFeatures, &p.IsActive, &p.IsPublic, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPlanNotFound
		}
		return nil, err
	}

	// Fetch relational data
	p.FeaturesList, _ = r.fetchFeatures(ctx, p.ID)
	p.LimitsMap, _ = r.fetchLimits(ctx, p.ID)

	return &p, nil
}

// ListAll retrieves all plans (for super admin)
func (r *PlanRepository) ListAll(ctx context.Context) ([]*plan.Plan, error) {
	return r.List(ctx, false, false)
}

// List retrieves all plans with optional filters
func (r *PlanRepository) List(ctx context.Context, activeOnly bool, publicOnly bool) ([]*plan.Plan, error) {
	query := `
		SELECT id, code, name, description, price_monthly, price_yearly, currency, limits, features, hidden_features, is_active, is_public, sort_order, created_at, updated_at
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

	plans := []*plan.Plan{}
	planIDs := []uuid.UUID{}
	planMap := make(map[uuid.UUID]*plan.Plan)

	for rows.Next() {
		var p plan.Plan
		if err := rows.Scan(
			&p.ID, &p.Code, &p.Name, &p.Description, &p.PriceMonthly, &p.PriceYearly, &p.Currency, &p.Limits, &p.Features, &p.HiddenFeatures, &p.IsActive, &p.IsPublic, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		p.FeaturesList = []string{}
		p.LimitsMap = make(map[string]int)
		plans = append(plans, &p)
		planIDs = append(planIDs, p.ID)
		planMap[p.ID] = &p
	}

	if len(planIDs) > 0 {
		// Fetch all features for these plans
		fRows, err := r.db.Query(ctx, `SELECT plan_id, feature_code FROM plan_features WHERE plan_id = ANY($1)`, planIDs)
		if err == nil {
			defer fRows.Close()
			for fRows.Next() {
				var pid uuid.UUID
				var f string
				if err := fRows.Scan(&pid, &f); err == nil {
					if p, ok := planMap[pid]; ok {
						p.FeaturesList = append(p.FeaturesList, f)
					}
				}
			}
		}

		// Fetch all limits for these plans
		lRows, err := r.db.Query(ctx, `SELECT plan_id, limit_name, limit_value FROM plan_limits WHERE plan_id = ANY($1)`, planIDs)
		if err == nil {
			defer lRows.Close()
			for lRows.Next() {
				var pid uuid.UUID
				var name string
				var val int
				if err := lRows.Scan(&pid, &name, &val); err == nil {
					if p, ok := planMap[pid]; ok {
						p.LimitsMap[name] = val
					}
				}
			}
		}
	}

	return plans, nil
}

func (r *PlanRepository) Update(ctx context.Context, p *plan.Plan) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `
		UPDATE plans
		SET name = $2, description = $3, price_monthly = $4, price_yearly = $5, currency = $6, limits = $7, features = $8, hidden_features = $9, is_active = $10, is_public = $11, sort_order = $12, updated_at = NOW()
		WHERE id = $1
	`
	result, err := tx.Exec(ctx, query,
		p.ID, p.Name, p.Description, p.PriceMonthly, p.PriceYearly, p.Currency, p.Limits, p.Features, p.HiddenFeatures, p.IsActive, p.IsPublic, p.SortOrder,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrPlanNotFound
	}

	// Save relational data
	if err := r.saveFeatures(ctx, tx, p.ID, p.FeaturesList); err != nil {
		return err
	}
	if err := r.saveLimits(ctx, tx, p.ID, p.LimitsMap); err != nil {
		return err
	}

	return tx.Commit(ctx)
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

	// Fetch relational data
	p.FeaturesList, _ = r.fetchFeatures(ctx, p.ID)
	p.LimitsMap, _ = r.fetchLimits(ctx, p.ID)

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

func (r *PlanRepository) fetchFeatures(ctx context.Context, planID uuid.UUID) ([]string, error) {
	rows, err := r.db.Query(ctx, `SELECT feature_code FROM plan_features WHERE plan_id = $1`, planID)
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

func (r *PlanRepository) fetchLimits(ctx context.Context, planID uuid.UUID) (map[string]int, error) {
	rows, err := r.db.Query(ctx, `SELECT limit_name, limit_value FROM plan_limits WHERE plan_id = $1`, planID)
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

func (r *PlanRepository) saveFeatures(ctx context.Context, tx pgx.Tx, planID uuid.UUID, features []string) error {
	// Delete existing
	_, err := tx.Exec(ctx, `DELETE FROM plan_features WHERE plan_id = $1`, planID)
	if err != nil {
		return err
	}

	// Insert new
	for _, f := range features {
		_, err = tx.Exec(ctx, `INSERT INTO plan_features (plan_id, feature_code) VALUES ($1, $2)`, planID, f)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *PlanRepository) saveLimits(ctx context.Context, tx pgx.Tx, planID uuid.UUID, limits map[string]int) error {
	// Delete existing
	_, err := tx.Exec(ctx, `DELETE FROM plan_limits WHERE plan_id = $1`, planID)
	if err != nil {
		return err
	}

	// Insert new
	for name, val := range limits {
		_, err = tx.Exec(ctx, `INSERT INTO plan_limits (plan_id, limit_name, limit_value) VALUES ($1, $2, $3)`, planID, name, val)
		if err != nil {
			return err
		}
	}
	return nil
}
