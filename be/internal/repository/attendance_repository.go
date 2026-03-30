package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/attendance"
)

var (
	ErrAttendanceNotFound = errors.New("attendance record not found")
)

type AttendanceRepository struct {
	db *pgxpool.Pool
}

func NewAttendanceRepository(db *pgxpool.Pool) *AttendanceRepository {
	return &AttendanceRepository{db: db}
}

// Attendance Operations

func (r *AttendanceRepository) Create(ctx context.Context, a *attendance.Attendance) error {
	query := `
		INSERT INTO attendances (
			id, tenant_id, user_id, date, status, check_in_time, 
			check_in_latitude, check_in_longitude, note, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err := r.db.Exec(ctx, query,
		a.ID, a.TenantID, a.UserID, a.Date, a.Status, a.CheckInTime,
		a.CheckInLatitude, a.CheckInLongitude, a.Note, a.CreatedAt, a.UpdatedAt,
	)
	return err
}

func (r *AttendanceRepository) GetToday(ctx context.Context, userID uuid.UUID, date time.Time) (*attendance.Attendance, error) {
	query := `
		SELECT id, tenant_id, user_id, date, check_in_time, check_out_time, status,
		       check_in_latitude, check_in_longitude, check_out_latitude, check_out_longitude,
		       note, total_hours, created_at, updated_at
		FROM attendances
		WHERE user_id = $1 AND date = $2
	`
	var a attendance.Attendance
	err := r.db.QueryRow(ctx, query, userID, date.Format("2006-01-02")).Scan(
		&a.ID, &a.TenantID, &a.UserID, &a.Date, &a.CheckInTime, &a.CheckOutTime, &a.Status,
		&a.CheckInLatitude, &a.CheckInLongitude, &a.CheckOutLatitude, &a.CheckOutLongitude,
		&a.Note, &a.TotalHours, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAttendanceNotFound
		}
		return nil, err
	}
	return &a, nil
}

func (r *AttendanceRepository) Update(ctx context.Context, a *attendance.Attendance) error {
	query := `
		UPDATE attendances
		SET check_out_time = $2, status = $3, check_out_latitude = $4, 
		    check_out_longitude = $5, note = $6, total_hours = $7, updated_at = $8
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		a.ID, a.CheckOutTime, a.Status, a.CheckOutLatitude,
		a.CheckOutLongitude, a.Note, a.TotalHours, a.UpdatedAt,
	)
	return err
}

func (r *AttendanceRepository) List(ctx context.Context, userID uuid.UUID, startDate, endDate time.Time) ([]*attendance.Attendance, error) {
	query := `
		SELECT id, tenant_id, user_id, date, check_in_time, check_out_time, status,
		       check_in_latitude, check_in_longitude, check_out_latitude, check_out_longitude,
		       note, total_hours, created_at, updated_at
		FROM attendances
		WHERE user_id = $1 AND date >= $2 AND date <= $3
		ORDER BY date DESC
	`
	rows, err := r.db.Query(ctx, query, userID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*attendance.Attendance
	for rows.Next() {
		var a attendance.Attendance
		err := rows.Scan(
			&a.ID, &a.TenantID, &a.UserID, &a.Date, &a.CheckInTime, &a.CheckOutTime, &a.Status,
			&a.CheckInLatitude, &a.CheckInLongitude, &a.CheckOutLatitude, &a.CheckOutLongitude,
			&a.Note, &a.TotalHours, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		result = append(result, &a)
	}
	return result, nil
}

func (r *AttendanceRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID, startDate, endDate time.Time) ([]any, error) {
	query := `
		SELECT a.id, a.tenant_id, a.user_id, u.name as user_name, a.date, a.check_in_time, a.check_out_time, 
		       a.status, a.check_in_latitude, a.check_in_longitude, a.check_out_latitude, 
		       a.check_out_longitude, a.note, a.total_hours, a.created_at, a.updated_at
		FROM attendances a
		JOIN users u ON a.user_id = u.id
		WHERE a.tenant_id = $1 AND a.date >= $2 AND a.date <= $3
		ORDER BY a.date DESC, a.check_in_time DESC
	`
	rows, err := r.db.Query(ctx, query, tenantID, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []any
	for rows.Next() {
		var a attendance.Attendance
		var userName string
		err := rows.Scan(
			&a.ID, &a.TenantID, &a.UserID, &userName, &a.Date, &a.CheckInTime, &a.CheckOutTime, &a.Status,
			&a.CheckInLatitude, &a.CheckInLongitude, &a.CheckOutLatitude, &a.CheckOutLongitude,
			&a.Note, &a.TotalHours, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		// Map to a dynamic object or add UserName to domain Attendance (simpler for now)
		item := map[string]interface{}{
			"id":                 a.ID,
			"tenant_id":          a.TenantID,
			"user_id":            a.UserID,
			"user_name":          userName,
			"date":               a.Date,
			"check_in_time":      a.CheckInTime,
			"check_out_time":     a.CheckOutTime,
			"status":             a.Status,
			"location_latitude":  a.CheckInLatitude,
			"location_longitude": a.CheckInLongitude,
			"note":               a.Note,
			"total_hours":        a.TotalHours,
			"created_at":         a.CreatedAt,
			"updated_at":         a.UpdatedAt,
		}
		result = append(result, item)
	}
	return result, nil
}

// Settings Operations

func (r *AttendanceRepository) GetSettings(ctx context.Context, tenantID uuid.UUID) (*attendance.AttendanceSettings, error) {
	query := `
		SELECT tenant_id, enabled, require_geolocation, radius_meters, allowed_locations, updated_at, updated_by
		FROM attendance_settings
		WHERE tenant_id = $1
	`
	var s attendance.AttendanceSettings
	err := r.db.QueryRow(ctx, query, tenantID).Scan(
		&s.TenantID, &s.Enabled, &s.RequireGeolocation, &s.RadiusMeters, &s.AllowedLocations, &s.UpdatedAt, &s.UpdatedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Return default settings if not exists
			return &attendance.AttendanceSettings{
				TenantID:           tenantID,
				Enabled:            true,
				RequireGeolocation: true,
				RadiusMeters:       100,
				AllowedLocations:   []attendance.Location{},
			}, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *AttendanceRepository) SaveSettings(ctx context.Context, s *attendance.AttendanceSettings) error {
	query := `
		INSERT INTO attendance_settings (tenant_id, enabled, require_geolocation, radius_meters, allowed_locations, updated_at, updated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (tenant_id) DO UPDATE
		SET enabled = EXCLUDED.enabled,
		    require_geolocation = EXCLUDED.require_geolocation,
		    radius_meters = EXCLUDED.radius_meters,
		    allowed_locations = EXCLUDED.allowed_locations,
		    updated_at = EXCLUDED.updated_at,
		    updated_by = EXCLUDED.updated_by
	`
	_, err := r.db.Exec(ctx, query,
		s.TenantID, s.Enabled, s.RequireGeolocation, s.RadiusMeters, s.AllowedLocations, s.UpdatedAt, s.UpdatedBy,
	)
	return err
}
