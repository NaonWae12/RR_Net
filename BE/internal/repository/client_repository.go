package repository

import (
	"context"
	"errors"
	"fmt"
	"net"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/client"
)

var (
	ErrClientNotFound    = errors.New("client not found")
	ErrClientCodeTaken   = errors.New("client code already taken")
	ErrInvalidTransition = errors.New("invalid status transition")
)

// ClientRepository handles client database operations
type ClientRepository struct {
	db *pgxpool.Pool
}

// NewClientRepository creates a new client repository
func NewClientRepository(db *pgxpool.Pool) *ClientRepository {
	return &ClientRepository{db: db}
}

// Create creates a new client
func (r *ClientRepository) Create(ctx context.Context, c *client.Client) error {
	query := `
		INSERT INTO clients (
			id, tenant_id, user_id, client_code, name, email, phone, address,
			latitude, longitude, odp_id, group_id, discount_id,
			category, connection_type, router_id, pppoe_username, pppoe_local_address, pppoe_remote_address, pppoe_comment,
			service_package_id, voucher_package_id, device_count, pppoe_password_enc, pppoe_password_updated_at,
			service_plan, speed_profile, monthly_fee, billing_date,
			payment_tempo_option, payment_due_day, payment_tempo_template_id,
			status, ip_address, mac_address, metadata,
			created_at, updated_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)
	`
	_, err := r.db.Exec(ctx, query,
		c.ID, c.TenantID, c.UserID, c.ClientCode, c.Name, c.Email, c.Phone, c.Address,
		c.Latitude, c.Longitude, c.ODPID, c.GroupID, c.DiscountID,
		c.Category, c.ConnectionType, c.RouterID, c.PPPoEUsername, c.PPPoELocalAddress, c.PPPoERemoteAddress, c.PPPoEComment,
		c.ServicePackageID, c.VoucherPackageID, c.DeviceCount, c.PPPoEPasswordEnc, c.PPPoEPasswordUpdatedAt,
		c.ServicePlan, c.SpeedProfile, c.MonthlyFee, c.BillingDate,
		c.PaymentTempoOption, c.PaymentDueDay, c.PaymentTempoTemplateID,
		c.Status, c.IPAddress, c.MACAddress, c.Metadata,
		c.CreatedAt, c.UpdatedAt,
	)
	return err
}

// GetByID retrieves a client by ID (tenant-scoped)
func (r *ClientRepository) GetByID(ctx context.Context, tenantID, clientID uuid.UUID) (*client.Client, error) {
	query := `
		SELECT id, tenant_id, user_id, client_code, name, email, phone, address,
			   latitude, longitude, odp_id, group_id, discount_id,
			   category, connection_type, router_id, pppoe_username, pppoe_local_address, pppoe_remote_address, pppoe_comment,
			   service_package_id, voucher_package_id, device_count, pppoe_password_enc, pppoe_password_updated_at,
			   service_plan, speed_profile, monthly_fee, billing_date,
			   payment_tempo_option, payment_due_day, payment_tempo_template_id,
			   status, isolir_reason, isolir_at,
			   ip_address, mac_address, metadata, created_at, updated_at, deleted_at
		FROM clients
		WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
	`
	return r.scanClient(r.db.QueryRow(ctx, query, clientID, tenantID))
}

// GetByCode retrieves a client by client_code (tenant-scoped)
func (r *ClientRepository) GetByCode(ctx context.Context, tenantID uuid.UUID, clientCode string) (*client.Client, error) {
	query := `
		SELECT id, tenant_id, user_id, client_code, name, email, phone, address,
			   latitude, longitude, odp_id, group_id, discount_id,
			   category, connection_type, router_id, pppoe_username, pppoe_local_address, pppoe_remote_address, pppoe_comment,
			   service_package_id, voucher_package_id, device_count, pppoe_password_enc, pppoe_password_updated_at,
			   service_plan, speed_profile, monthly_fee, billing_date,
			   payment_tempo_option, payment_due_day, payment_tempo_template_id,
			   status, isolir_reason, isolir_at,
			   ip_address, mac_address, metadata, created_at, updated_at, deleted_at
		FROM clients
		WHERE client_code = $1 AND tenant_id = $2 AND deleted_at IS NULL
	`
	return r.scanClient(r.db.QueryRow(ctx, query, clientCode, tenantID))
}

