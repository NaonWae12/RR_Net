package repository

import (
	"context"
	"encoding/binary"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/network"
)

type PPPoERepository struct {
	db *pgxpool.Pool
}

func NewPPPoERepository(db *pgxpool.Pool) *PPPoERepository {
	return &PPPoERepository{db: db}
}

func (r *PPPoERepository) Create(ctx context.Context, secret *network.PPPoESecret) error {
	query := `
		INSERT INTO pppoe_secrets (
			id, tenant_id, client_id, router_id, profile_id, username, password_hash,
			service, caller_id, remote_address, local_address, comment,
			is_disabled, last_connected_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`
	_, err := r.db.Exec(ctx, query,
		secret.ID, secret.TenantID, secret.ClientID, secret.RouterID, secret.ProfileID,
		secret.Username, secret.Password,
		secret.Service, secret.CallerID, secret.RemoteAddress, secret.LocalAddress, secret.Comment,
		secret.IsDisabled, secret.LastConnectedAt, secret.CreatedAt, secret.UpdatedAt,
	)
	return err
}

func (r *PPPoERepository) GetByID(ctx context.Context, id uuid.UUID) (*network.PPPoESecret, error) {
	query := `
		SELECT id, tenant_id, client_id, router_id, profile_id, username, password_hash,
			service, caller_id, remote_address, local_address, comment,
			is_disabled, last_connected_at, created_at, updated_at
		FROM pppoe_secrets
		WHERE id = $1
	`
	var secret network.PPPoESecret
	err := r.db.QueryRow(ctx, query, id).Scan(
		&secret.ID, &secret.TenantID, &secret.ClientID, &secret.RouterID, &secret.ProfileID,
		&secret.Username, &secret.Password,
		&secret.Service, &secret.CallerID, &secret.RemoteAddress, &secret.LocalAddress, &secret.Comment,
		&secret.IsDisabled, &secret.LastConnectedAt, &secret.CreatedAt, &secret.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("PPPoE secret not found")
	}
	return &secret, err
}

func (r *PPPoERepository) GetByUsername(ctx context.Context, tenantID uuid.UUID, username string) (*network.PPPoESecret, error) {
	query := `
		SELECT id, tenant_id, client_id, router_id, profile_id, username, password_hash,
			service, caller_id, remote_address, local_address, comment,
			is_disabled, last_connected_at, created_at, updated_at
		FROM pppoe_secrets
		WHERE tenant_id = $1 AND username = $2
	`
	var secret network.PPPoESecret
	err := r.db.QueryRow(ctx, query, tenantID, username).Scan(
		&secret.ID, &secret.TenantID, &secret.ClientID, &secret.RouterID, &secret.ProfileID,
		&secret.Username, &secret.Password,
		&secret.Service, &secret.CallerID, &secret.RemoteAddress, &secret.LocalAddress, &secret.Comment,
		&secret.IsDisabled, &secret.LastConnectedAt, &secret.CreatedAt, &secret.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("PPPoE secret not found")
	}
	return &secret, err
}

