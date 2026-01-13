package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/billing"
)

type InvoiceRepository struct {
	db *pgxpool.Pool
}

func NewInvoiceRepository(db *pgxpool.Pool) *InvoiceRepository {
	return &InvoiceRepository{db: db}
}

func (r *InvoiceRepository) HasAnyInvoiceForClient(ctx context.Context, tenantID, clientID uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM invoices WHERE tenant_id = $1 AND client_id = $2)`
	var exists bool
	if err := r.db.QueryRow(ctx, query, tenantID, clientID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

// ExistsForClientPeriod checks if an invoice already exists for the given tenant, client, and period (start/end dates)
func (r *InvoiceRepository) ExistsForClientPeriod(ctx context.Context, tenantID, clientID uuid.UUID, periodStart, periodEnd time.Time) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM invoices WHERE tenant_id = $1 AND client_id = $2 AND period_start = $3 AND period_end = $4)`
	var exists bool
	if err := r.db.QueryRow(ctx, query, tenantID, clientID, periodStart, periodEnd).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (r *InvoiceRepository) Create(ctx context.Context, invoice *billing.Invoice) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `
		INSERT INTO invoices (
			id, tenant_id, client_id, invoice_number, period_start, period_end,
			due_date, subtotal, tax_amount, discount_amount, total_amount,
			paid_amount, currency, status, notes, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`
	_, err = tx.Exec(ctx, query,
		invoice.ID, invoice.TenantID, invoice.ClientID, invoice.InvoiceNumber,
		invoice.PeriodStart, invoice.PeriodEnd, invoice.DueDate,
		invoice.Subtotal, invoice.TaxAmount, invoice.DiscountAmount, invoice.TotalAmount,
		invoice.PaidAmount, invoice.Currency, invoice.Status, invoice.Notes,
		invoice.CreatedAt, invoice.UpdatedAt,
	)
	if err != nil {
		return err
	}

	// Insert invoice items
	for _, item := range invoice.Items {
		itemQuery := `
			INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, amount, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`
		_, err = tx.Exec(ctx, itemQuery,
			item.ID, invoice.ID, item.Description, item.Quantity, item.UnitPrice, item.Amount, item.CreatedAt,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *InvoiceRepository) GetByID(ctx context.Context, id uuid.UUID) (*billing.Invoice, error) {
	query := `
		SELECT id, tenant_id, client_id, invoice_number, period_start, period_end,
			due_date, subtotal, tax_amount, discount_amount, total_amount,
			paid_amount, currency, status, notes, created_at, updated_at, paid_at
		FROM invoices
		WHERE id = $1
	`
	var invoice billing.Invoice
	err := r.db.QueryRow(ctx, query, id).Scan(
		&invoice.ID, &invoice.TenantID, &invoice.ClientID, &invoice.InvoiceNumber,
		&invoice.PeriodStart, &invoice.PeriodEnd, &invoice.DueDate,
		&invoice.Subtotal, &invoice.TaxAmount, &invoice.DiscountAmount, &invoice.TotalAmount,
		&invoice.PaidAmount, &invoice.Currency, &invoice.Status, &invoice.Notes,
		&invoice.CreatedAt, &invoice.UpdatedAt, &invoice.PaidAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("invoice not found")
	}
	if err != nil {
		return nil, err
	}

	// Get items
	items, err := r.GetInvoiceItems(ctx, invoice.ID)
	if err != nil {
		return nil, err
	}
	invoice.Items = items

	return &invoice, nil
}

func (r *InvoiceRepository) GetInvoiceItems(ctx context.Context, invoiceID uuid.UUID) ([]billing.InvoiceItem, error) {
	query := `
		SELECT id, invoice_id, description, quantity, unit_price, amount, created_at
		FROM invoice_items
		WHERE invoice_id = $1
		ORDER BY created_at
	`
	rows, err := r.db.Query(ctx, query, invoiceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []billing.InvoiceItem
	for rows.Next() {
		var item billing.InvoiceItem
		err := rows.Scan(
			&item.ID, &item.InvoiceID, &item.Description, &item.Quantity,
			&item.UnitPrice, &item.Amount, &item.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

// GetInvoiceYears returns distinct years that have invoices for the given tenant.
func (r *InvoiceRepository) GetInvoiceYears(ctx context.Context, tenantID uuid.UUID) ([]int, error) {
	query := `
		SELECT DISTINCT EXTRACT(YEAR FROM period_start)::INT AS y
		FROM invoices
		WHERE tenant_id = $1
		ORDER BY y ASC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var years []int
	for rows.Next() {
		var y int
		if err := rows.Scan(&y); err != nil {
			return nil, err
		}
		years = append(years, y)
	}
	return years, nil
}

type InvoiceFilter struct {
	TenantID      uuid.UUID
	ClientID      *uuid.UUID
	ClientName    *string
	ClientPhone   *string
	ClientAddress *string
	GroupID       *uuid.UUID
	Status        *billing.InvoiceStatus
	StartDate     *time.Time
	EndDate       *time.Time
	Page          int
	PageSize      int
}

func (r *InvoiceRepository) List(ctx context.Context, filter InvoiceFilter) ([]*billing.Invoice, int, error) {
	baseQuery := `FROM invoices i
		INNER JOIN clients c ON c.id = i.client_id
		LEFT JOIN client_groups g ON g.id = c.group_id
		WHERE i.tenant_id = $1`
	args := []interface{}{filter.TenantID}
	argIdx := 2

	if filter.ClientID != nil {
		baseQuery += fmt.Sprintf(" AND i.client_id = $%d", argIdx)
		args = append(args, *filter.ClientID)
		argIdx++
	}
	if filter.ClientName != nil && *filter.ClientName != "" {
		baseQuery += fmt.Sprintf(" AND c.name ILIKE $%d", argIdx)
		args = append(args, "%"+*filter.ClientName+"%")
		argIdx++
	}
	if filter.ClientPhone != nil && *filter.ClientPhone != "" {
		baseQuery += fmt.Sprintf(" AND c.phone ILIKE $%d", argIdx)
		args = append(args, "%"+*filter.ClientPhone+"%")
		argIdx++
	}
	if filter.ClientAddress != nil && *filter.ClientAddress != "" {
		baseQuery += fmt.Sprintf(" AND c.address ILIKE $%d", argIdx)
		args = append(args, "%"+*filter.ClientAddress+"%")
		argIdx++
	}
	if filter.GroupID != nil {
		baseQuery += fmt.Sprintf(" AND c.group_id = $%d", argIdx)
		args = append(args, *filter.GroupID)
		argIdx++
	}
	if filter.Status != nil {
		baseQuery += fmt.Sprintf(" AND i.status = $%d", argIdx)
		args = append(args, *filter.Status)
		argIdx++
	}
	if filter.StartDate != nil {
		baseQuery += fmt.Sprintf(" AND i.period_start >= $%d", argIdx)
		args = append(args, *filter.StartDate)
		argIdx++
	}
	if filter.EndDate != nil {
		baseQuery += fmt.Sprintf(" AND i.period_end <= $%d", argIdx)
		args = append(args, *filter.EndDate)
		argIdx++
	}

	// Count total
	var total int
	countQuery := "SELECT COUNT(*) " + baseQuery
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get data with pagination
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 {
		filter.PageSize = 20
	}
	offset := (filter.Page - 1) * filter.PageSize

	dataQuery := `
		SELECT i.id, i.tenant_id, i.client_id, 
			c.name as client_name, c.phone as client_phone, c.address as client_address,
			g.name as client_group_name,
			i.invoice_number, i.period_start, i.period_end,
			i.due_date, i.subtotal, i.tax_amount, i.discount_amount, i.total_amount,
			i.paid_amount, i.currency, i.status, i.notes, i.created_at, i.updated_at, i.paid_at
	` + baseQuery + fmt.Sprintf(" ORDER BY i.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, filter.PageSize, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var invoices []*billing.Invoice
	for rows.Next() {
		var inv billing.Invoice
		err := rows.Scan(
			&inv.ID, &inv.TenantID, &inv.ClientID,
			&inv.ClientName, &inv.ClientPhone, &inv.ClientAddress,
			&inv.ClientGroupName,
			&inv.InvoiceNumber, &inv.PeriodStart, &inv.PeriodEnd,
			&inv.DueDate, &inv.Subtotal, &inv.TaxAmount, &inv.DiscountAmount, &inv.TotalAmount,
			&inv.PaidAmount, &inv.Currency, &inv.Status, &inv.Notes,
			&inv.CreatedAt, &inv.UpdatedAt, &inv.PaidAt,
		)
		if err != nil {
			return nil, 0, err
		}
		invoices = append(invoices, &inv)
	}

	return invoices, total, nil
}

func (r *InvoiceRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status billing.InvoiceStatus) error {
	query := `UPDATE invoices SET status = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, status)
	return err
}

func (r *InvoiceRepository) UpdatePaidAmount(ctx context.Context, id uuid.UUID, amount int64, paidAt *time.Time) error {
	query := `UPDATE invoices SET paid_amount = $2, paid_at = $3, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, amount, paidAt)
	return err
}

func (r *InvoiceRepository) GetOverdueInvoices(ctx context.Context, tenantID uuid.UUID) ([]*billing.Invoice, error) {
	query := `
		SELECT id, tenant_id, client_id, invoice_number, period_start, period_end,
			due_date, subtotal, tax_amount, discount_amount, total_amount,
			paid_amount, currency, status, notes, created_at, updated_at, paid_at
		FROM invoices
		WHERE tenant_id = $1 AND status = 'pending' AND due_date < NOW()
		ORDER BY due_date ASC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invoices []*billing.Invoice
	for rows.Next() {
		var inv billing.Invoice
		err := rows.Scan(
			&inv.ID, &inv.TenantID, &inv.ClientID, &inv.InvoiceNumber,
			&inv.PeriodStart, &inv.PeriodEnd, &inv.DueDate,
			&inv.Subtotal, &inv.TaxAmount, &inv.DiscountAmount, &inv.TotalAmount,
			&inv.PaidAmount, &inv.Currency, &inv.Status, &inv.Notes,
			&inv.CreatedAt, &inv.UpdatedAt, &inv.PaidAt,
		)
		if err != nil {
			return nil, err
		}
		invoices = append(invoices, &inv)
	}

	return invoices, nil
}

func (r *InvoiceRepository) GetClientPendingInvoices(ctx context.Context, clientID uuid.UUID) ([]*billing.Invoice, error) {
	query := `
		SELECT id, tenant_id, client_id, invoice_number, period_start, period_end,
			due_date, subtotal, tax_amount, discount_amount, total_amount,
			paid_amount, currency, status, notes, created_at, updated_at, paid_at
		FROM invoices
		WHERE client_id = $1 AND status IN ('pending', 'overdue')
		ORDER BY due_date ASC
	`
	rows, err := r.db.Query(ctx, query, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invoices []*billing.Invoice
	for rows.Next() {
		var inv billing.Invoice
		err := rows.Scan(
			&inv.ID, &inv.TenantID, &inv.ClientID, &inv.InvoiceNumber,
			&inv.PeriodStart, &inv.PeriodEnd, &inv.DueDate,
			&inv.Subtotal, &inv.TaxAmount, &inv.DiscountAmount, &inv.TotalAmount,
			&inv.PaidAmount, &inv.Currency, &inv.Status, &inv.Notes,
			&inv.CreatedAt, &inv.UpdatedAt, &inv.PaidAt,
		)
		if err != nil {
			return nil, err
		}
		invoices = append(invoices, &inv)
	}

	return invoices, nil
}

func (r *InvoiceRepository) GenerateInvoiceNumber(ctx context.Context, tenantID uuid.UUID) (string, error) {
	// Format: INV-YYYYMM-XXXX
	now := time.Now()
	prefix := fmt.Sprintf("INV-%d%02d-", now.Year(), now.Month())
	
	query := `
		SELECT COUNT(*) + 1 FROM invoices 
		WHERE tenant_id = $1 AND invoice_number LIKE $2
	`
	var seq int
	err := r.db.QueryRow(ctx, query, tenantID, prefix+"%").Scan(&seq)
	if err != nil {
		return "", err
	}
	
	return fmt.Sprintf("%s%04d", prefix, seq), nil
}


