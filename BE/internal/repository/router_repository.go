package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/network"
)

type RouterRepository struct {
	db *pgxpool.Pool
}

func NewRouterRepository(db *pgxpool.Pool) *RouterRepository {
	return &RouterRepository{db: db}
}

func (r *RouterRepository) Create(ctx context.Context, router *network.Router) error {
	query := `
		INSERT INTO routers (
			id, tenant_id, name, description, type, host, nas_identifier, nas_ip, port,
			username, password_hash, api_port, status, last_seen, is_default,
			radius_enabled, radius_secret,
			connectivity_mode, api_use_tls,
			remote_access_enabled, remote_access_port,
			vpn_username, vpn_password, vpn_script,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
	`
	_, err := r.db.Exec(ctx, query,
		router.ID, router.TenantID, router.Name, router.Description,
		router.Type, router.Host, router.NASIdentifier, router.NASIP, router.Port, router.Username,
		router.Password, router.APIPort, router.Status, router.LastSeen, router.IsDefault,
		router.RadiusEnabled, router.RadiusSecret,
		router.ConnectivityMode, router.APIUseTLS,
		router.RemoteAccessEnabled, router.RemoteAccessPort,
		router.VPNUsername, router.VPNPassword, router.VPNScript,
		router.CreatedAt, router.UpdatedAt,
	)
	return err
}

func (r *RouterRepository) GetByID(ctx context.Context, id uuid.UUID) (*network.Router, error) {
	query := `
		SELECT id, tenant_id, name, description, type, host, nas_identifier, nas_ip, port,
			username, password_hash, api_port, status, last_seen, is_default,
			radius_enabled, radius_secret,
			connectivity_mode, api_use_tls,
			COALESCE(remote_access_enabled, FALSE), COALESCE(remote_access_port, 0),
			COALESCE(vpn_username, ''), COALESCE(vpn_password, ''), COALESCE(vpn_script, ''),
			created_at, updated_at
		FROM routers
		WHERE id = $1
	`
	var router network.Router
	err := r.db.QueryRow(ctx, query, id).Scan(
		&router.ID, &router.TenantID, &router.Name, &router.Description,
		&router.Type, &router.Host, &router.NASIdentifier, &router.NASIP, &router.Port, &router.Username,
		&router.Password, &router.APIPort, &router.Status, &router.LastSeen,
		&router.IsDefault, &router.RadiusEnabled, &router.RadiusSecret,
		&router.ConnectivityMode, &router.APIUseTLS,
		&router.RemoteAccessEnabled, &router.RemoteAccessPort,
		&router.VPNUsername, &router.VPNPassword, &router.VPNScript,
		&router.CreatedAt, &router.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("router not found")
	}
	return &router, err
}

func (r *RouterRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*network.Router, error) {
	query := `
		SELECT id, tenant_id, name, description, type, host, nas_identifier, nas_ip, port,
			username, password_hash, api_port, status, last_seen, is_default,
			radius_enabled, radius_secret,
			connectivity_mode, api_use_tls,
			COALESCE(remote_access_enabled, FALSE), COALESCE(remote_access_port, 0),
			COALESCE(vpn_username, ''), COALESCE(vpn_password, ''), COALESCE(vpn_script, ''),
			created_at, updated_at
		FROM routers
		WHERE tenant_id = $1 AND deleted_at IS NULL
		ORDER BY is_default DESC, name ASC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var routers []*network.Router
	for rows.Next() {
		var router network.Router
		err := rows.Scan(
			&router.ID, &router.TenantID, &router.Name, &router.Description,
			&router.Type, &router.Host, &router.NASIdentifier, &router.NASIP, &router.Port, &router.Username,
			&router.Password, &router.APIPort, &router.Status, &router.LastSeen,
			&router.IsDefault, &router.RadiusEnabled, &router.RadiusSecret,
			&router.ConnectivityMode, &router.APIUseTLS,
			&router.RemoteAccessEnabled, &router.RemoteAccessPort,
			&router.VPNUsername, &router.VPNPassword, &router.VPNScript,
			&router.CreatedAt, &router.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		routers = append(routers, &router)
	}
	return routers, nil
}

func (r *RouterRepository) ListAll(ctx context.Context) ([]*network.Router, error) {
	query := `
		SELECT id, tenant_id, name, description, type, host, nas_identifier, nas_ip, port,
			username, password_hash, api_port, status, last_seen, is_default,
			radius_enabled, radius_secret,
			connectivity_mode, api_use_tls,
			COALESCE(remote_access_enabled, FALSE), COALESCE(remote_access_port, 0),
			COALESCE(vpn_username, ''), COALESCE(vpn_password, ''), COALESCE(vpn_script, ''),
			created_at, updated_at
		FROM routers WHERE deleted_at IS NULL
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list all routers: %w", err)
	}
	defer rows.Close()

	var routers []*network.Router
	for rows.Next() {
		var router network.Router
		err := rows.Scan(
			&router.ID, &router.TenantID, &router.Name, &router.Description,
			&router.Type, &router.Host, &router.NASIdentifier, &router.NASIP, &router.Port, &router.Username,
			&router.Password, &router.APIPort, &router.Status, &router.LastSeen,
			&router.IsDefault, &router.RadiusEnabled, &router.RadiusSecret,
			&router.ConnectivityMode, &router.APIUseTLS,
			&router.RemoteAccessEnabled, &router.RemoteAccessPort,
			&router.VPNUsername, &router.VPNPassword, &router.VPNScript,
			&router.CreatedAt, &router.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan router: %w", err)
		}
		routers = append(routers, &router)
	}
	return routers, nil
}