func (r *PPPoERepository) GetByClientID(ctx context.Context, clientID uuid.UUID) ([]*network.PPPoESecret, error) {
	query := `
		SELECT id, tenant_id, client_id, router_id, profile_id, username, password_hash,
			service, caller_id, remote_address, local_address, comment,
			is_disabled, last_connected_at, created_at, updated_at
		FROM pppoe_secrets
		WHERE client_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var secrets []*network.PPPoESecret
	for rows.Next() {
		var secret network.PPPoESecret
		err := rows.Scan(
			&secret.ID, &secret.TenantID, &secret.ClientID, &secret.RouterID, &secret.ProfileID,
			&secret.Username, &secret.Password,
			&secret.Service, &secret.CallerID, &secret.RemoteAddress, &secret.LocalAddress, &secret.Comment,
			&secret.IsDisabled, &secret.LastConnectedAt, &secret.CreatedAt, &secret.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		secrets = append(secrets, &secret)
	}
	return secrets, nil
}

func (r *PPPoERepository) ListByTenant(ctx context.Context, tenantID uuid.UUID, routerID *uuid.UUID, clientID *uuid.UUID, disabled *bool, limit, offset int) ([]*network.PPPoESecret, int, error) {
	baseQuery := `
		SELECT id, tenant_id, client_id, router_id, profile_id, username, password_hash,
			service, caller_id, remote_address, local_address, comment,
			is_disabled, last_connected_at, created_at, updated_at
		FROM pppoe_secrets
		WHERE tenant_id = $1
	`
	countQuery := `SELECT COUNT(*) FROM pppoe_secrets WHERE tenant_id = $1`

	args := []interface{}{tenantID}
	countArgs := []interface{}{tenantID}
	argIdx := 2

	if routerID != nil {
		baseQuery += fmt.Sprintf(" AND router_id = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND router_id = $%d", argIdx)
		args = append(args, *routerID)
		countArgs = append(countArgs, *routerID)
		argIdx++
	}

	if clientID != nil {
		baseQuery += fmt.Sprintf(" AND client_id = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND client_id = $%d", argIdx)
		args = append(args, *clientID)
		countArgs = append(countArgs, *clientID)
		argIdx++
	}

	if disabled != nil {
		baseQuery += fmt.Sprintf(" AND is_disabled = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND is_disabled = $%d", argIdx)
		args = append(args, *disabled)
		countArgs = append(countArgs, *disabled)
		argIdx++
	}

	baseQuery += " ORDER BY created_at DESC"

	if limit > 0 {
		baseQuery += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, limit)
		argIdx++
	}
	if offset > 0 {
		baseQuery += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, offset)
	}

	// Get total count
	var total int
	err := r.db.QueryRow(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get secrets
	rows, err := r.db.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var secrets []*network.PPPoESecret
	for rows.Next() {
		var secret network.PPPoESecret
		err := rows.Scan(
			&secret.ID, &secret.TenantID, &secret.ClientID, &secret.RouterID, &secret.ProfileID,
			&secret.Username, &secret.Password,
			&secret.Service, &secret.CallerID, &secret.RemoteAddress, &secret.LocalAddress, &secret.Comment,
			&secret.IsDisabled, &secret.LastConnectedAt, &secret.CreatedAt, &secret.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		secrets = append(secrets, &secret)
	}
	return secrets, total, nil
}

func (r *PPPoERepository) ListByRouter(ctx context.Context, routerID uuid.UUID) ([]*network.PPPoESecret, error) {
	query := `
		SELECT id, tenant_id, client_id, router_id, profile_id, username, password_hash,
			service, caller_id, remote_address, local_address, comment,
			is_disabled, last_connected_at, created_at, updated_at
		FROM pppoe_secrets
		WHERE router_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, routerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var secrets []*network.PPPoESecret
	for rows.Next() {
		var secret network.PPPoESecret
		err := rows.Scan(
			&secret.ID, &secret.TenantID, &secret.ClientID, &secret.RouterID, &secret.ProfileID,
			&secret.Username, &secret.Password,
			&secret.Service, &secret.CallerID, &secret.RemoteAddress, &secret.LocalAddress, &secret.Comment,
			&secret.IsDisabled, &secret.LastConnectedAt, &secret.CreatedAt, &secret.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		secrets = append(secrets, &secret)
	}
	return secrets, nil
}

func (r *PPPoERepository) Update(ctx context.Context, secret *network.PPPoESecret) error {
	query := `
		UPDATE pppoe_secrets SET
			client_id = $2, router_id = $3, profile_id = $4, username = $5, password_hash = $6,
			service = $7, caller_id = $8, remote_address = $9, local_address = $10, comment = $11,
			is_disabled = $12, last_connected_at = $13, updated_at = $14
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		secret.ID, secret.ClientID, secret.RouterID, secret.ProfileID, secret.Username, secret.Password,
		secret.Service, secret.CallerID, secret.RemoteAddress, secret.LocalAddress, secret.Comment,
		secret.IsDisabled, secret.LastConnectedAt, secret.UpdatedAt,
	)
	return err
}

func (r *PPPoERepository) UpdateStatus(ctx context.Context, id uuid.UUID, disabled bool) error {
	query := `
		UPDATE pppoe_secrets SET
			is_disabled = $2, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, disabled)
	return err
}

