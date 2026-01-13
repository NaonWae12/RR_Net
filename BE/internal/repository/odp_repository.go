package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/maps"
)

type ODPRepository struct {
	db *pgxpool.Pool
}

func NewODPRepository(db *pgxpool.Pool) *ODPRepository {
	return &ODPRepository{db: db}
}

func (r *ODPRepository) Create(ctx context.Context, odp *maps.ODP) error {
	query := `
		INSERT INTO odps (id, tenant_id, odc_id, name, latitude, longitude, port_count, used_ports, notes, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	_, err := r.db.Exec(ctx, query,
		odp.ID, odp.TenantID, odp.ODCID, odp.Name, odp.Latitude, odp.Longitude,
		odp.PortCount, odp.UsedPorts, odp.Notes, odp.Status, odp.CreatedAt, odp.UpdatedAt,
	)
	return err
}

func (r *ODPRepository) GetByID(ctx context.Context, id uuid.UUID) (*maps.ODP, error) {
	query := `
		SELECT id, tenant_id, odc_id, name, latitude, longitude, port_count, used_ports, notes, status, created_at, updated_at
		FROM odps
		WHERE id = $1
	`
	var odp maps.ODP
	err := r.db.QueryRow(ctx, query, id).Scan(
		&odp.ID, &odp.TenantID, &odp.ODCID, &odp.Name, &odp.Latitude, &odp.Longitude,
		&odp.PortCount, &odp.UsedPorts, &odp.Notes, &odp.Status, &odp.CreatedAt, &odp.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("ODP not found")
	}
	return &odp, err
}

func (r *ODPRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*maps.ODP, error) {
	query := `
		SELECT id, tenant_id, odc_id, name, latitude, longitude, port_count, used_ports, notes, status, created_at, updated_at
		FROM odps
		WHERE tenant_id = $1
		ORDER BY name
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var odps []*maps.ODP
	for rows.Next() {
		var odp maps.ODP
		err := rows.Scan(
			&odp.ID, &odp.TenantID, &odp.ODCID, &odp.Name, &odp.Latitude, &odp.Longitude,
			&odp.PortCount, &odp.UsedPorts, &odp.Notes, &odp.Status, &odp.CreatedAt, &odp.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		odps = append(odps, &odp)
	}
	return odps, nil
}

func (r *ODPRepository) ListByODC(ctx context.Context, odcID uuid.UUID) ([]*maps.ODP, error) {
	query := `
		SELECT id, tenant_id, odc_id, name, latitude, longitude, port_count, used_ports, notes, status, created_at, updated_at
		FROM odps
		WHERE odc_id = $1
		ORDER BY name
	`
	rows, err := r.db.Query(ctx, query, odcID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var odps []*maps.ODP
	for rows.Next() {
		var odp maps.ODP
		err := rows.Scan(
			&odp.ID, &odp.TenantID, &odp.ODCID, &odp.Name, &odp.Latitude, &odp.Longitude,
			&odp.PortCount, &odp.UsedPorts, &odp.Notes, &odp.Status, &odp.CreatedAt, &odp.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		odps = append(odps, &odp)
	}
	return odps, nil
}

func (r *ODPRepository) Update(ctx context.Context, odp *maps.ODP) error {
	query := `
		UPDATE odps
		SET name = $2, latitude = $3, longitude = $4, port_count = $5, used_ports = $6, notes = $7, status = $8, updated_at = $9
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		odp.ID, odp.Name, odp.Latitude, odp.Longitude, odp.PortCount, odp.UsedPorts, odp.Notes, odp.Status, odp.UpdatedAt,
	)
	return err
}

func (r *ODPRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM odps WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *ODPRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status maps.NodeStatus) error {
	query := `UPDATE odps SET status = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, status)
	return err
}

func (r *ODPRepository) IncrementUsedPorts(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE odps SET used_ports = used_ports + 1, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *ODPRepository) DecrementUsedPorts(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE odps SET used_ports = GREATEST(used_ports - 1, 0), updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

