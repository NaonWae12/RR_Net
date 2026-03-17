package repository

import (
	"context"
	timeoff "rrnet/internal/domain/time_off"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TimeOffRepository struct {
	db *pgxpool.Pool
}

func NewTimeOffRepository(db *pgxpool.Pool) *TimeOffRepository {
	return &TimeOffRepository{db: db}
}

func (r *TimeOffRepository) Create(ctx context.Context, to *timeoff.TimeOff) error {
	query := `
		INSERT INTO time_offs (
			id, tenant_id, user_id, type, start_date, end_date, reason, 
			attachment_url, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err := r.db.Exec(ctx, query,
		to.ID, to.TenantID, to.UserID, to.Type, to.StartDate, to.EndDate, to.Reason,
		to.AttachmentURL, to.Status, to.CreatedAt, to.UpdatedAt,
	)
	return err
}

func (r *TimeOffRepository) GetByID(ctx context.Context, id uuid.UUID) (*timeoff.TimeOff, error) {
	query := `
		SELECT 
			t.id, t.tenant_id, t.user_id, t.type, t.start_date, t.end_date, t.reason,
			t.attachment_url, t.status, t.approved_by, t.approved_at, t.rejection_reason,
			t.created_at, t.updated_at, u.name as user_name,
			(t.end_date - t.start_date + 1) as days_count
		FROM time_offs t
		JOIN users u ON t.user_id = u.id
		WHERE t.id = $1
	`
	row := r.db.QueryRow(ctx, query, id)

	var to timeoff.TimeOff
	err := row.Scan(
		&to.ID, &to.TenantID, &to.UserID, &to.Type, &to.StartDate, &to.EndDate, &to.Reason,
		&to.AttachmentURL, &to.Status, &to.ApprovedBy, &to.ApprovedAt, &to.RejectionReason,
		&to.CreatedAt, &to.UpdatedAt, &to.UserName, &to.DaysCount,
	)
	if err != nil {
		return nil, err
	}
	return &to, nil
}

func (r *TimeOffRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID, status *string) ([]*timeoff.TimeOff, error) {
	query := `
		SELECT 
			t.id, t.tenant_id, t.user_id, t.type, t.start_date, t.end_date, t.reason,
			t.attachment_url, t.status, t.approved_by, t.approved_at, t.rejection_reason,
			t.created_at, t.updated_at, u.name as user_name,
			(t.end_date - t.start_date + 1) as days_count
		FROM time_offs t
		JOIN users u ON t.user_id = u.id
		WHERE t.tenant_id = $1
	`
	args := []interface{}{tenantID}
	if status != nil && *status != "" {
		query += " AND t.status = $2"
		args = append(args, *status)
	}
	query += " ORDER BY t.created_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tos []*timeoff.TimeOff
	for rows.Next() {
		var to timeoff.TimeOff
		err := rows.Scan(
			&to.ID, &to.TenantID, &to.UserID, &to.Type, &to.StartDate, &to.EndDate, &to.Reason,
			&to.AttachmentURL, &to.Status, &to.ApprovedBy, &to.ApprovedAt, &to.RejectionReason,
			&to.CreatedAt, &to.UpdatedAt, &to.UserName, &to.DaysCount,
		)
		if err != nil {
			return nil, err
		}
		tos = append(tos, &to)
	}
	return tos, nil
}

func (r *TimeOffRepository) ListByUser(ctx context.Context, userID uuid.UUID, status *string) ([]*timeoff.TimeOff, error) {
	query := `
		SELECT 
			t.id, t.tenant_id, t.user_id, t.type, t.start_date, t.end_date, t.reason,
			t.attachment_url, t.status, t.approved_by, t.approved_at, t.rejection_reason,
			t.created_at, t.updated_at, u.name as user_name,
			(t.end_date - t.start_date + 1) as days_count
		FROM time_offs t
		JOIN users u ON t.user_id = u.id
		WHERE t.user_id = $1
	`
	args := []interface{}{userID}
	if status != nil && *status != "" {
		query += " AND t.status = $2"
		args = append(args, *status)
	}
	query += " ORDER BY t.created_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tos []*timeoff.TimeOff
	for rows.Next() {
		var to timeoff.TimeOff
		err := rows.Scan(
			&to.ID, &to.TenantID, &to.UserID, &to.Type, &to.StartDate, &to.EndDate, &to.Reason,
			&to.AttachmentURL, &to.Status, &to.ApprovedBy, &to.ApprovedAt, &to.RejectionReason,
			&to.CreatedAt, &to.UpdatedAt, &to.UserName, &to.DaysCount,
		)
		if err != nil {
			return nil, err
		}
		tos = append(tos, &to)
	}
	return tos, nil
}

func (r *TimeOffRepository) Update(ctx context.Context, to *timeoff.TimeOff) error {
	query := `
		UPDATE time_offs
		SET type = $2, start_date = $3, end_date = $4, reason = $5, status = $6,
			attachment_url = $7, approved_by = $8, approved_at = $9, rejection_reason = $10,
			updated_at = $11
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		to.ID, to.Type, to.StartDate, to.EndDate, to.Reason, to.Status,
		to.AttachmentURL, to.ApprovedBy, to.ApprovedAt, to.RejectionReason,
		to.UpdatedAt,
	)
	return err
}

func (r *TimeOffRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM time_offs WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}
