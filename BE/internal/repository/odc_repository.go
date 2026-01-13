package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/maps"
)

type ODCRepository struct {
	db *pgxpool.Pool
}

func NewODCRepository(db *pgxpool.Pool) *ODCRepository {
	return &ODCRepository{db: db}
}

func (r *ODCRepository) Create(ctx context.Context, odc *maps.ODC) error {
	query := `
		INSERT INTO odcs (id, tenant_id, name, latitude, longitude, capacity_info, notes, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.Exec(ctx, query,
		odc.ID, odc.TenantID, odc.Name, odc.Latitude, odc.Longitude,
		odc.CapacityInfo, odc.Notes, odc.Status, odc.CreatedAt, odc.UpdatedAt,
	)
	return err
}

func (r *ODCRepository) GetByID(ctx context.Context, id uuid.UUID) (*maps.ODC, error) {
	query := `
		SELECT id, tenant_id, name, latitude, longitude, capacity_info, notes, status, created_at, updated_at
		FROM odcs
		WHERE id = $1
	`
	var odc maps.ODC
	err := r.db.QueryRow(ctx, query, id).Scan(
		&odc.ID, &odc.TenantID, &odc.Name, &odc.Latitude, &odc.Longitude,
		&odc.CapacityInfo, &odc.Notes, &odc.Status, &odc.CreatedAt, &odc.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("ODC not found")
	}
	return &odc, err
}

func (r *ODCRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*maps.ODC, error) {
	query := `
		SELECT id, tenant_id, name, latitude, longitude, capacity_info, notes, status, created_at, updated_at
		FROM odcs
		WHERE tenant_id = $1
		ORDER BY name
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var odcs []*maps.ODC
	for rows.Next() {
		var odc maps.ODC
		err := rows.Scan(
			&odc.ID, &odc.TenantID, &odc.Name, &odc.Latitude, &odc.Longitude,
			&odc.CapacityInfo, &odc.Notes, &odc.Status, &odc.CreatedAt, &odc.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		odcs = append(odcs, &odc)
	}
	return odcs, nil
}

func (r *ODCRepository) Update(ctx context.Context, odc *maps.ODC) error {
	query := `
		UPDATE odcs
		SET name = $2, latitude = $3, longitude = $4, capacity_info = $5, notes = $6, status = $7, updated_at = $8
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		odc.ID, odc.Name, odc.Latitude, odc.Longitude, odc.CapacityInfo, odc.Notes, odc.Status, odc.UpdatedAt,
	)
	return err
}

func (r *ODCRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM odcs WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *ODCRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status maps.NodeStatus) error {
	query := `UPDATE odcs SET status = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, status)
	return err
}