func (r *PPPoERepository) UpdateLastConnectedAt(ctx context.Context, id uuid.UUID, connectedAt time.Time) error {
	query := `
		UPDATE pppoe_secrets SET
			last_connected_at = $2, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, connectedAt)
	return err
}

func (r *PPPoERepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM pppoe_secrets WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *PPPoERepository) CheckIPConflict(ctx context.Context, tenantID uuid.UUID, localIP, remoteIP string) (bool, string, error) {
	return r.CheckIPConflictWithExclude(ctx, tenantID, nil, localIP, remoteIP)
}

func (r *PPPoERepository) CheckIPConflictWithExclude(ctx context.Context, tenantID uuid.UUID, excludeID *uuid.UUID, localIP, remoteIP string) (bool, string, error) {
	localIP = strings.TrimSpace(localIP)
	remoteIP = strings.TrimSpace(remoteIP)

	if remoteIP != "" {
		var exists bool
		var existingUsername string
		query := `
			SELECT EXISTS(
				SELECT 1 FROM pppoe_secrets 
				WHERE tenant_id = $1 AND remote_address = $2 AND ($3::uuid IS NULL OR id != $3)
			)
		`
		err := r.db.QueryRow(ctx, query, tenantID, remoteIP, excludeID).Scan(&exists)
		if err != nil {
			return false, "", err
		}
		if exists {
			_ = r.db.QueryRow(ctx, `SELECT username FROM pppoe_secrets WHERE tenant_id = $1 AND remote_address = $2 LIMIT 1`, tenantID, remoteIP).Scan(&existingUsername)
			msg := fmt.Sprintf("IP Remote %s sudah digunakan oleh secret '%s'", remoteIP, existingUsername)
			if existingUsername == "" {
				msg = fmt.Sprintf("IP Remote %s sudah digunakan oleh PPPoE secret lain", remoteIP)
			}
			return true, msg, nil
		}
	}

	return false, "", nil
}

func (r *PPPoERepository) GetIPSettings(ctx context.Context, tenantID uuid.UUID, routerID *uuid.UUID) (*network.PPPoEIPSettings, error) {
	// First check if router specific settings exist
	if routerID != nil {
		query := `
			SELECT id, tenant_id, router_id, local_address, pool_start, pool_end, created_at, updated_at
			FROM pppoe_ip_settings
			WHERE tenant_id = $1 AND router_id = $2
		`
		var s network.PPPoEIPSettings
		err := r.db.QueryRow(ctx, query, tenantID, routerID).Scan(
			&s.ID, &s.TenantID, &s.RouterID, &s.LocalAddress, &s.PoolStart, &s.PoolEnd, &s.CreatedAt, &s.UpdatedAt,
		)
		if err == nil {
			return &s, nil
		}
	}

	// Fallback to global tenant settings (router_id IS NULL)
	queryGlobal := `
		SELECT id, tenant_id, router_id, local_address, pool_start, pool_end, created_at, updated_at
		FROM pppoe_ip_settings
		WHERE tenant_id = $1 AND router_id IS NULL
	`
	var s network.PPPoEIPSettings
	err := r.db.QueryRow(ctx, queryGlobal, tenantID).Scan(
		&s.ID, &s.TenantID, &s.RouterID, &s.LocalAddress, &s.PoolStart, &s.PoolEnd, &s.CreatedAt, &s.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil // No settings configured yet
	}
	return &s, err
}

func (r *PPPoERepository) UpsertIPSettings(ctx context.Context, settings *network.PPPoEIPSettings) error {
	now := time.Now()
	// Check existing row
	var existingID uuid.UUID
	var queryCheck string
	var err error

	if settings.RouterID != nil {
		queryCheck = `SELECT id FROM pppoe_ip_settings WHERE tenant_id = $1 AND router_id = $2`
		err = r.db.QueryRow(ctx, queryCheck, settings.TenantID, settings.RouterID).Scan(&existingID)
	} else {
		queryCheck = `SELECT id FROM pppoe_ip_settings WHERE tenant_id = $1 AND router_id IS NULL`
		err = r.db.QueryRow(ctx, queryCheck, settings.TenantID).Scan(&existingID)
	}

	if err == nil {
		// Update
		queryUpdate := `
			UPDATE pppoe_ip_settings 
			SET local_address = $1, pool_start = $2, pool_end = $3, updated_at = $4
			WHERE id = $5
		`
		_, err = r.db.Exec(ctx, queryUpdate, settings.LocalAddress, settings.PoolStart, settings.PoolEnd, now, existingID)
		return err
	}

	// Insert
	if settings.ID == uuid.Nil {
		settings.ID = uuid.New()
	}
	queryInsert := `
		INSERT INTO pppoe_ip_settings (id, tenant_id, router_id, local_address, pool_start, pool_end, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err = r.db.Exec(ctx, queryInsert, settings.ID, settings.TenantID, settings.RouterID, settings.LocalAddress, settings.PoolStart, settings.PoolEnd, now, now)
	return err
}

func (r *PPPoERepository) GetNextAvailableRemoteIP(ctx context.Context, tenantID uuid.UUID, poolStart, poolEnd string) (string, error) {
	poolStart = strings.TrimSpace(poolStart)
	poolEnd = strings.TrimSpace(poolEnd)

	if poolStart == "" || poolEnd == "" {
		return "", nil
	}

	startNum, err := ipToUint32(poolStart)
	if err != nil {
		return "", fmt.Errorf("invalid pool start IP: %w", err)
	}
	endNum, err := ipToUint32(poolEnd)
	if err != nil {
		return "", fmt.Errorf("invalid pool end IP: %w", err)
	}

	if startNum > endNum {
		startNum, endNum = endNum, startNum
	}

	// Fetch all used remote addresses in this tenant
	query := `SELECT remote_address FROM pppoe_secrets WHERE tenant_id = $1 AND remote_address IS NOT NULL AND remote_address != ''`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	usedIPs := make(map[uint32]bool)
	for rows.Next() {
		var addr string
		if err := rows.Scan(&addr); err == nil && addr != "" {
			if ipNum, err := ipToUint32(addr); err == nil {
				usedIPs[ipNum] = true
			}
		}
	}

	// Find first unused IP in range
	for num := startNum; num <= endNum; num++ {
		if !usedIPs[num] {
			return uint32ToIP(num), nil
		}
	}

	return "", fmt.Errorf("IP pool exhausted (all IPs from %s to %s are in use)", poolStart, poolEnd)
}

func ipToUint32(ipStr string) (uint32, error) {
	ip := net.ParseIP(strings.TrimSpace(ipStr)).To4()
	if ip == nil {
		return 0, fmt.Errorf("invalid IPv4 address: %s", ipStr)
	}
	return binary.BigEndian.Uint32(ip), nil
}

func uint32ToIP(n uint32) string {
	ip := make(net.IP, 4)
	binary.BigEndian.PutUint32(ip, n)
	return ip.String()
}
