package repository

import (
	"context"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuditLog represents an audit log entry
type AuditLog struct {
	ID          uuid.UUID
	TenantID    *uuid.UUID
	UserID      *uuid.UUID
	Action      string
	Resource    string
	ResourceID  *uuid.UUID
	Method      string
	Path        string
	IPAddress   string
	UserAgent   string
	RequestID   string
	Status      int
	Duration    time.Duration
	Metadata    map[string]interface{}
	CreatedAt   time.Time
}

// AuditLogRepository handles audit log operations
type AuditLogRepository struct {
	db *pgxpool.Pool
}

// NewAuditLogRepository creates a new audit log repository
func NewAuditLogRepository(db *pgxpool.Pool) *AuditLogRepository {
	return &AuditLogRepository{
		db: db,
	}
}

// Create creates a new audit log entry
func (r *AuditLogRepository) Create(ctx context.Context, log *AuditLog) error {
	query := `
		INSERT INTO audit_logs (
			id, tenant_id, user_id, action, resource, resource_id,
			method, path, ip_address, user_agent, request_id,
			status, duration_ms, metadata, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
		)
	`

	_, err := r.db.Exec(ctx, query,
		log.ID,
		log.TenantID,
		log.UserID,
		log.Action,
		log.Resource,
		log.ResourceID,
		log.Method,
		log.Path,
		log.IPAddress,
		log.UserAgent,
		log.RequestID,
		log.Status,
		log.Duration.Milliseconds(),
		log.Metadata,
		log.CreatedAt,
	)

	return err
}

// List retrieves audit logs with filtering
type AuditLogFilter struct {
	TenantID   *uuid.UUID
	UserID     *uuid.UUID
	Action     *string
	Resource   *string
	StartDate  *time.Time
	EndDate    *time.Time
	Limit      int
	Offset     int
}

// List retrieves audit logs
func (r *AuditLogRepository) List(ctx context.Context, filter AuditLogFilter) ([]*AuditLog, int, error) {
	// Build query with filters
	query := "SELECT id, tenant_id, user_id, action, resource, resource_id, method, path, ip_address, user_agent, request_id, status, duration_ms, metadata, created_at FROM audit_logs WHERE 1=1"
	args := []interface{}{}
	argPos := 1

	if filter.TenantID != nil {
		query += " AND tenant_id = $" + strconv.Itoa(argPos)
		args = append(args, *filter.TenantID)
		argPos++
	}

	if filter.UserID != nil {
		query += " AND user_id = $" + strconv.Itoa(argPos)
		args = append(args, *filter.UserID)
		argPos++
	}

	if filter.Action != nil {
		query += " AND action = $" + strconv.Itoa(argPos)
		args = append(args, *filter.Action)
		argPos++
	}

	if filter.Resource != nil {
		query += " AND resource = $" + strconv.Itoa(argPos)
		args = append(args, *filter.Resource)
		argPos++
	}

	if filter.StartDate != nil {
		query += " AND created_at >= $" + strconv.Itoa(argPos)
		args = append(args, *filter.StartDate)
		argPos++
	}

	if filter.EndDate != nil {
		query += " AND created_at <= $" + strconv.Itoa(argPos)
		args = append(args, *filter.EndDate)
		argPos++
	}

	query += " ORDER BY created_at DESC"

	if filter.Limit > 0 {
		query += " LIMIT $" + strconv.Itoa(argPos)
		args = append(args, filter.Limit)
		argPos++
	}

	if filter.Offset > 0 {
		query += " OFFSET $" + strconv.Itoa(argPos)
		args = append(args, filter.Offset)
		argPos++
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	logs := []*AuditLog{}
	for rows.Next() {
		var log AuditLog
		var durationMs int64
		err := rows.Scan(
			&log.ID,
			&log.TenantID,
			&log.UserID,
			&log.Action,
			&log.Resource,
			&log.ResourceID,
			&log.Method,
			&log.Path,
			&log.IPAddress,
			&log.UserAgent,
			&log.RequestID,
			&log.Status,
			&durationMs,
			&log.Metadata,
			&log.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		log.Duration = time.Duration(durationMs) * time.Millisecond
		logs = append(logs, &log)
	}

	// Get total count
	countQuery := "SELECT COUNT(*) FROM audit_logs WHERE 1=1"
	countArgs := []interface{}{}
	countArgPos := 1

	if filter.TenantID != nil {
		countQuery += " AND tenant_id = $" + strconv.Itoa(countArgPos)
		countArgs = append(countArgs, *filter.TenantID)
		countArgPos++
	}

	// ... similar filters for count query

	var total int
	err = r.db.QueryRow(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

