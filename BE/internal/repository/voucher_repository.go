package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/voucher"
)

type VoucherRepository struct {
	db *pgxpool.Pool
}

func NewVoucherRepository(db *pgxpool.Pool) *VoucherRepository {
	return &VoucherRepository{db: db}
}

// ========== Voucher Packages ==========

func (r *VoucherRepository) CreatePackage(ctx context.Context, pkg *voucher.VoucherPackage) error {
	query := `
		INSERT INTO voucher_packages (
			id, tenant_id, name, description, download_speed, upload_speed,
			duration_hours, quota_mb, price, currency, rate_limit_mode, is_active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`
	_, err := r.db.Exec(ctx, query,
		pkg.ID, pkg.TenantID, pkg.Name, pkg.Description, pkg.DownloadSpeed, pkg.UploadSpeed,
		pkg.DurationHours, pkg.QuotaMB, pkg.Price, pkg.Currency, pkg.RateLimitMode, pkg.IsActive,
		pkg.CreatedAt, pkg.UpdatedAt,
	)
	return err
}

func (r *VoucherRepository) GetPackageByID(ctx context.Context, id uuid.UUID) (*voucher.VoucherPackage, error) {
	query := `
		SELECT id, tenant_id, name, COALESCE(description, ''), download_speed, upload_speed,
			duration_hours, quota_mb, price::float8, currency, rate_limit_mode, is_active, created_at, updated_at
		FROM voucher_packages
		WHERE id = $1
	`
	var pkg voucher.VoucherPackage
	err := r.db.QueryRow(ctx, query, id).Scan(
		&pkg.ID, &pkg.TenantID, &pkg.Name, &pkg.Description, &pkg.DownloadSpeed, &pkg.UploadSpeed,
		&pkg.DurationHours, &pkg.QuotaMB, &pkg.Price, &pkg.Currency, &pkg.RateLimitMode, &pkg.IsActive,
		&pkg.CreatedAt, &pkg.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("package not found")
	}
	return &pkg, err
}

func (r *VoucherRepository) ListPackagesByTenant(ctx context.Context, tenantID uuid.UUID, activeOnly bool) ([]*voucher.VoucherPackage, error) {
	query := `
		SELECT id, tenant_id, name, COALESCE(description, ''), download_speed, upload_speed,
			duration_hours, quota_mb, price::float8, currency, rate_limit_mode, is_active, created_at, updated_at
		FROM voucher_packages
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

	var packages []*voucher.VoucherPackage
	for rows.Next() {
		var pkg voucher.VoucherPackage
		err := rows.Scan(
			&pkg.ID, &pkg.TenantID, &pkg.Name, &pkg.Description, &pkg.DownloadSpeed, &pkg.UploadSpeed,
			&pkg.DurationHours, &pkg.QuotaMB, &pkg.Price, &pkg.Currency, &pkg.RateLimitMode, &pkg.IsActive,
			&pkg.CreatedAt, &pkg.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		packages = append(packages, &pkg)
	}
	return packages, nil
}

func (r *VoucherRepository) UpdatePackage(ctx context.Context, pkg *voucher.VoucherPackage) error {
	query := `
		UPDATE voucher_packages SET
			name = $2, description = $3, download_speed = $4, upload_speed = $5,
			duration_hours = $6, quota_mb = $7, price = $8, currency = $9,
			rate_limit_mode = $10, is_active = $11, updated_at = $12
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		pkg.ID, pkg.Name, pkg.Description, pkg.DownloadSpeed, pkg.UploadSpeed,
		pkg.DurationHours, pkg.QuotaMB, pkg.Price, pkg.Currency, pkg.RateLimitMode, pkg.IsActive, pkg.UpdatedAt,
	)
	return err
}

