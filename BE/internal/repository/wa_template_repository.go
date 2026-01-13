package repository

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/wa_template"
)

var (
	ErrWATemplateNotFound  = errors.New("wa template not found")
	ErrWATemplateNameTaken = errors.New("wa template name already taken")
)

type WATemplateRepository struct {
	db *pgxpool.Pool
}

func NewWATemplateRepository(db *pgxpool.Pool) *WATemplateRepository {
	return &WATemplateRepository{db: db}
}

func (r *WATemplateRepository) List(ctx context.Context, tenantID uuid.UUID, limit int) ([]*wa_template.Template, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	q := `
		SELECT id, tenant_id, name, content, created_at, updated_at
		FROM wa_templates
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := r.db.Query(ctx, q, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*wa_template.Template
	for rows.Next() {
		var t wa_template.Template
		if err := rows.Scan(&t.ID, &t.TenantID, &t.Name, &t.Content, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, &t)
	}
	return out, nil
}

func (r *WATemplateRepository) Get(ctx context.Context, tenantID, id uuid.UUID) (*wa_template.Template, error) {
	q := `
		SELECT id, tenant_id, name, content, created_at, updated_at
		FROM wa_templates
		WHERE id = $1 AND tenant_id = $2
	`
	var t wa_template.Template
	if err := r.db.QueryRow(ctx, q, id, tenantID).Scan(&t.ID, &t.TenantID, &t.Name, &t.Content, &t.CreatedAt, &t.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrWATemplateNotFound
		}
		return nil, err
	}
	return &t, nil
}

func (r *WATemplateRepository) Create(ctx context.Context, tenantID uuid.UUID, name, content string) (*wa_template.Template, error) {
	q := `
		INSERT INTO wa_templates (tenant_id, name, content)
		VALUES ($1,$2,$3)
		RETURNING id, tenant_id, name, content, created_at, updated_at
	`
	var t wa_template.Template
	if err := r.db.QueryRow(ctx, q, tenantID, name, content).Scan(&t.ID, &t.TenantID, &t.Name, &t.Content, &t.CreatedAt, &t.UpdatedAt); err != nil {
		// best-effort unique detection (constraint name set by migration)
		if isUniqueConstraintViolation(err, "uq_wa_templates_tenant_name") {
			return nil, ErrWATemplateNameTaken
		}
		return nil, err
	}
	return &t, nil
}

func (r *WATemplateRepository) Update(ctx context.Context, tenantID, id uuid.UUID, name, content string) (*wa_template.Template, error) {
	q := `
		UPDATE wa_templates
		SET name = $3, content = $4, updated_at = NOW()
		WHERE id = $1 AND tenant_id = $2
		RETURNING id, tenant_id, name, content, created_at, updated_at
	`
	var t wa_template.Template
	if err := r.db.QueryRow(ctx, q, id, tenantID, name, content).Scan(&t.ID, &t.TenantID, &t.Name, &t.Content, &t.CreatedAt, &t.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrWATemplateNotFound
		}
		if isUniqueConstraintViolation(err, "uq_wa_templates_tenant_name") {
			return nil, ErrWATemplateNameTaken
		}
		return nil, err
	}
	return &t, nil
}

func (r *WATemplateRepository) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	q := `DELETE FROM wa_templates WHERE id = $1 AND tenant_id = $2`
	ct, err := r.db.Exec(ctx, q, id, tenantID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrWATemplateNotFound
	}
	return nil
}

// isUniqueConstraintViolation detects a unique constraint violation by name (best-effort).
func isUniqueConstraintViolation(err error, constraintName string) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	if !strings.Contains(msg, "duplicate key value violates unique constraint") {
		return false
	}
	if constraintName == "" {
		return true
	}
	return strings.Contains(msg, constraintName)
}


