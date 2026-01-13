package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/client_group"
)

var (
	ErrClientGroupNotFound  = errors.New("client group not found")
	ErrClientGroupNameTaken = errors.New("client group name already taken")
)

type ClientGroupRepository struct {
	db *pgxpool.Pool
}

func NewClientGroupRepository(db *pgxpool.Pool) *ClientGroupRepository {
	return &ClientGroupRepository{db: db}
}

func (r *ClientGroupRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*client_group.ClientGroup, error) {
	query := `
		SELECT id, tenant_id, name, description, created_at, updated_at
		FROM client_groups
		WHERE tenant_id = $1
		ORDER BY name ASC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*client_group.ClientGroup
	for rows.Next() {
		var g client_group.ClientGroup
		if err := rows.Scan(&g.ID, &g.TenantID, &g.Name, &g.Description, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, &g)
	}
	return out, nil
}

func (r *ClientGroupRepository) Create(ctx context.Context, g *client_group.ClientGroup) error {
	query := `
		INSERT INTO client_groups (id, tenant_id, name, description, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6)
	`
	_, err := r.db.Exec(ctx, query, g.ID, g.TenantID, g.Name, g.Description, g.CreatedAt, g.UpdatedAt)
	return err
}

func (r *ClientGroupRepository) Update(ctx context.Context, g *client_group.ClientGroup) error {
	query := `
		UPDATE client_groups
		SET name = $3,
		    description = $4,
		    updated_at = $5
		WHERE id = $1 AND tenant_id = $2
	`
	res, err := r.db.Exec(ctx, query, g.ID, g.TenantID, g.Name, g.Description, g.UpdatedAt)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrClientGroupNotFound
	}
	return nil
}

func (r *ClientGroupRepository) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	query := `DELETE FROM client_groups WHERE id = $1 AND tenant_id = $2`
	res, err := r.db.Exec(ctx, query, id, tenantID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrClientGroupNotFound
	}
	return nil
}

func (r *ClientGroupRepository) NameExists(ctx context.Context, tenantID uuid.UUID, name string, excludeID *uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM client_groups WHERE tenant_id = $1 AND name = $2`
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


