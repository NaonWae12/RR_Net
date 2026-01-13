package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/maps"
)

type TopologyRepository struct {
	db *pgxpool.Pool
}

func NewTopologyRepository(db *pgxpool.Pool) *TopologyRepository {
	return &TopologyRepository{db: db}
}

func (r *TopologyRepository) CreateLink(ctx context.Context, link *maps.TopologyLink) error {
	query := `
		INSERT INTO topology_links (id, tenant_id, from_type, from_id, to_type, to_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (tenant_id, from_type, from_id, to_type, to_id) DO NOTHING
	`
	_, err := r.db.Exec(ctx, query,
		link.ID, link.TenantID, link.FromType, link.FromID, link.ToType, link.ToID, link.CreatedAt,
	)
	return err
}

func (r *TopologyRepository) GetODPsByODC(ctx context.Context, odcID uuid.UUID) ([]uuid.UUID, error) {
	query := `
		SELECT to_id
		FROM topology_links
		WHERE from_type = 'odc' AND from_id = $1 AND to_type = 'odp'
	`
	rows, err := r.db.Query(ctx, query, odcID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var odpIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		odpIDs = append(odpIDs, id)
	}
	return odpIDs, nil
}

func (r *TopologyRepository) GetClientsByODP(ctx context.Context, odpID uuid.UUID) ([]uuid.UUID, error) {
	query := `
		SELECT to_id
		FROM topology_links
		WHERE from_type = 'odp' AND from_id = $1 AND to_type = 'client'
	`
	rows, err := r.db.Query(ctx, query, odpID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clientIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		clientIDs = append(clientIDs, id)
	}
	return clientIDs, nil
}

func (r *TopologyRepository) GetClientsByODC(ctx context.Context, odcID uuid.UUID) ([]uuid.UUID, error) {
	// Get all clients connected to ODPs under this ODC
	query := `
		SELECT DISTINCT tl2.to_id
		FROM topology_links tl1
		JOIN topology_links tl2 ON tl1.to_id = tl2.from_id
		WHERE tl1.from_type = 'odc' AND tl1.from_id = $1
		  AND tl1.to_type = 'odp'
		  AND tl2.from_type = 'odp'
		  AND tl2.to_type = 'client'
	`
	rows, err := r.db.Query(ctx, query, odcID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clientIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		clientIDs = append(clientIDs, id)
	}
	return clientIDs, nil
}

func (r *TopologyRepository) DeleteLink(ctx context.Context, fromType maps.NodeType, fromID uuid.UUID, toType maps.NodeType, toID uuid.UUID) error {
	query := `
		DELETE FROM topology_links
		WHERE from_type = $1 AND from_id = $2 AND to_type = $3 AND to_id = $4
	`
	_, err := r.db.Exec(ctx, query, fromType, fromID, toType, toID)
	return err
}

func (r *TopologyRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*maps.TopologyLink, error) {
	query := `
		SELECT id, tenant_id, from_type, from_id, to_type, to_id, created_at
		FROM topology_links
		WHERE tenant_id = $1
		ORDER BY created_at
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var links []*maps.TopologyLink
	for rows.Next() {
		var link maps.TopologyLink
		err := rows.Scan(
			&link.ID, &link.TenantID, &link.FromType, &link.FromID,
			&link.ToType, &link.ToID, &link.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		links = append(links, &link)
	}
	return links, nil
}