// List retrieves clients with filters (tenant-scoped)
func (r *ClientRepository) List(ctx context.Context, tenantID uuid.UUID, filter *client.ClientListFilter) ([]*client.Client, int, error) {
	baseQuery := `FROM clients WHERE tenant_id = $1 AND deleted_at IS NULL`
	args := []interface{}{tenantID}
	argNum := 2

	// Apply filters
	if filter.Status != nil {
		baseQuery += fmt.Sprintf(` AND status = $%d`, argNum)
		args = append(args, *filter.Status)
		argNum++
	}
	if filter.Category != nil {
		baseQuery += fmt.Sprintf(` AND category = $%d`, argNum)
		args = append(args, *filter.Category)
		argNum++
	}
	if filter.Search != "" {
		baseQuery += fmt.Sprintf(` AND (name ILIKE $%d OR phone ILIKE $%d OR client_code ILIKE $%d)`, argNum, argNum, argNum)
		args = append(args, "%"+filter.Search+"%")
		argNum++
	}
	if filter.GroupID != nil {
		baseQuery += fmt.Sprintf(` AND group_id = $%d`, argNum)
		args = append(args, *filter.GroupID)
		argNum++
	}

	// Count total
	countQuery := `SELECT COUNT(*) ` + baseQuery
	var total int
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Pagination
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	// Select query
	selectQuery := `
		SELECT id, tenant_id, user_id, client_code, name, email, phone, address,
			   latitude, longitude, odp_id, group_id, discount_id,
			   category, connection_type, router_id, pppoe_username, pppoe_local_address, pppoe_remote_address, pppoe_comment,
			   service_package_id, voucher_package_id, device_count, pppoe_password_enc, pppoe_password_updated_at,
			   service_plan, speed_profile, monthly_fee, billing_date,
			   payment_tempo_option, payment_due_day, payment_tempo_template_id,
			   status, isolir_reason, isolir_at,
			   ip_address, mac_address, metadata, created_at, updated_at, deleted_at
		` + baseQuery + fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argNum, argNum+1)
	args = append(args, pageSize, offset)

	rows, err := r.db.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var clients []*client.Client
	for rows.Next() {
		c, err := r.scanClientFromRows(rows)
		if err != nil {
			return nil, 0, err
		}
		clients = append(clients, c)
	}

	return clients, total, nil
}

// ListByGroupID returns clients in a given client group (tenant-scoped).
// Used by WhatsApp campaigns to expand recipients.
func (r *ClientRepository) ListByGroupID(ctx context.Context, tenantID, groupID uuid.UUID) ([]*client.Client, error) {
	query := `
		SELECT id, tenant_id, user_id, client_code, name, email, phone, address,
			   latitude, longitude, odp_id, group_id, discount_id,
			   category, connection_type, router_id, pppoe_username, pppoe_local_address, pppoe_remote_address, pppoe_comment,
			   service_package_id, voucher_package_id, device_count, pppoe_password_enc, pppoe_password_updated_at,
			   service_plan, speed_profile, monthly_fee, billing_date,
			   payment_tempo_option, payment_due_day, payment_tempo_template_id,
			   status, isolir_reason, isolir_at,
			   ip_address, mac_address, metadata, created_at, updated_at, deleted_at
		FROM clients
		WHERE tenant_id = $1 AND group_id = $2 AND deleted_at IS NULL
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, tenantID, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*client.Client
	for rows.Next() {
		c, err := r.scanClientFromRows(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

// Update updates a client
func (r *ClientRepository) Update(ctx context.Context, c *client.Client) error {
	query := `
		UPDATE clients
		SET user_id = $3, name = $4, email = $5, phone = $6, address = $7,
			latitude = $8, longitude = $9, odp_id = $10, group_id = $11, discount_id = $12,
			category = $13, connection_type = $14, router_id = $15, pppoe_username = $16,
			pppoe_local_address = $17, pppoe_remote_address = $18, pppoe_comment = $19,
			service_package_id = $20, voucher_package_id = $21, device_count = $22,
			pppoe_password_enc = $23, pppoe_password_updated_at = $24,
			service_plan = $25, speed_profile = $26, monthly_fee = $27, billing_date = $28,
			payment_tempo_option = $29, payment_due_day = $30, payment_tempo_template_id = $31,
			ip_address = $32, mac_address = $33,
			metadata = $34, updated_at = NOW()
		WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
	`
	result, err := r.db.Exec(ctx, query,
		c.ID, c.TenantID, c.UserID, c.Name, c.Email, c.Phone, c.Address,
		c.Latitude, c.Longitude, c.ODPID, c.GroupID, c.DiscountID,
		c.Category, c.ConnectionType, c.RouterID, c.PPPoEUsername,
		c.PPPoELocalAddress, c.PPPoERemoteAddress, c.PPPoEComment,
		c.ServicePackageID, c.VoucherPackageID, c.DeviceCount,
		c.PPPoEPasswordEnc, c.PPPoEPasswordUpdatedAt,
		c.ServicePlan, c.SpeedProfile, c.MonthlyFee, c.BillingDate,
		c.PaymentTempoOption, c.PaymentDueDay, c.PaymentTempoTemplateID,
		c.IPAddress, c.MACAddress, c.Metadata,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrClientNotFound
	}
	return nil
}

// UpdateStatus updates client status with reason (for isolir)
func (r *ClientRepository) UpdateStatus(ctx context.Context, tenantID, clientID uuid.UUID, status client.Status, reason *string) error {
	var query string
	var args []interface{}

	if status == client.StatusIsolir {
		query = `
			UPDATE clients
			SET status = $3, isolir_reason = $4, isolir_at = NOW(), updated_at = NOW()
			WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
		`
		args = []interface{}{clientID, tenantID, status, reason}
	} else {
		query = `
			UPDATE clients
			SET status = $3, isolir_reason = NULL, isolir_at = NULL, updated_at = NOW()
			WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
		`
		args = []interface{}{clientID, tenantID, status}
	}

	result, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrClientNotFound
	}
	return nil
}

// SoftDelete soft deletes a client
func (r *ClientRepository) SoftDelete(ctx context.Context, tenantID, clientID uuid.UUID) error {
	query := `UPDATE clients SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`
	result, err := r.db.Exec(ctx, query, clientID, tenantID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrClientNotFound
	}
	return nil
}

// HardDeleteOldSoftDeleted permanently deletes clients that were soft deleted more than retentionDays ago
// Returns the count of deleted clients
func (r *ClientRepository) HardDeleteOldSoftDeleted(ctx context.Context, retentionDays int) (int64, error) {
	query := `DELETE FROM clients WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '1 day' * $1`
	result, err := r.db.Exec(ctx, query, retentionDays)
	if err != nil {
		return 0, fmt.Errorf("failed to hard delete old soft deleted clients: %w", err)
	}
	return result.RowsAffected(), nil
}

// ClientCodeExists checks if a client code is already taken in a tenant
func (r *ClientRepository) ClientCodeExists(ctx context.Context, tenantID uuid.UUID, code string, excludeID *uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM clients WHERE tenant_id = $1 AND client_code = $2 AND deleted_at IS NULL`
	args := []interface{}{tenantID, code}

	if excludeID != nil {
		query += ` AND id != $3`
		args = append(args, *excludeID)
	}
	query += `)`

	var exists bool
	err := r.db.QueryRow(ctx, query, args...).Scan(&exists)
	return exists, err
}

