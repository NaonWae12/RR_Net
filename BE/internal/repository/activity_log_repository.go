package repository

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/technician"
)

type ActivityLogRepository struct {
	db *pgxpool.Pool
}

func NewActivityLogRepository(db *pgxpool.Pool) *ActivityLogRepository {
	return &ActivityLogRepository{db: db}
}

func (r *ActivityLogRepository) Create(ctx context.Context, log *technician.ActivityLog) error {
	query := `
		INSERT INTO technician_activity_logs (
			id, tenant_id, technician_id, task_id, activity_type, description,
			location_type, location_id, latitude, longitude, photo_urls, metadata, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	_, err := r.db.Exec(ctx, query,
		log.ID, log.TenantID, log.TechnicianID, log.TaskID, log.ActivityType, log.Description,
		log.LocationType, log.LocationID, log.Latitude, log.Longitude, log.PhotoURLs, log.Metadata, log.CreatedAt,
	)
	return err
}

func (r *ActivityLogRepository) ListByTechnician(ctx context.Context, technicianID uuid.UUID, limit int) ([]*technician.ActivityLog, error) {
	query := `
		SELECT id, tenant_id, technician_id, task_id, activity_type, description,
			location_type, location_id, latitude, longitude, photo_urls, metadata, created_at
		FROM technician_activity_logs
		WHERE technician_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := r.db.Query(ctx, query, technicianID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*technician.ActivityLog
	for rows.Next() {
		var log technician.ActivityLog
		err := rows.Scan(
			&log.ID, &log.TenantID, &log.TechnicianID, &log.TaskID, &log.ActivityType, &log.Description,
			&log.LocationType, &log.LocationID, &log.Latitude, &log.Longitude, &log.PhotoURLs, &log.Metadata, &log.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, &log)
	}
	return logs, nil
}

func (r *ActivityLogRepository) ListByTask(ctx context.Context, taskID uuid.UUID) ([]*technician.ActivityLog, error) {
	query := `
		SELECT id, tenant_id, technician_id, task_id, activity_type, description,
			location_type, location_id, latitude, longitude, photo_urls, metadata, created_at
		FROM technician_activity_logs
		WHERE task_id = $1
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(ctx, query, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*technician.ActivityLog
	for rows.Next() {
		var log technician.ActivityLog
		err := rows.Scan(
			&log.ID, &log.TenantID, &log.TechnicianID, &log.TaskID, &log.ActivityType, &log.Description,
			&log.LocationType, &log.LocationID, &log.Latitude, &log.Longitude, &log.PhotoURLs, &log.Metadata, &log.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, &log)
	}
	return logs, nil
}

func (r *ActivityLogRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID, limit int) ([]*technician.ActivityLog, error) {
	query := `
		SELECT id, tenant_id, technician_id, task_id, activity_type, description,
			location_type, location_id, latitude, longitude, photo_urls, metadata, created_at
		FROM technician_activity_logs
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := r.db.Query(ctx, query, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*technician.ActivityLog
	for rows.Next() {
		var log technician.ActivityLog
		err := rows.Scan(
			&log.ID, &log.TenantID, &log.TechnicianID, &log.TaskID, &log.ActivityType, &log.Description,
			&log.LocationType, &log.LocationID, &log.Latitude, &log.Longitude, &log.PhotoURLs, &log.Metadata, &log.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		logs = append(logs, &log)
	}
	return logs, nil
}

// LogActivity is a helper to create activity log with metadata
func (r *ActivityLogRepository) LogActivity(ctx context.Context, log *technician.ActivityLog, metadata interface{}) error {
	if metadata != nil {
		metaBytes, err := json.Marshal(metadata)
		if err == nil {
			log.Metadata = string(metaBytes)
		}
	}
	return r.Create(ctx, log)
}

