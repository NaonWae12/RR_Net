package repository

import (
	"context"
	"fmt"
	"strings"
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
			duration_hours, quota_mb, price, currency, rate_limit_mode,
			max_uptime_seconds, expiration_mode, is_active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`
	_, err := r.db.Exec(ctx, query,
		pkg.ID, pkg.TenantID, pkg.Name, pkg.Description, pkg.DownloadSpeed, pkg.UploadSpeed,
		pkg.DurationHours, pkg.QuotaMB, pkg.Price, pkg.Currency, pkg.RateLimitMode,
		pkg.MaxUptimeSeconds, pkg.ExpirationMode, pkg.IsActive,
		pkg.CreatedAt, pkg.UpdatedAt,
	)
	return err
}

func (r *VoucherRepository) GetPackageByID(ctx context.Context, id uuid.UUID) (*voucher.VoucherPackage, error) {
	query := `
		SELECT id, tenant_id, name, COALESCE(description, ''), download_speed, upload_speed,
			duration_hours, quota_mb, price::float8, currency, rate_limit_mode, is_active, max_uptime_seconds, expiration_mode, created_at, updated_at
		FROM voucher_packages
		WHERE id = $1
	`
	var pkg voucher.VoucherPackage
	err := r.db.QueryRow(ctx, query, id).Scan(
		&pkg.ID, &pkg.TenantID, &pkg.Name, &pkg.Description, &pkg.DownloadSpeed, &pkg.UploadSpeed,
		&pkg.DurationHours, &pkg.QuotaMB, &pkg.Price, &pkg.Currency, &pkg.RateLimitMode, &pkg.IsActive,
		&pkg.MaxUptimeSeconds, &pkg.ExpirationMode, &pkg.CreatedAt, &pkg.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("package not found")
	}
	return &pkg, err
}

func (r *VoucherRepository) ListPackagesByTenant(ctx context.Context, tenantID uuid.UUID, activeOnly bool) ([]*voucher.VoucherPackage, error) {
	query := `
		SELECT id, tenant_id, name, COALESCE(description, ''), download_speed, upload_speed,
			duration_hours, quota_mb, price::float8, currency, rate_limit_mode, is_active, max_uptime_seconds, expiration_mode, created_at, updated_at
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
			&pkg.MaxUptimeSeconds, &pkg.ExpirationMode, &pkg.CreatedAt, &pkg.UpdatedAt,
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
			rate_limit_mode = $10, is_active = $11,
			max_uptime_seconds = $12, expiration_mode = $13,
			updated_at = $14
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		pkg.ID, pkg.Name, pkg.Description, pkg.DownloadSpeed, pkg.UploadSpeed,
		pkg.DurationHours, pkg.QuotaMB, pkg.Price, pkg.Currency, pkg.RateLimitMode, pkg.IsActive,
		pkg.MaxUptimeSeconds, pkg.ExpirationMode, pkg.UpdatedAt,
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
			used_at, expires_at, first_session_id, notes, shared_users, reseller_purchase_id, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`
	_, err := r.db.Exec(ctx, query,
		v.ID, v.TenantID, v.PackageID, v.RouterID, v.Code, v.Password, v.Status,
		v.UsedAt, v.ExpiresAt, v.FirstSessionID, v.Notes, v.SharedUsers, v.ResellerPurchaseID, v.CreatedAt, v.UpdatedAt,
	)
	return err
}

func (r *VoucherRepository) GetVoucherByCode(ctx context.Context, tenantID uuid.UUID, code string) (*voucher.Voucher, error) {
	query := `
		SELECT
			v.id, v.tenant_id, v.package_id, v.router_id, v.code, COALESCE(v.password, ''), v.status, v.isolated,
			v.used_at, v.expires_at, v.first_session_id, COALESCE(v.notes, ''), v.shared_users, v.reseller_purchase_id, v.created_at, v.updated_at,
			v.total_uptime_seconds, v.total_bytes_used,
			p.name as package_name, p.expiration_mode
		FROM vouchers v
		JOIN voucher_packages p ON v.package_id = p.id
		WHERE v.tenant_id = $1 AND v.code = $2
	`
	var v voucher.Voucher
	err := r.db.QueryRow(ctx, query, tenantID, code).Scan(
		&v.ID, &v.TenantID, &v.PackageID, &v.RouterID, &v.Code, &v.Password, &v.Status, &v.Isolated,
		&v.UsedAt, &v.ExpiresAt, &v.FirstSessionID, &v.Notes, &v.SharedUsers, &v.ResellerPurchaseID, &v.CreatedAt, &v.UpdatedAt,
		&v.TotalUptimeSeconds, &v.TotalBytesUsed,
		&v.PackageName, &v.ExpirationMode,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("voucher not found")
	}
	return &v, err
}

func (r *VoucherRepository) ListVouchersByTenant(ctx context.Context, tenantID uuid.UUID, limit, offset int, status string, search string) ([]*voucher.Voucher, int, error) {
	var whereClauses []string
	var args []interface{}
	args = append(args, tenantID)
	whereClauses = append(whereClauses, "v.tenant_id = $1")

	if status != "" {
		if status == "kadaluarsa" {
			// Smart Filter: explicit expired/revoked OR naturally expired by time
			whereClauses = append(whereClauses, "(v.status IN ('expired', 'revoked') OR (v.expires_at IS NOT NULL AND v.expires_at < NOW()))")
		} else {
			// Filter other statuses AND ensure they haven't expired yet
			args = append(args, status)
			whereClauses = append(whereClauses, fmt.Sprintf("v.status = $%d AND (v.expires_at IS NULL OR v.expires_at > NOW())", len(args)))
		}
	}

	if search != "" {
		args = append(args, "%"+search+"%")
		whereClauses = append(whereClauses, fmt.Sprintf("(v.code ILIKE $%d OR v.notes ILIKE $%d)", len(args), len(args)))
	}

	whereSQL := " WHERE " + strings.Join(whereClauses, " AND ")

	// 1. Get total count with filters
	countQuery := "SELECT COUNT(*) FROM vouchers v " + whereSQL
	var total int
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// 2. Get data
	query := `
		SELECT v.id, v.tenant_id, v.package_id, v.router_id, v.code, COALESCE(v.password, ''), 
			CASE 
				WHEN v.expires_at IS NOT NULL AND v.expires_at < NOW() AND v.status != 'revoked' THEN 'expired' 
				ELSE v.status 
			END as status,
			v.isolated,
			v.used_at, v.expires_at, v.first_session_id, COALESCE(v.notes, ''), v.shared_users, v.reseller_purchase_id, v.created_at, v.updated_at,
			p.name as package_name,
			p.expiration_mode,
			v.total_uptime_seconds,
			v.total_bytes_used
		FROM vouchers v
		JOIN voucher_packages p ON v.package_id = p.id
		` + whereSQL + `
		ORDER BY v.created_at DESC
		LIMIT $` + fmt.Sprintf("%d OFFSET $%d", len(args)+1, len(args)+2)
	
	args = append(args, limit, offset)
	
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var vouchers []*voucher.Voucher
	for rows.Next() {
		var v voucher.Voucher
		err := rows.Scan(
			&v.ID, &v.TenantID, &v.PackageID, &v.RouterID, &v.Code, &v.Password, &v.Status, &v.Isolated,
			&v.UsedAt, &v.ExpiresAt, &v.FirstSessionID, &v.Notes, &v.SharedUsers, &v.ResellerPurchaseID, &v.CreatedAt, &v.UpdatedAt,
			&v.PackageName, &v.ExpirationMode, &v.TotalUptimeSeconds, &v.TotalBytesUsed,
		)
		if err != nil {
			return nil, 0, err
		}
		vouchers = append(vouchers, &v)
	}
	return vouchers, total, nil
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
		SELECT v.id, v.tenant_id, v.package_id, v.router_id, v.code, COALESCE(v.password, ''), 
			CASE 
				WHEN v.expires_at IS NOT NULL AND v.expires_at < NOW() AND v.status != 'revoked' THEN 'expired' 
				ELSE v.status 
			END as status,
			v.isolated,
			v.used_at, v.expires_at, v.first_session_id, COALESCE(v.notes, ''), v.shared_users, v.reseller_purchase_id, v.created_at, v.updated_at,
			p.name as package_name,
			p.expiration_mode,
			v.total_uptime_seconds,
			v.total_bytes_used
		FROM vouchers v
		JOIN voucher_packages p ON v.package_id = p.id
		WHERE v.id = $1
	`
	var v voucher.Voucher
	err := r.db.QueryRow(ctx, query, id).Scan(
		&v.ID, &v.TenantID, &v.PackageID, &v.RouterID, &v.Code, &v.Password, &v.Status, &v.Isolated,
		&v.UsedAt, &v.ExpiresAt, &v.FirstSessionID, &v.Notes, &v.SharedUsers, &v.ResellerPurchaseID, &v.CreatedAt, &v.UpdatedAt,
		&v.PackageName, &v.ExpirationMode, &v.TotalUptimeSeconds, &v.TotalBytesUsed,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("voucher not found")
	}
	return &v, err
}