// CountByTenant counts total clients for a tenant
func (r *ClientRepository) CountByTenant(ctx context.Context, tenantID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM clients WHERE tenant_id = $1 AND deleted_at IS NULL`
	var count int
	err := r.db.QueryRow(ctx, query, tenantID).Scan(&count)
	return count, err
}

// scanClient scans a single row into a Client
func (r *ClientRepository) scanClient(row pgx.Row) (*client.Client, error) {
	var c client.Client
	var ipAddress, macAddress *string

	err := row.Scan(
		&c.ID, &c.TenantID, &c.UserID, &c.ClientCode, &c.Name, &c.Email, &c.Phone, &c.Address,
		&c.Latitude, &c.Longitude, &c.ODPID, &c.GroupID, &c.DiscountID,
		&c.Category, &c.ConnectionType, &c.RouterID, &c.PPPoEUsername, &c.PPPoELocalAddress, &c.PPPoERemoteAddress, &c.PPPoEComment,
		&c.ServicePackageID, &c.VoucherPackageID, &c.DeviceCount, &c.PPPoEPasswordEnc, &c.PPPoEPasswordUpdatedAt,
		&c.ServicePlan, &c.SpeedProfile, &c.MonthlyFee, &c.BillingDate,
		&c.PaymentTempoOption, &c.PaymentDueDay, &c.PaymentTempoTemplateID,
		&c.Status, &c.IsolirReason, &c.IsolirAt,
		&ipAddress, &macAddress, &c.Metadata, &c.CreatedAt, &c.UpdatedAt, &c.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrClientNotFound
		}
		return nil, err
	}

	// Convert IP and MAC
	if ipAddress != nil {
		ip := net.ParseIP(*ipAddress)
		c.IPAddress = &ip
	}
	c.MACAddress = macAddress

	return &c, nil
}

// scanClientFromRows scans rows into a Client
func (r *ClientRepository) scanClientFromRows(rows pgx.Rows) (*client.Client, error) {
	var c client.Client
	var ipAddress, macAddress *string

	err := rows.Scan(
		&c.ID, &c.TenantID, &c.UserID, &c.ClientCode, &c.Name, &c.Email, &c.Phone, &c.Address,
		&c.Latitude, &c.Longitude, &c.ODPID, &c.GroupID, &c.DiscountID,
		&c.Category, &c.ConnectionType, &c.RouterID, &c.PPPoEUsername, &c.PPPoELocalAddress, &c.PPPoERemoteAddress, &c.PPPoEComment,
		&c.ServicePackageID, &c.VoucherPackageID, &c.DeviceCount, &c.PPPoEPasswordEnc, &c.PPPoEPasswordUpdatedAt,
		&c.ServicePlan, &c.SpeedProfile, &c.MonthlyFee, &c.BillingDate,
		&c.PaymentTempoOption, &c.PaymentDueDay, &c.PaymentTempoTemplateID,
		&c.Status, &c.IsolirReason, &c.IsolirAt,
		&ipAddress, &macAddress, &c.Metadata, &c.CreatedAt, &c.UpdatedAt, &c.DeletedAt,
	)
	if err != nil {
		return nil, err
	}

	if ipAddress != nil {
		ip := net.ParseIP(*ipAddress)
		c.IPAddress = &ip
	}
	c.MACAddress = macAddress

	return &c, nil
}