func (r *VoucherRepository) DeletePackage(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM voucher_packages WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// ========== Vouchers ==========

func (r *VoucherRepository) CreateVoucher(ctx context.Context, v *voucher.Voucher) error {
	query := `
		INSERT INTO vouchers (
			id, tenant_id, package_id, router_id, code, password, status,
			used_at, expires_at, first_session_id, notes, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	_, err := r.db.Exec(ctx, query,
		v.ID, v.TenantID, v.PackageID, v.RouterID, v.Code, v.Password, v.Status,
		v.UsedAt, v.ExpiresAt, v.FirstSessionID, v.Notes, v.CreatedAt, v.UpdatedAt,
	)
	return err
}

func (r *VoucherRepository) GetVoucherByCode(ctx context.Context, tenantID uuid.UUID, code string) (*voucher.Voucher, error) {
	query := `
		SELECT v.id, v.tenant_id, v.package_id, v.router_id, v.code, COALESCE(v.password, ''), v.status, v.isolated,
			v.used_at, v.expires_at, v.first_session_id, COALESCE(v.notes, ''), v.created_at, v.updated_at,
			p.name as package_name
		FROM vouchers v
		JOIN voucher_packages p ON v.package_id = p.id
		WHERE v.tenant_id = $1 AND v.code = $2
	`
	var v voucher.Voucher
	err := r.db.QueryRow(ctx, query, tenantID, code).Scan(
		&v.ID, &v.TenantID, &v.PackageID, &v.RouterID, &v.Code, &v.Password, &v.Status, &v.Isolated,
		&v.UsedAt, &v.ExpiresAt, &v.FirstSessionID, &v.Notes, &v.CreatedAt, &v.UpdatedAt,
		&v.PackageName,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("voucher not found")
	}
	return &v, err
}

func (r *VoucherRepository) ListVouchersByTenant(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*voucher.Voucher, error) {
	query := `
		SELECT v.id, v.tenant_id, v.package_id, v.router_id, v.code, COALESCE(v.password, ''), v.status, v.isolated,
			v.used_at, v.expires_at, v.first_session_id, COALESCE(v.notes, ''), v.created_at, v.updated_at,
			p.name as package_name
		FROM vouchers v
		JOIN voucher_packages p ON v.package_id = p.id
		WHERE v.tenant_id = $1
		ORDER BY v.created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(ctx, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vouchers []*voucher.Voucher
	for rows.Next() {
		var v voucher.Voucher
		err := rows.Scan(
			&v.ID, &v.TenantID, &v.PackageID, &v.RouterID, &v.Code, &v.Password, &v.Status, &v.Isolated,
			&v.UsedAt, &v.ExpiresAt, &v.FirstSessionID, &v.Notes, &v.CreatedAt, &v.UpdatedAt,
			&v.PackageName,
		)
		if err != nil {
			return nil, err
		}
		vouchers = append(vouchers, &v)
	}
	return vouchers, nil
}

func (r *VoucherRepository) UpdateVoucherStatus(ctx context.Context, id uuid.UUID, status voucher.VoucherStatus) error {
	query := `
		UPDATE vouchers SET
			status = $2, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, status)
	return err
}

func (r *VoucherRepository) GetVoucherByID(ctx context.Context, id uuid.UUID) (*voucher.Voucher, error) {
	query := `
		SELECT v.id, v.tenant_id, v.package_id, v.router_id, v.code, COALESCE(v.password, ''), v.status, v.isolated,
			v.used_at, v.expires_at, v.first_session_id, COALESCE(v.notes, ''), v.created_at, v.updated_at,
			p.name as package_name
		FROM vouchers v
		JOIN voucher_packages p ON v.package_id = p.id
		WHERE v.id = $1
	`
	var v voucher.Voucher
	err := r.db.QueryRow(ctx, query, id).Scan(
		&v.ID, &v.TenantID, &v.PackageID, &v.RouterID, &v.Code, &v.Password, &v.Status, &v.Isolated,
		&v.UsedAt, &v.ExpiresAt, &v.FirstSessionID, &v.Notes, &v.CreatedAt, &v.UpdatedAt,
		&v.PackageName,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("voucher not found")
	}
	return &v, err
}

func (r *VoucherRepository) UpdateVoucher(ctx context.Context, v *voucher.Voucher) error {
	query := `
		UPDATE vouchers SET
			status = $2, used_at = $3, expires_at = $4, first_session_id = $5,
			notes = $6, updated_at = $7
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		v.ID, v.Status, v.UsedAt, v.ExpiresAt, v.FirstSessionID, v.Notes, v.UpdatedAt,
	)
	return err
}

func (r *VoucherRepository) CountVouchersByTenant(ctx context.Context, tenantID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM vouchers WHERE tenant_id = $1`
	var count int
	err := r.db.QueryRow(ctx, query, tenantID).Scan(&count)
	return count, err
}

func (r *VoucherRepository) CountVouchersByPackage(ctx context.Context, packageID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM vouchers WHERE package_id = $1`
	var count int
	err := r.db.QueryRow(ctx, query, packageID).Scan(&count)
	return count, err
}

func (r *VoucherRepository) DeleteVoucher(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM vouchers WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// ConsumeVoucherAtomic atomically marks a voucher as used
// Only updates if status is 'active', preventing race conditions
// Returns the updated voucher or error if voucher not found or already used
func (r *VoucherRepository) ConsumeVoucherAtomic(
	ctx context.Context,
	tenantID uuid.UUID,
	code string,
	usedAt time.Time,
	expiresAt *time.Time,
) (*voucher.Voucher, error) {
	query := `
		UPDATE vouchers
		SET
			status = 'used',
			used_at = $3,
			expires_at = COALESCE($4, expires_at),
			updated_at = NOW()
		WHERE
			tenant_id = $1
			AND code = $2
			AND (
				-- Allow reuse from 'used' status if not expired
				(status = 'used' AND (expires_at IS NULL OR expires_at > NOW()))
				OR
				-- Original: Allow from 'active' status
				(status = 'active' AND (expires_at IS NULL OR expires_at > NOW()))
			)
		RETURNING
			id, tenant_id, package_id, router_id, code, password, status, isolated,
			used_at, expires_at, first_session_id, notes, created_at, updated_at
	`

	var v voucher.Voucher
	err := r.db.QueryRow(
		ctx,
		query,
		tenantID,
		code,
		usedAt,
		expiresAt,
	).Scan(
		&v.ID, &v.TenantID, &v.PackageID, &v.RouterID, &v.Code, &v.Password, &v.Status, &v.Isolated,
		&v.UsedAt, &v.ExpiresAt, &v.FirstSessionID, &v.Notes, &v.CreatedAt, &v.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("voucher already used or expired")
	}

	return &v, err
}

// ToggleIsolate toggles the isolated status of a voucher
func (r *VoucherRepository) ToggleIsolate(ctx context.Context, id uuid.UUID) (*voucher.Voucher, error) {
	query := `
		UPDATE vouchers
		SET isolated = NOT isolated, updated_at = NOW()
		WHERE id = $1
		RETURNING id, tenant_id, package_id, router_id, code, password, status, isolated,
			used_at, expires_at, first_session_id, notes, created_at, updated_at
	`

	var v voucher.Voucher
	err := r.db.QueryRow(ctx, query, id).Scan(
		&v.ID, &v.TenantID, &v.PackageID, &v.RouterID, &v.Code, &v.Password, &v.Status, &v.Isolated,
		&v.UsedAt, &v.ExpiresAt, &v.FirstSessionID, &v.Notes, &v.CreatedAt, &v.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("voucher not found")
	}

	return &v, err
}