func (r *VoucherRepository) UpdateVoucher(ctx context.Context, v *voucher.Voucher) error {
	query := `
		UPDATE vouchers SET
			package_id = $2, router_id = $3, code = $4, password = $5, shared_users = $6,
			status = $7, used_at = $8, expires_at = $9, first_session_id = $10,
			notes = $11, updated_at = $12
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		v.ID, v.PackageID, v.RouterID, v.Code, v.Password, v.SharedUsers,
		v.Status, v.UsedAt, v.ExpiresAt, v.FirstSessionID,
		v.Notes, time.Now(),
	)
	return err
}

func (r *VoucherRepository) CountVouchersByTenant(ctx context.Context, tenantID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM vouchers WHERE tenant_id = $1 AND status NOT IN ('expired', 'revoked') AND (expires_at IS NULL OR expires_at > NOW())`
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

func (r *VoucherRepository) DeleteVouchersByPurchase(ctx context.Context, purchaseID uuid.UUID) error {
	query := `DELETE FROM vouchers WHERE reseller_purchase_id = $1`
	_, err := r.db.Exec(ctx, query, purchaseID)
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
			used_at = COALESCE(used_at, $3),
			expires_at = COALESCE(expires_at, $4),
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
			used_at, expires_at, first_session_id, notes, shared_users, reseller_purchase_id, created_at, updated_at
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
		&v.UsedAt, &v.ExpiresAt, &v.FirstSessionID, &v.Notes, &v.SharedUsers, &v.ResellerPurchaseID, &v.CreatedAt, &v.UpdatedAt,
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
			used_at, expires_at, first_session_id, notes, shared_users, reseller_purchase_id, created_at, updated_at
	`

	var v voucher.Voucher
	err := r.db.QueryRow(ctx, query, id).Scan(
		&v.ID, &v.TenantID, &v.PackageID, &v.RouterID, &v.Code, &v.Password, &v.Status, &v.Isolated,
		&v.UsedAt, &v.ExpiresAt, &v.FirstSessionID, &v.Notes, &v.SharedUsers, &v.ResellerPurchaseID, &v.CreatedAt, &v.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("voucher not found")
	}

	return &v, err
}

func (r *VoucherRepository) ListVouchersByPurchase(ctx context.Context, purchaseID uuid.UUID) ([]*voucher.Voucher, error) {
	query := `
		SELECT v.id, v.tenant_id, v.package_id, v.router_id, v.code, COALESCE(v.password, ''), v.status, v.isolated,
			v.used_at, v.expires_at, v.first_session_id, COALESCE(v.notes, ''), v.shared_users, v.reseller_purchase_id, v.created_at, v.updated_at,
			p.name as package_name, p.price::float8 as package_price, COALESCE(r.name, 'All Routers') as router_name
		FROM vouchers v
		JOIN voucher_packages p ON v.package_id = p.id
		LEFT JOIN routers r ON v.router_id = r.id
		WHERE v.reseller_purchase_id = $1
		ORDER BY v.created_at ASC
	`
	rows, err := r.db.Query(ctx, query, purchaseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vouchers []*voucher.Voucher
	for rows.Next() {
		var v voucher.Voucher
		err := rows.Scan(
			&v.ID, &v.TenantID, &v.PackageID, &v.RouterID, &v.Code, &v.Password, &v.Status, &v.Isolated,
			&v.UsedAt, &v.ExpiresAt, &v.FirstSessionID, &v.Notes, &v.SharedUsers, &v.ResellerPurchaseID, &v.CreatedAt, &v.UpdatedAt,
			&v.PackageName, &v.PackagePrice, &v.RouterName,
		)
		if err != nil {
			return nil, err
		}
		vouchers = append(vouchers, &v)
	}
	return vouchers, nil
}

func (r *VoucherRepository) ListByRouter(ctx context.Context, routerID uuid.UUID) ([]*voucher.Voucher, error) {
	query := `
		SELECT v.id, v.tenant_id, v.package_id, v.router_id, v.code, COALESCE(v.password, ''), v.status, v.isolated,
			v.used_at, v.expires_at, v.first_session_id, COALESCE(v.notes, ''), v.shared_users, v.reseller_purchase_id, v.created_at, v.updated_at
		FROM vouchers v
		WHERE v.router_id = $1
	`
	rows, err := r.db.Query(ctx, query, routerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vouchers []*voucher.Voucher
	for rows.Next() {
		var v voucher.Voucher
		err := rows.Scan(
			&v.ID, &v.TenantID, &v.PackageID, &v.RouterID, &v.Code, &v.Password, &v.Status, &v.Isolated,
			&v.UsedAt, &v.ExpiresAt, &v.FirstSessionID, &v.Notes, &v.SharedUsers, &v.ResellerPurchaseID, &v.CreatedAt, &v.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		vouchers = append(vouchers, &v)
	}
	return vouchers, nil
}

// HardDeleteExpiredVouchers deletes vouchers that have been expired longer than the retention period
func (r *VoucherRepository) HardDeleteExpiredVouchers(ctx context.Context, olderThan time.Time) (int64, error) {
	query := `DELETE FROM vouchers WHERE status = 'expired' AND expires_at < $1`
	result, err := r.db.Exec(ctx, query, olderThan)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
