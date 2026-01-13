package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/maps"
)

type OutageRepository struct {
	db *pgxpool.Pool
}

func NewOutageRepository(db *pgxpool.Pool) *OutageRepository {
	return &OutageRepository{db: db}
}

func (r *OutageRepository) Create(ctx context.Context, outage *maps.OutageEvent) error {
	query := `
		INSERT INTO outage_events (id, tenant_id, node_type, node_id, reason, reported_by, reported_at, resolved_at, resolved_by, is_resolved, affected_nodes, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	_, err := r.db.Exec(ctx, query,
		outage.ID, outage.TenantID, outage.NodeType, outage.NodeID, outage.Reason,
		outage.ReportedBy, outage.ReportedAt, outage.ResolvedAt, outage.ResolvedBy,
		outage.IsResolved, outage.AffectedNodes, outage.CreatedAt, outage.UpdatedAt,
	)
	return err
}

func (r *OutageRepository) GetByID(ctx context.Context, id uuid.UUID) (*maps.OutageEvent, error) {
	query := `
		SELECT id, tenant_id, node_type, node_id, reason, reported_by, reported_at, resolved_at, resolved_by, is_resolved, affected_nodes, created_at, updated_at
		FROM outage_events
		WHERE id = $1
	`
	var outage maps.OutageEvent
	err := r.db.QueryRow(ctx, query, id).Scan(
		&outage.ID, &outage.TenantID, &outage.NodeType, &outage.NodeID, &outage.Reason,
		&outage.ReportedBy, &outage.ReportedAt, &outage.ResolvedAt, &outage.ResolvedBy,
		&outage.IsResolved, &outage.AffectedNodes, &outage.CreatedAt, &outage.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("outage event not found")
	}
	return &outage, err
}

func (r *OutageRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID, includeResolved bool) ([]*maps.OutageEvent, error) {
	query := `
		SELECT id, tenant_id, node_type, node_id, reason, reported_by, reported_at, resolved_at, resolved_by, is_resolved, affected_nodes, created_at, updated_at
		FROM outage_events
		WHERE tenant_id = $1
	`
	args := []interface{}{tenantID}
	if !includeResolved {
		query += " AND is_resolved = false"
	}
	query += " ORDER BY reported_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var outages []*maps.OutageEvent
	for rows.Next() {
		var outage maps.OutageEvent
		err := rows.Scan(
			&outage.ID, &outage.TenantID, &outage.NodeType, &outage.NodeID, &outage.Reason,
			&outage.ReportedBy, &outage.ReportedAt, &outage.ResolvedAt, &outage.ResolvedBy,
			&outage.IsResolved, &outage.AffectedNodes, &outage.CreatedAt, &outage.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		outages = append(outages, &outage)
	}
	return outages, nil
}

func (r *OutageRepository) GetActiveOutageByNode(ctx context.Context, nodeType maps.NodeType, nodeID uuid.UUID) (*maps.OutageEvent, error) {
	query := `
		SELECT id, tenant_id, node_type, node_id, reason, reported_by, reported_at, resolved_at, resolved_by, is_resolved, affected_nodes, created_at, updated_at
		FROM outage_events
		WHERE node_type = $1 AND node_id = $2 AND is_resolved = false
		ORDER BY reported_at DESC
		LIMIT 1
	`
	var outage maps.OutageEvent
	err := r.db.QueryRow(ctx, query, nodeType, nodeID).Scan(
		&outage.ID, &outage.TenantID, &outage.NodeType, &outage.NodeID, &outage.Reason,
		&outage.ReportedBy, &outage.ReportedAt, &outage.ResolvedAt, &outage.ResolvedBy,
		&outage.IsResolved, &outage.AffectedNodes, &outage.CreatedAt, &outage.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil // No active outage
	}
	return &outage, err
}

func (r *OutageRepository) Resolve(ctx context.Context, id uuid.UUID, resolvedBy uuid.UUID) error {
	query := `
		UPDATE outage_events
		SET is_resolved = true, resolved_at = NOW(), resolved_by = $2, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, resolvedBy)
	return err
}

