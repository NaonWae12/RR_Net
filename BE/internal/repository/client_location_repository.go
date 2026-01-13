package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/maps"
)

type ClientLocationRepository struct {
	db *pgxpool.Pool
}

func NewClientLocationRepository(db *pgxpool.Pool) *ClientLocationRepository {
	return &ClientLocationRepository{db: db}
}

func (r *ClientLocationRepository) Create(ctx context.Context, loc *maps.ClientLocation) error {
	query := `
		INSERT INTO client_locations (id, tenant_id, client_id, odp_id, latitude, longitude, connection_type, signal_info, notes, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	_, err := r.db.Exec(ctx, query,
		loc.ID, loc.TenantID, loc.ClientID, loc.ODPID, loc.Latitude, loc.Longitude,
		loc.ConnectionType, loc.SignalInfo, loc.Notes, loc.Status, loc.CreatedAt, loc.UpdatedAt,
	)
	return err
}

func (r *ClientLocationRepository) GetByID(ctx context.Context, id uuid.UUID) (*maps.ClientLocation, error) {
	query := `
		SELECT id, tenant_id, client_id, odp_id, latitude, longitude, connection_type, signal_info, notes, status, created_at, updated_at
		FROM client_locations
		WHERE id = $1
	`
	var loc maps.ClientLocation
	err := r.db.QueryRow(ctx, query, id).Scan(
		&loc.ID, &loc.TenantID, &loc.ClientID, &loc.ODPID, &loc.Latitude, &loc.Longitude,
		&loc.ConnectionType, &loc.SignalInfo, &loc.Notes, &loc.Status, &loc.CreatedAt, &loc.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("client location not found")
	}
	return &loc, err
}

func (r *ClientLocationRepository) GetByClientID(ctx context.Context, clientID uuid.UUID) (*maps.ClientLocation, error) {
	query := `
		SELECT id, tenant_id, client_id, odp_id, latitude, longitude, connection_type, signal_info, notes, status, created_at, updated_at
		FROM client_locations
		WHERE client_id = $1
	`
	var loc maps.ClientLocation
	err := r.db.QueryRow(ctx, query, clientID).Scan(
		&loc.ID, &loc.TenantID, &loc.ClientID, &loc.ODPID, &loc.Latitude, &loc.Longitude,
		&loc.ConnectionType, &loc.SignalInfo, &loc.Notes, &loc.Status, &loc.CreatedAt, &loc.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("client location not found")
	}
	return &loc, err
}

func (r *ClientLocationRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*maps.ClientLocation, error) {
	query := `
		SELECT id, tenant_id, client_id, odp_id, latitude, longitude, connection_type, signal_info, notes, status, created_at, updated_at
		FROM client_locations
		WHERE tenant_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var locations []*maps.ClientLocation
	for rows.Next() {
		var loc maps.ClientLocation
		err := rows.Scan(
			&loc.ID, &loc.TenantID, &loc.ClientID, &loc.ODPID, &loc.Latitude, &loc.Longitude,
			&loc.ConnectionType, &loc.SignalInfo, &loc.Notes, &loc.Status, &loc.CreatedAt, &loc.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		locations = append(locations, &loc)
	}
	return locations, nil
}

func (r *ClientLocationRepository) ListByODP(ctx context.Context, odpID uuid.UUID) ([]*maps.ClientLocation, error) {
	query := `
		SELECT id, tenant_id, client_id, odp_id, latitude, longitude, connection_type, signal_info, notes, status, created_at, updated_at
		FROM client_locations
		WHERE odp_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, odpID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var locations []*maps.ClientLocation
	for rows.Next() {
		var loc maps.ClientLocation
		err := rows.Scan(
			&loc.ID, &loc.TenantID, &loc.ClientID, &loc.ODPID, &loc.Latitude, &loc.Longitude,
			&loc.ConnectionType, &loc.SignalInfo, &loc.Notes, &loc.Status, &loc.CreatedAt, &loc.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		locations = append(locations, &loc)
	}
	return locations, nil
}

func (r *ClientLocationRepository) Update(ctx context.Context, loc *maps.ClientLocation) error {
	query := `
		UPDATE client_locations
		SET odp_id = $2, latitude = $3, longitude = $4, connection_type = $5, signal_info = $6, notes = $7, status = $8, updated_at = $9
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		loc.ID, loc.ODPID, loc.Latitude, loc.Longitude, loc.ConnectionType, loc.SignalInfo, loc.Notes, loc.Status, loc.UpdatedAt,
	)
	return err
}

func (r *ClientLocationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM client_locations WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *ClientLocationRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status maps.NodeStatus) error {
	query := `UPDATE client_locations SET status = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, status)
	return err
}

// FindNearestODP finds the nearest ODP to given coordinates using Haversine formula
// Note: For production with PostGIS, use ST_Distance instead
func (r *ClientLocationRepository) FindNearestODP(ctx context.Context, tenantID uuid.UUID, lat, lng float64, limit int) ([]uuid.UUID, error) {
	// Using Haversine formula approximation (simplified for performance)
	// For production, use PostGIS ST_Distance
	query := `
		SELECT id, latitude, longitude
		FROM odps
		WHERE tenant_id = $1
		ORDER BY (
			(latitude - $2) * (latitude - $2) + 
			(longitude - $3) * (longitude - $3)
		)
		LIMIT $4
	`
	rows, err := r.db.Query(ctx, query, tenantID, lat, lng, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var odpIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		var latVal, lngVal float64
		if err := rows.Scan(&id, &latVal, &lngVal); err != nil {
			return nil, err
		}
		odpIDs = append(odpIDs, id)
	}
	return odpIDs, nil
}

