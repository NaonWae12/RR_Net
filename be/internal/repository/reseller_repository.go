package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/reseller"
)

var (
	ErrResellerNotFound      = errors.New("reseller not found")
	ErrResellerAlreadyExists = errors.New("client is already a reseller")
	ErrResellerPriceNotFound = errors.New("reseller price not found")
)

// ResellerRepository handles reseller database operations
type ResellerRepository struct {
	db *pgxpool.Pool
}

// NewResellerRepository creates a new reseller repository
func NewResellerRepository(db *pgxpool.Pool) *ResellerRepository {
	return &ResellerRepository{db: db}
}

// ========== Reseller CRUD ==========

// Create creates a new reseller
func (r *ResellerRepository) Create(ctx context.Context, res *reseller.Reseller) error {
	query := `
		INSERT INTO resellers (id, tenant_id, client_id, status, join_date, notes, balance, reseller_radius, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.Exec(ctx, query,
		res.ID, res.TenantID, res.ClientID, res.Status, res.JoinDate, res.Notes, res.Balance, res.ResellerRadius,
		res.CreatedAt, res.UpdatedAt,
	)
	return err
}

// GetByID retrieves a reseller by ID
func (r *ResellerRepository) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*reseller.Reseller, error) {
	query := `
		SELECT r.id, r.tenant_id, r.client_id, r.status, r.join_date, r.notes, r.balance, r.reseller_radius, r.created_at, r.updated_at,
		       c.name as client_name, c.phone as client_phone, c.email as client_email,
		       COALESCE((SELECT SUM(rp.margin) FROM reseller_purchases rp WHERE rp.reseller_id = r.id AND rp.status = 'success' AND rp.created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as monthly_revenue,
		       COALESCE((SELECT COUNT(*) FROM reseller_purchases rp WHERE rp.reseller_id = r.id), 0) as total_purchases
		FROM resellers r
		JOIN clients c ON c.id = r.client_id
		WHERE r.tenant_id = $1 AND r.id = $2
	`
	return r.scanReseller(r.db.QueryRow(ctx, query, tenantID, id))
}

// GetByClientID retrieves a reseller by client ID
func (r *ResellerRepository) GetByClientID(ctx context.Context, tenantID, clientID uuid.UUID) (*reseller.Reseller, error) {
	query := `
		SELECT r.id, r.tenant_id, r.client_id, r.status, r.join_date, r.notes, r.balance, r.reseller_radius, r.created_at, r.updated_at,
		       c.name as client_name, c.phone as client_phone, c.email as client_email,
		       COALESCE((SELECT SUM(rp.margin) FROM reseller_purchases rp WHERE rp.reseller_id = r.id AND rp.status = 'success' AND rp.created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as monthly_revenue,
		       COALESCE((SELECT COUNT(*) FROM reseller_purchases rp WHERE rp.reseller_id = r.id), 0) as total_purchases
		FROM resellers r
		JOIN clients c ON c.id = r.client_id
		WHERE r.tenant_id = $1 AND r.client_id = $2
	`
	return r.scanReseller(r.db.QueryRow(ctx, query, tenantID, clientID))
}

// List retrieves resellers with filters
func (r *ResellerRepository) List(ctx context.Context, tenantID uuid.UUID, filter reseller.ResellerListFilter) ([]*reseller.Reseller, int64, error) {
	baseQuery := `
		FROM resellers r
		JOIN clients c ON c.id = r.client_id
		WHERE r.tenant_id = $1
	`
	args := []interface{}{tenantID}
	argPos := 2

	// Apply filters
	if filter.Status != nil {
		baseQuery += fmt.Sprintf(" AND r.status = $%d", argPos)
		args = append(args, *filter.Status)
		argPos++
	}

	if filter.Search != "" {
		searchPattern := "%" + filter.Search + "%"
		baseQuery += fmt.Sprintf(" AND (c.name ILIKE $%d OR c.phone ILIKE $%d OR c.email ILIKE $%d)", argPos, argPos, argPos)
		args = append(args, searchPattern)
		argPos++
	}

	// Count total
	var total int64
	countQuery := "SELECT COUNT(*) " + baseQuery
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Pagination
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	// Get data
	dataQuery := `
		SELECT r.id, r.tenant_id, r.client_id, r.status, r.join_date, r.notes, r.balance, r.reseller_radius, r.created_at, r.updated_at,
		       c.name as client_name, c.phone as client_phone, c.email as client_email,
		       COALESCE((SELECT SUM(rp.margin) FROM reseller_purchases rp WHERE rp.reseller_id = r.id AND rp.status = 'success' AND rp.created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as monthly_revenue,
		       COALESCE((SELECT COUNT(*) FROM reseller_purchases rp WHERE rp.reseller_id = r.id), 0) as total_purchases
	` + baseQuery + fmt.Sprintf(" ORDER BY r.created_at DESC LIMIT $%d OFFSET $%d", argPos, argPos+1)
	args = append(args, pageSize, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var resellers []*reseller.Reseller
	for rows.Next() {
		res, err := r.scanResellerFromRows(rows)
		if err != nil {
			return nil, 0, err
		}
		resellers = append(resellers, res)
	}

	return resellers, total, nil
}

// Update updates a reseller
func (r *ResellerRepository) Update(ctx context.Context, res *reseller.Reseller) error {
	query := `
		UPDATE resellers
		SET status = $3, notes = $4, reseller_radius = $5, updated_at = $6
		WHERE tenant_id = $1 AND id = $2
	`
	result, err := r.db.Exec(ctx, query, res.TenantID, res.ID, res.Status, res.Notes, res.ResellerRadius, res.UpdatedAt)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrResellerNotFound
	}
	return nil
}

// Delete deletes a reseller
func (r *ResellerRepository) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	query := `DELETE FROM resellers WHERE tenant_id = $1 AND id = $2`
	result, err := r.db.Exec(ctx, query, tenantID, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrResellerNotFound
	}
	return nil
}

// UpdateBalance updates the reseller's balance (adds the amount, can be negative)
func (r *ResellerRepository) UpdateBalance(ctx context.Context, tenantID, resellerID uuid.UUID, amount float64) error {
	query := `UPDATE resellers SET balance = balance + $3, updated_at = NOW() WHERE tenant_id = $1 AND id = $2`
	result, err := r.db.Exec(ctx, query, tenantID, resellerID, amount)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrResellerNotFound
	}
	return nil
}

// ========== Reseller Prices ==========

// CreatePrice creates a new reseller price
func (r *ResellerRepository) CreatePrice(ctx context.Context, price *reseller.ResellerPrice) error {
	query := `
		INSERT INTO reseller_prices (id, tenant_id, reseller_id, voucher_package_id, reseller_price, retail_price, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.db.Exec(ctx, query,
		price.ID, price.TenantID, price.ResellerID, price.VoucherPackageID,
		price.ResellerPrice, price.RetailPrice, price.CreatedAt, price.UpdatedAt,
	)
	return err
}

// GetPrice retrieves a price for a specific reseller and package, falling back to global price if specific not found
func (r *ResellerRepository) GetPrice(ctx context.Context, tenantID, resellerID, packageID uuid.UUID) (*reseller.ResellerPrice, error) {
	query := `
		SELECT rp.id, rp.tenant_id, rp.reseller_id, rp.voucher_package_id, rp.reseller_price, rp.retail_price, rp.margin, rp.created_at, rp.updated_at,
		       v.name as voucher_package_name
		FROM reseller_prices rp
		JOIN voucher_packages v ON v.id = rp.voucher_package_id
		WHERE rp.tenant_id = $1 AND (rp.reseller_id = $2 OR rp.reseller_id IS NULL) AND rp.voucher_package_id = $3
		ORDER BY (rp.reseller_id IS NULL) ASC, rp.updated_at DESC
		LIMIT 1
	`
	return r.scanPrice(r.db.QueryRow(ctx, query, tenantID, resellerID, packageID))
}

// ListPrices retrieves all prices for a reseller, falling back to global prices if specific ones don't exist
func (r *ResellerRepository) ListPrices(ctx context.Context, tenantID, resellerID uuid.UUID) ([]*reseller.ResellerPrice, error) {
	query := `
		SELECT DISTINCT ON (rp.voucher_package_id) 
			rp.id, rp.tenant_id, rp.reseller_id, rp.voucher_package_id, rp.reseller_price, rp.retail_price, rp.margin, rp.created_at, rp.updated_at,
			v.name as voucher_package_name
		FROM reseller_prices rp
		JOIN voucher_packages v ON v.id = rp.voucher_package_id
		WHERE rp.tenant_id = $1 AND (rp.reseller_id = $2 OR rp.reseller_id IS NULL)
		ORDER BY rp.voucher_package_id, (rp.reseller_id IS NULL) ASC, rp.updated_at DESC
	`
	rows, err := r.db.Query(ctx, query, tenantID, resellerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prices []*reseller.ResellerPrice
	for rows.Next() {
		price, err := r.scanPriceFromRows(rows)
		if err != nil {
			return nil, err
		}
		prices = append(prices, price)
	}

	return prices, nil
}

// ListGlobalPrices retrieves all default prices for resellers (where reseller_id is NULL)
func (r *ResellerRepository) ListGlobalPrices(ctx context.Context, tenantID uuid.UUID) ([]*reseller.ResellerPrice, error) {
	query := `
		SELECT rp.id, rp.tenant_id, rp.reseller_id, rp.voucher_package_id, rp.reseller_price, rp.retail_price, rp.margin, rp.created_at, rp.updated_at,
		       v.name as voucher_package_name
		FROM reseller_prices rp
		JOIN voucher_packages v ON v.id = rp.voucher_package_id
		WHERE rp.tenant_id = $1 AND rp.reseller_id IS NULL
		ORDER BY rp.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var prices []*reseller.ResellerPrice
	for rows.Next() {
		price, err := r.scanPriceFromRows(rows)
		if err != nil {
			return nil, err
		}
		prices = append(prices, price)
	}

	return prices, nil
}

// GetGlobalPrice retrieves a default price for a specific package
func (r *ResellerRepository) GetGlobalPrice(ctx context.Context, tenantID, packageID uuid.UUID) (*reseller.ResellerPrice, error) {
	query := `
		SELECT rp.id, rp.tenant_id, rp.reseller_id, rp.voucher_package_id, rp.reseller_price, rp.retail_price, rp.margin, rp.created_at, rp.updated_at,
		       v.name as voucher_package_name
		FROM reseller_prices rp
		JOIN voucher_packages v ON v.id = rp.voucher_package_id
		WHERE rp.tenant_id = $1 AND rp.reseller_id IS NULL AND rp.voucher_package_id = $2
	`
	return r.scanPrice(r.db.QueryRow(ctx, query, tenantID, packageID))
}

// UpdatePrice updates a reseller price
func (r *ResellerRepository) UpdatePrice(ctx context.Context, price *reseller.ResellerPrice) error {
	query := `
		UPDATE reseller_prices
		SET reseller_price = $3, retail_price = $4, updated_at = $5
		WHERE tenant_id = $1 AND id = $2
	`
	result, err := r.db.Exec(ctx, query, price.TenantID, price.ID, price.ResellerPrice, price.RetailPrice, price.UpdatedAt)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrResellerPriceNotFound
	}
	return nil
}

// DeletePrice deletes a reseller price
func (r *ResellerRepository) DeletePrice(ctx context.Context, tenantID, id uuid.UUID) error {
	query := `DELETE FROM reseller_prices WHERE tenant_id = $1 AND id = $2`
	result, err := r.db.Exec(ctx, query, tenantID, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrResellerPriceNotFound
	}
	return nil
}

// ========== Reseller Discounts ==========

// CreateDiscount creates a new reseller discount
func (r *ResellerRepository) CreateDiscount(ctx context.Context, discount *reseller.ResellerDiscount) error {
	query := `
		INSERT INTO reseller_discounts (id, tenant_id, code, discount_id, rule_name, discount_type, discount_value, status, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err := r.db.Exec(ctx, query,
		discount.ID, discount.TenantID, discount.Code, discount.DiscountID, discount.RuleName,
		discount.DiscountType, discount.DiscountValue, discount.Status, discount.ExpiresAt,
		discount.CreatedAt, discount.UpdatedAt,
	)
	return err
}

// GetDiscountByCode retrieves a discount by code
func (r *ResellerRepository) GetDiscountByCode(ctx context.Context, tenantID uuid.UUID, code string) (*reseller.ResellerDiscount, error) {
	query := `
		SELECT id, tenant_id, code, discount_id, rule_name, discount_type, discount_value, status, expires_at, created_at, updated_at
		FROM reseller_discounts
		WHERE tenant_id = $1 AND code = $2
	`
	return r.scanDiscount(r.db.QueryRow(ctx, query, tenantID, code))
}

// GetDiscountByID retrieves a discount by ID
func (r *ResellerRepository) GetDiscountByID(ctx context.Context, tenantID, id uuid.UUID) (*reseller.ResellerDiscount, error) {
	query := `
		SELECT id, tenant_id, code, discount_id, rule_name, discount_type, discount_value, status, expires_at, created_at, updated_at
		FROM reseller_discounts
		WHERE tenant_id = $1 AND id = $2
	`
	return r.scanDiscount(r.db.QueryRow(ctx, query, tenantID, id))
}

// ListDiscounts retrieves all discounts for a tenant
func (r *ResellerRepository) ListDiscounts(ctx context.Context, tenantID uuid.UUID) ([]*reseller.ResellerDiscount, error) {
	query := `
		SELECT id, tenant_id, code, discount_id, rule_name, discount_type, discount_value, status, expires_at, created_at, updated_at
		FROM reseller_discounts
		WHERE tenant_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var discounts []*reseller.ResellerDiscount
	for rows.Next() {
		discount, err := r.scanDiscountFromRows(rows)
		if err != nil {
			return nil, err
		}
		discounts = append(discounts, discount)
	}

	return discounts, nil
}

// UpdateDiscount updates a reseller discount
func (r *ResellerRepository) UpdateDiscount(ctx context.Context, discount *reseller.ResellerDiscount) error {
	query := `
		UPDATE reseller_discounts
		SET code = $3, rule_name = $4, discount_type = $5, discount_value = $6, status = $7, expires_at = $8, updated_at = $9
		WHERE tenant_id = $1 AND id = $2
	`
	result, err := r.db.Exec(ctx, query,
		discount.TenantID, discount.ID, discount.Code, discount.RuleName,
		discount.DiscountType, discount.DiscountValue, discount.Status, discount.ExpiresAt, discount.UpdatedAt,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return errors.New("discount not found")
	}
	return nil
}

// DeleteDiscount deletes a reseller discount
func (r *ResellerRepository) DeleteDiscount(ctx context.Context, tenantID, id uuid.UUID) error {
	query := `DELETE FROM reseller_discounts WHERE tenant_id = $1 AND id = $2`
	result, err := r.db.Exec(ctx, query, tenantID, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return errors.New("discount not found")
	}
	return nil
}

// ========== Reseller Purchases ==========

// CreatePurchase creates a new reseller purchase
func (r *ResellerRepository) CreatePurchase(ctx context.Context, purchase *reseller.ResellerPurchase) error {
	query := `
		INSERT INTO reseller_purchases (
			id, tenant_id, reseller_id, voucher_package_id, router_id, quantity,
			unit_price, subtotal, discount_id, discount_amount, total_amount, margin,
			payment_method, status, notes, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`
	_, err := r.db.Exec(ctx, query,
		purchase.ID, purchase.TenantID, purchase.ResellerID, purchase.VoucherPackageID,
		purchase.RouterID, purchase.Quantity, purchase.UnitPrice, purchase.Subtotal,
		purchase.DiscountID, purchase.DiscountAmount, purchase.TotalAmount, purchase.Margin,
		purchase.PaymentMethod, purchase.Status, purchase.Notes,
		purchase.CreatedAt, purchase.UpdatedAt,
	)
	return err
}

// CreatePurchaseWithBalanceUpdate creates a new reseller purchase and deducts balance in a single transaction
func (r *ResellerRepository) CreatePurchaseWithBalanceUpdate(ctx context.Context, purchase *reseller.ResellerPurchase, deductAmount float64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Deduct balance if requested
	if deductAmount > 0 {
		updateQuery := `UPDATE resellers SET balance = balance - $1, updated_at = NOW() WHERE tenant_id = $2 AND id = $3`
		result, err := tx.Exec(ctx, updateQuery, deductAmount, purchase.TenantID, purchase.ResellerID)
		if err != nil {
			return fmt.Errorf("failed to deduct balance: %w", err)
		}
		if result.RowsAffected() == 0 {
			return ErrResellerNotFound
		}
	}

	// 2. Insert purchase record
	insertQuery := `
		INSERT INTO reseller_purchases (
			id, tenant_id, reseller_id, voucher_package_id, router_id, quantity,
			unit_price, subtotal, discount_id, discount_amount, total_amount, margin,
			payment_method, status, notes, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`
	_, err = tx.Exec(ctx, insertQuery,
		purchase.ID, purchase.TenantID, purchase.ResellerID, purchase.VoucherPackageID,
		purchase.RouterID, purchase.Quantity, purchase.UnitPrice, purchase.Subtotal,
		purchase.DiscountID, purchase.DiscountAmount, purchase.TotalAmount, purchase.Margin,
		purchase.PaymentMethod, purchase.Status, purchase.Notes,
		purchase.CreatedAt, purchase.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert purchase: %w", err)
	}

	return tx.Commit(ctx)
}

// GetPurchaseByID retrieves a purchase by ID
func (r *ResellerRepository) GetPurchaseByID(ctx context.Context, tenantID, id uuid.UUID) (*reseller.ResellerPurchase, error) {
	query := `
		SELECT rp.id, rp.tenant_id, rp.reseller_id, rp.voucher_package_id, rp.router_id, rp.quantity,
			   rp.unit_price, rp.subtotal, rp.discount_id, rp.discount_amount, rp.total_amount, rp.margin,
			   rp.payment_method, rp.status, rp.notes, rp.created_at, rp.updated_at,
			   c.name as reseller_name, vp.name as package_name, COALESCE(rd.code, '') as promo_code
		FROM reseller_purchases rp
		JOIN resellers res ON res.id = rp.reseller_id
		JOIN clients c ON c.id = res.client_id
		JOIN voucher_packages vp ON vp.id = rp.voucher_package_id
		LEFT JOIN reseller_discounts rd ON rd.id = rp.discount_id
		WHERE rp.tenant_id = $1 AND rp.id = $2
	`
	return r.scanPurchase(r.db.QueryRow(ctx, query, tenantID, id))
}

// DeletePurchase deletes a purchase history record
func (r *ResellerRepository) DeletePurchase(ctx context.Context, tenantID, id uuid.UUID) error {
	query := `DELETE FROM reseller_purchases WHERE tenant_id = $1 AND id = $2`
	result, err := r.db.Exec(ctx, query, tenantID, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return errors.New("purchase not found")
	}
	return nil
}

// UpdatePurchaseStatus updates the status of a reseller purchase
func (r *ResellerRepository) UpdatePurchaseStatus(ctx context.Context, tenantID, id uuid.UUID, status reseller.PurchaseStatus) error {
	query := `UPDATE reseller_purchases SET status = $3, updated_at = NOW() WHERE tenant_id = $1 AND id = $2`
	result, err := r.db.Exec(ctx, query, tenantID, id, status)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return errors.New("purchase not found")
	}
	return nil
}

// ListPurchases retrieves purchases with filters
func (r *ResellerRepository) ListPurchases(ctx context.Context, tenantID uuid.UUID, filter reseller.PurchaseListFilter) ([]*reseller.ResellerPurchase, int64, error) {
	baseQuery := `
		FROM reseller_purchases rp
		JOIN resellers res ON res.id = rp.reseller_id
		JOIN clients c ON c.id = res.client_id
		JOIN voucher_packages vp ON vp.id = rp.voucher_package_id
		LEFT JOIN reseller_discounts rd ON rd.id = rp.discount_id
		WHERE rp.tenant_id = $1
	`
	args := []interface{}{tenantID}
	argPos := 2

	// Apply filters
	if filter.ResellerID != nil {
		baseQuery += fmt.Sprintf(" AND rp.reseller_id = $%d", argPos)
		args = append(args, *filter.ResellerID)
		argPos++
	}

	if filter.Status != nil {
		baseQuery += fmt.Sprintf(" AND rp.status = $%d", argPos)
		args = append(args, *filter.Status)
		argPos++
	}

	if filter.DateFrom != nil {
		baseQuery += fmt.Sprintf(" AND rp.created_at >= $%d", argPos)
		args = append(args, *filter.DateFrom)
		argPos++
	}

	if filter.DateTo != nil {
		baseQuery += fmt.Sprintf(" AND rp.created_at <= $%d", argPos)
		args = append(args, *filter.DateTo)
		argPos++
	}

	// Count total
	var total int64
	countQuery := "SELECT COUNT(*) " + baseQuery
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Pagination
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	// Get data
	dataQuery := `
		SELECT rp.id, rp.tenant_id, rp.reseller_id, rp.voucher_package_id, rp.router_id, rp.quantity,
			   rp.unit_price, rp.subtotal, rp.discount_id, rp.discount_amount, rp.total_amount, rp.margin,
			   rp.payment_method, rp.status, rp.notes, rp.created_at, rp.updated_at,
			   c.name as reseller_name, vp.name as package_name, COALESCE(rd.code, '') as promo_code
	` + baseQuery + fmt.Sprintf(" ORDER BY rp.created_at DESC LIMIT $%d OFFSET $%d", argPos, argPos+1)
	args = append(args, pageSize, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var purchases []*reseller.ResellerPurchase
	for rows.Next() {
		purchase, err := r.scanPurchaseFromRows(rows)
		if err != nil {
			return nil, 0, err
		}
		purchases = append(purchases, purchase)
	}

	return purchases, total, nil
}

// ========== Scanner helpers ==========

func (r *ResellerRepository) scanReseller(row pgx.Row) (*reseller.Reseller, error) {
	var res reseller.Reseller
	err := row.Scan(
		&res.ID, &res.TenantID, &res.ClientID, &res.Status, &res.JoinDate, &res.Notes, &res.Balance, &res.ResellerRadius, &res.CreatedAt, &res.UpdatedAt,
		&res.ClientName, &res.ClientPhone, &res.ClientEmail,
		&res.MonthlyRevenue, &res.TotalPurchases,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrResellerNotFound
		}
		return nil, err
	}
	return &res, nil
}

func (r *ResellerRepository) scanResellerFromRows(rows pgx.Rows) (*reseller.Reseller, error) {
	var res reseller.Reseller
	err := rows.Scan(
		&res.ID, &res.TenantID, &res.ClientID, &res.Status, &res.JoinDate, &res.Notes, &res.Balance, &res.ResellerRadius, &res.CreatedAt, &res.UpdatedAt,
		&res.ClientName, &res.ClientPhone, &res.ClientEmail,
		&res.MonthlyRevenue, &res.TotalPurchases,
	)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (r *ResellerRepository) scanPrice(row pgx.Row) (*reseller.ResellerPrice, error) {
	var price reseller.ResellerPrice
	err := row.Scan(&price.ID, &price.TenantID, &price.ResellerID, &price.VoucherPackageID,
		&price.ResellerPrice, &price.RetailPrice, &price.Margin, &price.CreatedAt, &price.UpdatedAt,
		&price.VoucherPackageName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrResellerPriceNotFound
		}
		return nil, err
	}
	return &price, nil
}

func (r *ResellerRepository) scanPriceFromRows(rows pgx.Rows) (*reseller.ResellerPrice, error) {
	var price reseller.ResellerPrice
	err := rows.Scan(&price.ID, &price.TenantID, &price.ResellerID, &price.VoucherPackageID,
		&price.ResellerPrice, &price.RetailPrice, &price.Margin, &price.CreatedAt, &price.UpdatedAt,
		&price.VoucherPackageName)
	if err != nil {
		return nil, err
	}
	return &price, nil
}

func (r *ResellerRepository) scanDiscount(row pgx.Row) (*reseller.ResellerDiscount, error) {
	var discount reseller.ResellerDiscount
	err := row.Scan(&discount.ID, &discount.TenantID, &discount.Code, &discount.DiscountID, &discount.RuleName,
		&discount.DiscountType, &discount.DiscountValue, &discount.Status, &discount.ExpiresAt,
		&discount.CreatedAt, &discount.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("discount not found")
		}
		return nil, err
	}
	return &discount, nil
}

func (r *ResellerRepository) scanDiscountFromRows(rows pgx.Rows) (*reseller.ResellerDiscount, error) {
	var discount reseller.ResellerDiscount
	err := rows.Scan(&discount.ID, &discount.TenantID, &discount.Code, &discount.DiscountID, &discount.RuleName,
		&discount.DiscountType, &discount.DiscountValue, &discount.Status, &discount.ExpiresAt,
		&discount.CreatedAt, &discount.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &discount, nil
}

func (r *ResellerRepository) scanPurchase(row pgx.Row) (*reseller.ResellerPurchase, error) {
	var purchase reseller.ResellerPurchase
	err := row.Scan(
		&purchase.ID, &purchase.TenantID, &purchase.ResellerID, &purchase.VoucherPackageID,
		&purchase.RouterID, &purchase.Quantity, &purchase.UnitPrice, &purchase.Subtotal,
		&purchase.DiscountID, &purchase.DiscountAmount, &purchase.TotalAmount, &purchase.Margin,
		&purchase.PaymentMethod, &purchase.Status, &purchase.Notes,
		&purchase.CreatedAt, &purchase.UpdatedAt,
		&purchase.ResellerName, &purchase.VoucherPackageName, &purchase.PromoCode,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("purchase not found")
		}
		return nil, err
	}
	return &purchase, nil
}

func (r *ResellerRepository) scanPurchaseFromRows(rows pgx.Rows) (*reseller.ResellerPurchase, error) {
	var purchase reseller.ResellerPurchase
	err := rows.Scan(
		&purchase.ID, &purchase.TenantID, &purchase.ResellerID, &purchase.VoucherPackageID,
		&purchase.RouterID, &purchase.Quantity, &purchase.UnitPrice, &purchase.Subtotal,
		&purchase.DiscountID, &purchase.DiscountAmount, &purchase.TotalAmount, &purchase.Margin,
		&purchase.PaymentMethod, &purchase.Status, &purchase.Notes,
		&purchase.CreatedAt, &purchase.UpdatedAt,
		&purchase.ResellerName, &purchase.VoucherPackageName, &purchase.PromoCode,
	)
	if err != nil {
		return nil, err
	}
	return &purchase, nil
}

func (r *ResellerRepository) GetPurchaseByIDRaw(ctx context.Context, id uuid.UUID) (*reseller.ResellerPurchase, error) {
	query := `
		SELECT rp.id, rp.tenant_id, rp.reseller_id, rp.voucher_package_id, rp.router_id, rp.quantity,
			rp.unit_price, rp.subtotal, rp.discount_id, rp.discount_amount, rp.total_amount, rp.margin,
			rp.payment_method, rp.status, rp.notes, rp.created_at, rp.updated_at,
			r.name as reseller_name, vp.name as voucher_package_name, '' as promo_code
		FROM reseller_purchases rp
		JOIN resellers r ON r.id = rp.reseller_id
		JOIN voucher_packages vp ON vp.id = rp.voucher_package_id
		WHERE rp.id = $1
	`
	var p reseller.ResellerPurchase
	err := r.db.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.TenantID, &p.ResellerID, &p.VoucherPackageID, &p.RouterID, &p.Quantity,
		&p.UnitPrice, &p.Subtotal, &p.DiscountID, &p.DiscountAmount, &p.TotalAmount, &p.Margin,
		&p.PaymentMethod, &p.Status, &p.Notes, &p.CreatedAt, &p.UpdatedAt,
		&p.ResellerName, &p.VoucherPackageName, &p.PromoCode,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("purchase not found")
	}
	return &p, err
}

