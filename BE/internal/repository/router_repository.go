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
			id, tenant_id, name, description, type, host, nas_ip, port,
			username, password_hash, api_port, status, last_seen, is_default,
			radius_enabled, radius_secret,
			connectivity_mode, api_use_tls,
			remote_access_enabled, remote_access_port,
			vpn_username, vpn_password, vpn_script,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
	`
	_, err := r.db.Exec(ctx, query,
		router.ID, router.TenantID, router.Name, router.Description,
		router.Type, router.Host, router.NASIP, router.Port, router.Username,
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
		SELECT id, tenant_id, name, description, type, host, nas_ip, port,
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
		&router.Type, &router.Host, &router.NASIP, &router.Port, &router.Username,
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
		SELECT id, tenant_id, name, description, type, host, nas_ip, port,
			username, password_hash, api_port, status, last_seen, is_default,
			radius_enabled, radius_secret,
			connectivity_mode, api_use_tls,
			COALESCE(remote_access_enabled, FALSE), COALESCE(remote_access_port, 0),
			COALESCE(vpn_username, ''), COALESCE(vpn_password, ''), COALESCE(vpn_script, ''),
			created_at, updated_at
		FROM routers
		WHERE tenant_id = $1
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
			&router.Type, &router.Host, &router.NASIP, &router.Port, &router.Username,
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
		SELECT id, tenant_id, name, description, type, host, nas_ip, port,
			username, password_hash, api_port, status, last_seen, is_default,
			radius_enabled, radius_secret,
			connectivity_mode, api_use_tls,
			COALESCE(remote_access_enabled, FALSE), COALESCE(remote_access_port, 0),
			COALESCE(vpn_username, ''), COALESCE(vpn_password, ''), COALESCE(vpn_script, ''),
			created_at, updated_at
		FROM routers
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
			&router.Type, &router.Host, &router.NASIP, &router.Port, &router.Username,
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
		SELECT id, tenant_id, name, description, type, host, nas_ip, port,
			username, password_hash, api_port, status, last_seen, is_default,
			radius_enabled, radius_secret,
			connectivity_mode, api_use_tls,
			COALESCE(remote_access_enabled, FALSE), COALESCE(remote_access_port, 0),
			COALESCE(vpn_username, ''), COALESCE(vpn_password, ''), COALESCE(vpn_script, ''),
			created_at, updated_at
		FROM routers
		WHERE tenant_id = $1 AND is_default = true
	`
	var router network.Router
	err := r.db.QueryRow(ctx, query, tenantID).Scan(
		&router.ID, &router.TenantID, &router.Name, &router.Description,
		&router.Type, &router.Host, &router.NASIP, &router.Port, &router.Username,
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
			name = $2, description = $3, type = $4, host = $5, nas_ip = $6, port = $7,
			username = $8, password_hash = $9, api_port = $10, status = $11,
			is_default = $12, radius_enabled = $13, radius_secret = $14,
			connectivity_mode = $15, api_use_tls = $16,
			remote_access_enabled = $17, remote_access_port = $18,
			vpn_username = $19, vpn_password = $20, vpn_script = $21,
			updated_at = $22
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		router.ID, router.Name, router.Description, router.Type,
		router.Host, router.NASIP, router.Port, router.Username, router.Password,
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
	query := `DELETE FROM routers WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *RouterRepository) CountByTenant(ctx context.Context, tenantID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM routers WHERE tenant_id = $1`
	var count int
	err := r.db.QueryRow(ctx, query, tenantID).Scan(&count)
	return count, err
}

func (r *RouterRepository) GetByNASIP(ctx context.Context, nasIP string) (*network.Router, error) {
	query := `
		SELECT id, tenant_id, name, description, type, host, nas_ip, port,
			username, password_hash, api_port, status, last_seen, is_default,
			radius_enabled, radius_secret,
			connectivity_mode, api_use_tls,
			COALESCE(remote_access_enabled, FALSE), COALESCE(remote_access_port, 0),
			COALESCE(vpn_username, ''), COALESCE(vpn_password, ''), COALESCE(vpn_script, ''),
			created_at, updated_at
		FROM routers
		WHERE nas_ip = $1 AND radius_enabled = true
		LIMIT 1
	`
	var router network.Router
	err := r.db.QueryRow(ctx, query, nasIP).Scan(
		&router.ID, &router.TenantID, &router.Name, &router.Description,
		&router.Type, &router.Host, &router.NASIP, &router.Port, &router.Username,
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
