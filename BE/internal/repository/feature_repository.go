package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/feature"
)

var (
	ErrFeatureToggleNotFound = errors.New("feature toggle not found")
)

// FeatureRepository handles feature toggle database operations
type FeatureRepository struct {
	db *pgxpool.Pool
}

// NewFeatureRepository creates a new feature repository
func NewFeatureRepository(db *pgxpool.Pool) *FeatureRepository {
	return &FeatureRepository{db: db}
}

// Create creates a new feature toggle
func (r *FeatureRepository) Create(ctx context.Context, t *feature.Toggle) error {
	query := `
		INSERT INTO feature_toggles (id, code, name, description, tenant_id, is_enabled, conditions, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.db.Exec(ctx, query,
		t.ID, t.Code, t.Name, t.Description, t.TenantID, t.IsEnabled, t.Conditions, t.CreatedAt, t.UpdatedAt,
	)
	return err
}

// GetByID retrieves a feature toggle by ID
func (r *FeatureRepository) GetByID(ctx context.Context, id uuid.UUID) (*feature.Toggle, error) {
	query := `
		SELECT id, code, name, description, tenant_id, is_enabled, conditions, created_at, updated_at
		FROM feature_toggles
		WHERE id = $1
	`
	var t feature.Toggle
	err := r.db.QueryRow(ctx, query, id).Scan(
		&t.ID, &t.Code, &t.Name, &t.Description, &t.TenantID, &t.IsEnabled, &t.Conditions, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFeatureToggleNotFound
		}
		return nil, err
	}
	return &t, nil
}

// GetGlobalToggle retrieves a global feature toggle by code
func (r *FeatureRepository) GetGlobalToggle(ctx context.Context, code string) (*feature.Toggle, error) {
	query := `
		SELECT id, code, name, description, tenant_id, is_enabled, conditions, created_at, updated_at
		FROM feature_toggles
		WHERE code = $1 AND tenant_id IS NULL
	`
	var t feature.Toggle
	err := r.db.QueryRow(ctx, query, code).Scan(
		&t.ID, &t.Code, &t.Name, &t.Description, &t.TenantID, &t.IsEnabled, &t.Conditions, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFeatureToggleNotFound
		}
		return nil, err
	}
	return &t, nil
}

// GetTenantToggle retrieves a tenant-specific feature toggle by code
func (r *FeatureRepository) GetTenantToggle(ctx context.Context, tenantID uuid.UUID, code string) (*feature.Toggle, error) {
	query := `
		SELECT id, code, name, description, tenant_id, is_enabled, conditions, created_at, updated_at
		FROM feature_toggles
		WHERE code = $1 AND tenant_id = $2
	`
	var t feature.Toggle
	err := r.db.QueryRow(ctx, query, code, tenantID).Scan(
		&t.ID, &t.Code, &t.Name, &t.Description, &t.TenantID, &t.IsEnabled, &t.Conditions, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFeatureToggleNotFound
		}
		return nil, err
	}
	return &t, nil
}

// ListGlobalToggles retrieves all global feature toggles
func (r *FeatureRepository) ListGlobalToggles(ctx context.Context) ([]*feature.Toggle, error) {
	query := `
		SELECT id, code, name, description, tenant_id, is_enabled, conditions, created_at, updated_at
		FROM feature_toggles
		WHERE tenant_id IS NULL
		ORDER BY code ASC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var toggles []*feature.Toggle
	for rows.Next() {
		var t feature.Toggle
		if err := rows.Scan(
			&t.ID, &t.Code, &t.Name, &t.Description, &t.TenantID, &t.IsEnabled, &t.Conditions, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}
		toggles = append(toggles, &t)
	}

	return toggles, nil
}

// ListTenantToggles retrieves all tenant-specific feature toggles
func (r *FeatureRepository) ListTenantToggles(ctx context.Context, tenantID uuid.UUID) ([]*feature.Toggle, error) {
	query := `
		SELECT id, code, name, description, tenant_id, is_enabled, conditions, created_at, updated_at
		FROM feature_toggles
		WHERE tenant_id = $1
		ORDER BY code ASC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var toggles []*feature.Toggle
	for rows.Next() {
		var t feature.Toggle
		if err := rows.Scan(
			&t.ID, &t.Code, &t.Name, &t.Description, &t.TenantID, &t.IsEnabled, &t.Conditions, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}
		toggles = append(toggles, &t)
	}

	return toggles, nil
}

// Update updates a feature toggle
func (r *FeatureRepository) Update(ctx context.Context, t *feature.Toggle) error {
	query := `
		UPDATE feature_toggles
		SET name = $2, description = $3, is_enabled = $4, conditions = $5, updated_at = NOW()
		WHERE id = $1
	`
	result, err := r.db.Exec(ctx, query,
		t.ID, t.Name, t.Description, t.IsEnabled, t.Conditions,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrFeatureToggleNotFound
	}
	return nil
}

// SetToggleState enables or disables a feature toggle
func (r *FeatureRepository) SetToggleState(ctx context.Context, id uuid.UUID, enabled bool) error {
	query := `UPDATE feature_toggles SET is_enabled = $2, updated_at = NOW() WHERE id = $1`
	result, err := r.db.Exec(ctx, query, id, enabled)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrFeatureToggleNotFound
	}
	return nil
}

// Delete deletes a feature toggle
func (r *FeatureRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.db.Exec(ctx, `DELETE FROM feature_toggles WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrFeatureToggleNotFound
	}
	return nil
}

// UpsertTenantToggle creates or updates a tenant-specific toggle
func (r *FeatureRepository) UpsertTenantToggle(ctx context.Context, tenantID uuid.UUID, code string, enabled bool) error {
	query := `
		INSERT INTO feature_toggles (id, code, name, tenant_id, is_enabled, created_at, updated_at)
		VALUES ($1, $2, $2, $3, $4, NOW(), NOW())
		ON CONFLICT (code, tenant_id) DO UPDATE SET is_enabled = $4, updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, uuid.New(), code, tenantID, enabled)
	return err
}


