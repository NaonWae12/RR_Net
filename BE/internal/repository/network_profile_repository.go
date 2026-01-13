package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/network"
)

type NetworkProfileRepository struct {
	db *pgxpool.Pool
}

func NewNetworkProfileRepository(db *pgxpool.Pool) *NetworkProfileRepository {
	return &NetworkProfileRepository{db: db}
}

func (r *NetworkProfileRepository) Create(ctx context.Context, profile *network.NetworkProfile) error {
	query := `
		INSERT INTO network_profiles (
			id, tenant_id, name, description, download_speed, upload_speed,
			burst_download, burst_upload, priority, shared_users,
			address_pool, local_address, remote_address, dns_servers,
			is_active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`
	_, err := r.db.Exec(ctx, query,
		profile.ID, profile.TenantID, profile.Name, profile.Description,
		profile.DownloadSpeed, profile.UploadSpeed, profile.BurstDownload, profile.BurstUpload,
		profile.Priority, profile.SharedUsers, profile.AddressPool,
		profile.LocalAddress, profile.RemoteAddress, profile.DNSServers,
		profile.IsActive, profile.CreatedAt, profile.UpdatedAt,
	)
	return err
}

func (r *NetworkProfileRepository) GetByID(ctx context.Context, id uuid.UUID) (*network.NetworkProfile, error) {
	query := `
		SELECT id, tenant_id, name, description, download_speed, upload_speed,
			burst_download, burst_upload, priority, shared_users,
			address_pool, local_address, remote_address, dns_servers,
			is_active, created_at, updated_at
		FROM network_profiles
		WHERE id = $1
	`
	var profile network.NetworkProfile
	err := r.db.QueryRow(ctx, query, id).Scan(
		&profile.ID, &profile.TenantID, &profile.Name, &profile.Description,
		&profile.DownloadSpeed, &profile.UploadSpeed, &profile.BurstDownload, &profile.BurstUpload,
		&profile.Priority, &profile.SharedUsers, &profile.AddressPool,
		&profile.LocalAddress, &profile.RemoteAddress, &profile.DNSServers,
		&profile.IsActive, &profile.CreatedAt, &profile.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("network profile not found")
	}
	return &profile, err
}

func (r *NetworkProfileRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID, activeOnly bool) ([]*network.NetworkProfile, error) {
	query := `
		SELECT id, tenant_id, name, description, download_speed, upload_speed,
			burst_download, burst_upload, priority, shared_users,
			address_pool, local_address, remote_address, dns_servers,
			is_active, created_at, updated_at
		FROM network_profiles
		WHERE tenant_id = $1
	`
	if activeOnly {
		query += " AND is_active = true"
	}
	query += " ORDER BY name ASC"

	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var profiles []*network.NetworkProfile
	for rows.Next() {
		var profile network.NetworkProfile
		err := rows.Scan(
			&profile.ID, &profile.TenantID, &profile.Name, &profile.Description,
			&profile.DownloadSpeed, &profile.UploadSpeed, &profile.BurstDownload, &profile.BurstUpload,
			&profile.Priority, &profile.SharedUsers, &profile.AddressPool,
			&profile.LocalAddress, &profile.RemoteAddress, &profile.DNSServers,
			&profile.IsActive, &profile.CreatedAt, &profile.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		profiles = append(profiles, &profile)
	}
	return profiles, nil
}

func (r *NetworkProfileRepository) Update(ctx context.Context, profile *network.NetworkProfile) error {
	query := `
		UPDATE network_profiles SET
			name = $2, description = $3, download_speed = $4, upload_speed = $5,
			burst_download = $6, burst_upload = $7, priority = $8, shared_users = $9,
			address_pool = $10, local_address = $11, remote_address = $12, dns_servers = $13,
			is_active = $14, updated_at = $15
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		profile.ID, profile.Name, profile.Description,
		profile.DownloadSpeed, profile.UploadSpeed, profile.BurstDownload, profile.BurstUpload,
		profile.Priority, profile.SharedUsers, profile.AddressPool,
		profile.LocalAddress, profile.RemoteAddress, profile.DNSServers,
		profile.IsActive, profile.UpdatedAt,
	)
	return err
}

func (r *NetworkProfileRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM network_profiles WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}


