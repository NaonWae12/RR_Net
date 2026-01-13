package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/radius"
)

type RadiusRepository struct {
	db *pgxpool.Pool
}

func NewRadiusRepository(db *pgxpool.Pool) *RadiusRepository {
	return &RadiusRepository{db: db}
}

func (r *RadiusRepository) CreateAuthAttempt(ctx context.Context, attempt *radius.AuthAttempt) error {
	query := `
		INSERT INTO radius_auth_attempts (
			id, tenant_id, router_id, username, nas_ip_address, nas_port_id,
			calling_station_id, called_station_id, auth_result, reject_reason,
			voucher_id, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	_, err := r.db.Exec(ctx, query,
		attempt.ID, attempt.TenantID, attempt.RouterID, attempt.Username,
		attempt.NASIPAddress, attempt.NASPortID, attempt.CallingStationID,
		attempt.CalledStationID, attempt.AuthResult, attempt.RejectReason,
		attempt.VoucherID, attempt.CreatedAt,
	)
	return err
}

func (r *RadiusRepository) ListAuthAttempts(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*radius.AuthAttempt, error) {
	query := `
		SELECT id, tenant_id, router_id, username, nas_ip_address, nas_port_id,
			calling_station_id, called_station_id, auth_result, reject_reason,
			voucher_id, created_at
		FROM radius_auth_attempts
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(ctx, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attempts []*radius.AuthAttempt
	for rows.Next() {
		var a radius.AuthAttempt
		err := rows.Scan(
			&a.ID, &a.TenantID, &a.RouterID, &a.Username, &a.NASIPAddress,
			&a.NASPortID, &a.CallingStationID, &a.CalledStationID,
			&a.AuthResult, &a.RejectReason, &a.VoucherID, &a.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		attempts = append(attempts, &a)
	}
	return attempts, nil
}

func (r *RadiusRepository) UpsertSession(ctx context.Context, session *radius.Session) error {
	query := `
		INSERT INTO radius_sessions (
			id, tenant_id, router_id, voucher_id, acct_session_id, acct_unique_id,
			username, nas_ip_address, nas_port_id, framed_ip_address,
			calling_station_id, called_station_id, acct_start_time, acct_stop_time,
			acct_session_time, acct_input_octets, acct_output_octets,
			acct_input_packets, acct_output_packets, acct_terminate_cause,
			session_status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
		ON CONFLICT (acct_session_id) DO UPDATE SET
			acct_stop_time = EXCLUDED.acct_stop_time,
			acct_session_time = EXCLUDED.acct_session_time,
			acct_input_octets = EXCLUDED.acct_input_octets,
			acct_output_octets = EXCLUDED.acct_output_octets,
			acct_input_packets = EXCLUDED.acct_input_packets,
			acct_output_packets = EXCLUDED.acct_output_packets,
			acct_terminate_cause = EXCLUDED.acct_terminate_cause,
			session_status = EXCLUDED.session_status,
			updated_at = EXCLUDED.updated_at
	`
	_, err := r.db.Exec(ctx, query,
		session.ID, session.TenantID, session.RouterID, session.VoucherID,
		session.AcctSessionID, session.AcctUniqueID, session.Username,
		session.NASIPAddress, session.NASPortID, session.FramedIPAddress,
		session.CallingStationID, session.CalledStationID, session.AcctStartTime,
		session.AcctStopTime, session.AcctSessionTime, session.AcctInputOctets,
		session.AcctOutputOctets, session.AcctInputPackets, session.AcctOutputPackets,
		session.AcctTerminateCause, session.SessionStatus, session.CreatedAt, session.UpdatedAt,
	)
	return err
}

func (r *RadiusRepository) ListActiveSessions(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*radius.Session, error) {
	query := `
		SELECT id, tenant_id, router_id, voucher_id, acct_session_id, acct_unique_id,
			username, nas_ip_address, nas_port_id, framed_ip_address,
			calling_station_id, called_station_id, acct_start_time, acct_stop_time,
			acct_session_time, acct_input_octets, acct_output_octets,
			acct_input_packets, acct_output_packets, acct_terminate_cause,
			session_status, created_at, updated_at
		FROM radius_sessions
		WHERE tenant_id = $1 AND session_status = 'active'
		ORDER BY acct_start_time DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(ctx, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []*radius.Session
	for rows.Next() {
		var s radius.Session
		err := rows.Scan(
			&s.ID, &s.TenantID, &s.RouterID, &s.VoucherID, &s.AcctSessionID,
			&s.AcctUniqueID, &s.Username, &s.NASIPAddress, &s.NASPortID,
			&s.FramedIPAddress, &s.CallingStationID, &s.CalledStationID,
			&s.AcctStartTime, &s.AcctStopTime, &s.AcctSessionTime,
			&s.AcctInputOctets, &s.AcctOutputOctets, &s.AcctInputPackets,
			&s.AcctOutputPackets, &s.AcctTerminateCause, &s.SessionStatus,
			&s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, &s)
	}
	return sessions, nil
}

