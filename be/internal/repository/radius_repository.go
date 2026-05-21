package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	upsertQuery := `
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
	// If linked to a voucher, update the voucher's denormalized stats incrementally.
	// We calculate the delta (change) in usage and add it to the voucher's total.
	if session.VoucherID != nil {
		// 1. Get current stats for this session to calculate the delta
		var oldTime int
		var oldInput, oldOutput int64
		err = tx.QueryRow(ctx, `
			SELECT COALESCE(acct_session_time, 0), acct_input_octets, acct_output_octets
			FROM radius_sessions WHERE acct_session_id = $1 FOR UPDATE
		`, session.AcctSessionID).Scan(&oldTime, &oldInput, &oldOutput)

		if err != nil && err != pgx.ErrNoRows {
			return err
		}

		// 2. Perform the Session Upsert
		// (The query below is the same as before, but kept inside the logic flow)
		_, err = tx.Exec(ctx, upsertQuery,
			session.ID, session.TenantID, session.RouterID, session.VoucherID,
			session.AcctSessionID, session.AcctUniqueID, session.Username,
			session.NASIPAddress, session.NASPortID, session.FramedIPAddress,
			session.CallingStationID, session.CalledStationID, session.AcctStartTime,
			session.AcctStopTime, session.AcctSessionTime, session.AcctInputOctets,
			session.AcctOutputOctets, session.AcctInputPackets, session.AcctOutputPackets,
			session.AcctTerminateCause, session.SessionStatus, session.CreatedAt, session.UpdatedAt,
		)
		if err != nil {
			return err
		}

		// 3. Calculate deltas
		newTime := 0
		if session.AcctSessionTime != nil {
			newTime = *session.AcctSessionTime
		}
		
		deltaSeconds := newTime - oldTime
		deltaBytes := (session.AcctInputOctets + session.AcctOutputOctets) - (oldInput + oldOutput)

		// 4. Atomic update to voucher
		if deltaSeconds != 0 || deltaBytes != 0 {
			_, err = tx.Exec(ctx, `
				UPDATE vouchers 
				SET total_uptime_seconds = total_uptime_seconds + $1,
					total_bytes_used = total_bytes_used + $2,
					updated_at = NOW()
				WHERE id = $3
			`, deltaSeconds, deltaBytes, *session.VoucherID)
			if err != nil {
				return err
			}
		}
	} else {
		// No voucher linked, just do the session upsert
		_, err = tx.Exec(ctx, upsertQuery,
			session.ID, session.TenantID, session.RouterID, session.VoucherID,
			session.AcctSessionID, session.AcctUniqueID, session.Username,
			session.NASIPAddress, session.NASPortID, session.FramedIPAddress,
			session.CallingStationID, session.CalledStationID, session.AcctStartTime,
			session.AcctStopTime, session.AcctSessionTime, session.AcctInputOctets,
			session.AcctOutputOctets, session.AcctInputPackets, session.AcctOutputPackets,
			session.AcctTerminateCause, session.SessionStatus, session.CreatedAt, session.UpdatedAt,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *RadiusRepository) GetSessionByAcctSessionID(ctx context.Context, acctSessionID string) (*radius.Session, error) {
	query := `
		SELECT id, tenant_id, router_id, voucher_id, acct_session_id, acct_unique_id,
			username, nas_ip_address, nas_port_id, framed_ip_address,
			calling_station_id, called_station_id, acct_start_time, acct_stop_time,
			acct_session_time, acct_input_octets, acct_output_octets,
			acct_input_packets, acct_output_packets, acct_terminate_cause,
			session_status, created_at, updated_at
		FROM radius_sessions
		WHERE acct_session_id = $1
		LIMIT 1
	`
	var s radius.Session
	err := r.db.QueryRow(ctx, query, acctSessionID).Scan(
		&s.ID, &s.TenantID, &s.RouterID, &s.VoucherID, &s.AcctSessionID,
		&s.AcctUniqueID, &s.Username, &s.NASIPAddress, &s.NASPortID,
		&s.FramedIPAddress, &s.CallingStationID, &s.CalledStationID,
		&s.AcctStartTime, &s.AcctStopTime, &s.AcctSessionTime,
		&s.AcctInputOctets, &s.AcctOutputOctets, &s.AcctInputPackets,
		&s.AcctOutputPackets, &s.AcctTerminateCause, &s.SessionStatus,
		&s.CreatedAt, &s.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &s, err
}

// HasActiveSession checks if voucher has any active session
func (r *RadiusRepository) HasActiveSession(ctx context.Context, voucherID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS (
			SELECT 1
			FROM radius_sessions
			WHERE voucher_id = $1 AND session_status = 'active'
		)
	`
	var hasActive bool
	err := r.db.QueryRow(ctx, query, voucherID).Scan(&hasActive)
	return hasActive, err
}

// GetActiveSessionsByVoucher returns all active sessions for a specific voucher
func (r *RadiusRepository) GetActiveSessionsByVoucher(ctx context.Context, voucherID uuid.UUID) ([]*radius.Session, error) {
	query := `
		SELECT id, tenant_id, router_id, voucher_id, acct_session_id, acct_unique_id,
			username, nas_ip_address, nas_port_id, framed_ip_address,
			calling_station_id, called_station_id, acct_start_time, acct_stop_time,
			acct_session_time, acct_input_octets, acct_output_octets,
			acct_input_packets, acct_output_packets, acct_terminate_cause,
			session_status, created_at, updated_at
		FROM radius_sessions
		WHERE voucher_id = $1 AND session_status = 'active'
	`
	rows, err := r.db.Query(ctx, query, voucherID)
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

// MarkStaleSessionsStopped marks all 'active' sessions that haven't received
// any accounting update (Interim-Update or Stop) within the given threshold as 'stopped'.
// This is the core fix for ghost/zombie sessions left behind after a FreeRADIUS or
// backend container restart where Acct-Stop packets were never delivered.
// Returns the number of sessions cleaned up.
func (r *RadiusRepository) MarkStaleSessionsStopped(ctx context.Context, threshold time.Duration) (int64, error) {
	query := `
		UPDATE radius_sessions
		SET
			session_status      = 'stopped',
			acct_terminate_cause = 'Lost-Carrier',
			acct_stop_time      = NOW(),
			updated_at          = NOW()
		WHERE
			session_status = 'active'
			AND updated_at < NOW() - $1::interval
	`
	tag, err := r.db.Exec(ctx, query, threshold.String())
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
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

// CloseSession marks a specific session as stopped with a terminate cause
func (r *RadiusRepository) CloseSession(ctx context.Context, acctSessionID string, cause string) error {
	query := `
		UPDATE radius_sessions
		SET
			session_status = 'stopped',
			acct_terminate_cause = $2,
			acct_stop_time = NOW(),
			updated_at = NOW()
		WHERE acct_session_id = $1
	`
	_, err := r.db.Exec(ctx, query, acctSessionID, cause)
	return err
}