func (r *RouterRepository) GetDefaultByTenant(ctx context.Context, tenantID uuid.UUID) (*network.Router, error) {
	query := `
		SELECT id, tenant_id, name, description, type, host, nas_identifier, nas_ip, port,
			username, password_hash, api_port, status, last_seen, is_default,
			radius_enabled, radius_secret,
			connectivity_mode, api_use_tls,
			COALESCE(remote_access_enabled, FALSE), COALESCE(remote_access_port, 0),
			COALESCE(vpn_username, ''), COALESCE(vpn_password, ''), COALESCE(vpn_script, ''),
			created_at, updated_at
		FROM routers
		WHERE tenant_id = $1 AND is_default = true AND deleted_at IS NULL
	`
	var router network.Router
	err := r.db.QueryRow(ctx, query, tenantID).Scan(
		&router.ID, &router.TenantID, &router.Name, &router.Description,
		&router.Type, &router.Host, &router.NASIdentifier, &router.NASIP, &router.Port, &router.Username,
		&router.Password, &router.APIPort, &router.Status, &router.LastSeen,
		&router.IsDefault, &router.RadiusEnabled, &router.RadiusSecret,
		&router.ConnectivityMode, &router.APIUseTLS,
		&router.RemoteAccessEnabled, &router.RemoteAccessPort,
		&router.VPNUsername, &router.VPNPassword, &router.VPNScript,
		&router.CreatedAt, &router.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil // No default router
	}
	return &router, err
}

func (r *RouterRepository) Update(ctx context.Context, router *network.Router) error {
	query := `
		UPDATE routers SET
			name = $2, description = $3, type = $4, host = $5, nas_identifier = $6, nas_ip = $7, port = $8,
			username = $9, password_hash = $10, api_port = $11, status = $12,
			is_default = $13, radius_enabled = $14, radius_secret = $15,
			connectivity_mode = $16, api_use_tls = $17,
			remote_access_enabled = $18, remote_access_port = $19,
			vpn_username = $20, vpn_password = $21, vpn_script = $22,
			updated_at = $23
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		router.ID, router.Name, router.Description, router.Type,
		router.Host, router.NASIdentifier, router.NASIP, router.Port, router.Username, router.Password,
		router.APIPort, router.Status, router.IsDefault,
		router.RadiusEnabled, router.RadiusSecret,
		router.ConnectivityMode, router.APIUseTLS,
		router.RemoteAccessEnabled, router.RemoteAccessPort,
		router.VPNUsername, router.VPNPassword, router.VPNScript,
		router.UpdatedAt,
	)
	return err
}

func (r *RouterRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status network.RouterStatus) error {
	// Only bump last_seen when router is reachable (online). If we mark offline,
	// we keep last_seen as the last known successful contact time.
	if status == network.RouterStatusOnline {
		query := `UPDATE routers SET status = $2, last_seen = NOW(), updated_at = NOW() WHERE id = $1`
		_, err := r.db.Exec(ctx, query, id, status)
		return err
	}
	query := `UPDATE routers SET status = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, status)
	return err
}

func (r *RouterRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Soft delete
	query := `UPDATE routers SET status = 'revoked', deleted_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *RouterRepository) HardDelete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM routers WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *RouterRepository) GetPurgeableRouters(ctx context.Context, retentionDays int) ([]*network.Router, error) {
	query := `
		SELECT id, tenant_id, name
		FROM routers
		WHERE deleted_at < NOW() - ($1 || ' days')::INTERVAL
	`
	rows, err := r.db.Query(ctx, query, retentionDays)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var routers []*network.Router
	for rows.Next() {
		var router network.Router
		if err := rows.Scan(&router.ID, &router.TenantID, &router.Name); err != nil {
			return nil, err
		}
		routers = append(routers, &router)
	}
	return routers, nil
}

func (r *RouterRepository) CountByTenant(ctx context.Context, tenantID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM routers WHERE tenant_id = $1 AND deleted_at IS NULL`
	var count int
	err := r.db.QueryRow(ctx, query, tenantID).Scan(&count)
	return count, err
}

func (r *RouterRepository) GetByNASIP(ctx context.Context, nasIP string) (*network.Router, error) {
	query := `
		SELECT id, tenant_id, name, description, type, host, nas_identifier, nas_ip, port,
			username, password_hash, api_port, status, last_seen, is_default,
			radius_enabled, radius_secret,
			connectivity_mode, api_use_tls,
			COALESCE(remote_access_enabled, FALSE), COALESCE(remote_access_port, 0),
			COALESCE(vpn_username, ''), COALESCE(vpn_password, ''), COALESCE(vpn_script, ''),
			created_at, updated_at
		FROM routers
		WHERE nas_ip = $1 AND radius_enabled = true AND deleted_at IS NULL
		LIMIT 1
	`
	var router network.Router
	err := r.db.QueryRow(ctx, query, nasIP).Scan(
		&router.ID, &router.TenantID, &router.Name, &router.Description,
		&router.Type, &router.Host, &router.NASIdentifier, &router.NASIP, &router.Port, &router.Username,
		&router.Password, &router.APIPort, &router.Status, &router.LastSeen,
		&router.IsDefault, &router.RadiusEnabled, &router.RadiusSecret,
		&router.ConnectivityMode, &router.APIUseTLS,
		&router.RemoteAccessEnabled, &router.RemoteAccessPort,
		&router.VPNUsername, &router.VPNPassword, &router.VPNScript,
		&router.CreatedAt, &router.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("router not found for NAS-IP: %s", nasIP)
	}
	return &router, err
}

func (r *RouterRepository) GetByNASIdentifier(ctx context.Context, nasID string) (*network.Router, error) {
	// We intentionally do NOT filter by deleted_at here, because we want to find revoked routers
	// so we can explicitly reject them in the Radius Handler with a clear reason.
	query := `
		SELECT id, tenant_id, name, description, type, host, nas_identifier, nas_ip, port,
			username, password_hash, api_port, status, last_seen, is_default,
			radius_enabled, radius_secret,
			connectivity_mode, api_use_tls,
			COALESCE(remote_access_enabled, FALSE), COALESCE(remote_access_port, 0),
			COALESCE(vpn_username, ''), COALESCE(vpn_password, ''), COALESCE(vpn_script, ''),
			created_at, updated_at, deleted_at
		FROM routers
		WHERE nas_identifier = $1
		LIMIT 1
	`
	var router network.Router
	err := r.db.QueryRow(ctx, query, nasID).Scan(
		&router.ID, &router.TenantID, &router.Name, &router.Description,
		&router.Type, &router.Host, &router.NASIdentifier, &router.NASIP, &router.Port, &router.Username,
		&router.Password, &router.APIPort, &router.Status, &router.LastSeen,
		&router.IsDefault, &router.RadiusEnabled, &router.RadiusSecret,
		&router.ConnectivityMode, &router.APIUseTLS,
		&router.RemoteAccessEnabled, &router.RemoteAccessPort,
		&router.VPNUsername, &router.VPNPassword, &router.VPNScript,
		&router.CreatedAt, &router.UpdatedAt, &router.DeletedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("router not found for NAS-Identifier: %s", nasID)
	}
	return &router, err
}

func (r *RouterRepository) UpdateNASIP(ctx context.Context, id uuid.UUID, newIP string) error {
	query := `UPDATE routers SET nas_ip = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, newIP)
	return err
}
