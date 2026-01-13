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

type PaymentRepository struct {
	db *pgxpool.Pool
}

func NewPaymentRepository(db *pgxpool.Pool) *PaymentRepository {
	return &PaymentRepository{db: db}
}

func (r *PaymentRepository) Create(ctx context.Context, payment *billing.Payment) error {
	query := `
		INSERT INTO payments (
			id, tenant_id, invoice_id, client_id, amount, currency, method,
			reference, collector_id, notes, received_at, created_at, created_by_user_id
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	_, err := r.db.Exec(ctx, query,
		payment.ID, payment.TenantID, payment.InvoiceID, payment.ClientID,
		payment.Amount, payment.Currency, payment.Method, payment.Reference,
		payment.CollectorID, payment.Notes, payment.ReceivedAt, payment.CreatedAt,
		payment.CreatedByUserID,
	)
	return err
}

func (r *PaymentRepository) GetByID(ctx context.Context, id uuid.UUID) (*billing.Payment, error) {
	query := `
		SELECT p.id, p.tenant_id, p.invoice_id, p.client_id,
			c.name as client_name,
			p.amount, p.currency, p.method,
			p.reference, p.collector_id, p.notes, p.received_at, p.created_at, p.created_by_user_id
		FROM payments p
		LEFT JOIN clients c ON c.id = p.client_id
		WHERE p.id = $1
	`
	var payment billing.Payment
	err := r.db.QueryRow(ctx, query, id).Scan(
		&payment.ID, &payment.TenantID, &payment.InvoiceID, &payment.ClientID,
		&payment.ClientName,
		&payment.Amount, &payment.Currency, &payment.Method, &payment.Reference,
		&payment.CollectorID, &payment.Notes, &payment.ReceivedAt, &payment.CreatedAt,
		&payment.CreatedByUserID,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("payment not found")
	}
	return &payment, err
}

func (r *PaymentRepository) ListByInvoice(ctx context.Context, invoiceID uuid.UUID) ([]*billing.Payment, error) {
	query := `
		SELECT p.id, p.tenant_id, p.invoice_id, p.client_id,
			c.name as client_name,
			p.amount, p.currency, p.method,
			p.reference, p.collector_id, p.notes, p.received_at, p.created_at, p.created_by_user_id
		FROM payments p
		LEFT JOIN clients c ON c.id = p.client_id
		WHERE p.invoice_id = $1
		ORDER BY p.received_at DESC
	`
	rows, err := r.db.Query(ctx, query, invoiceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []*billing.Payment
	for rows.Next() {
		var p billing.Payment
		err := rows.Scan(
			&p.ID, &p.TenantID, &p.InvoiceID, &p.ClientID,
			&p.ClientName,
			&p.Amount, &p.Currency, &p.Method, &p.Reference,
			&p.CollectorID, &p.Notes, &p.ReceivedAt, &p.CreatedAt,
			&p.CreatedByUserID,
		)
		if err != nil {
			return nil, err
		}
		payments = append(payments, &p)
	}
	return payments, nil
}

type PaymentFilter struct {
	TenantID    uuid.UUID
	ClientID    *uuid.UUID
	CollectorID *uuid.UUID
	Method      *billing.PaymentMethod
	StartDate   *time.Time
	EndDate     *time.Time
	Page        int
	PageSize    int
}

func (r *PaymentRepository) List(ctx context.Context, filter PaymentFilter) ([]*billing.Payment, int, error) {
	baseQuery := ` FROM payments p LEFT JOIN clients c ON c.id = p.client_id WHERE p.tenant_id = $1`
	args := []interface{}{filter.TenantID}
	argIdx := 2

	if filter.ClientID != nil {
		baseQuery += fmt.Sprintf(" AND p.client_id = $%d", argIdx)
		args = append(args, *filter.ClientID)
		argIdx++
	}
	if filter.CollectorID != nil {
		baseQuery += fmt.Sprintf(" AND p.collector_id = $%d", argIdx)
		args = append(args, *filter.CollectorID)
		argIdx++
	}
	if filter.Method != nil {
		baseQuery += fmt.Sprintf(" AND p.method = $%d", argIdx)
		args = append(args, *filter.Method)
		argIdx++
	}
	if filter.StartDate != nil {
		baseQuery += fmt.Sprintf(" AND p.received_at >= $%d", argIdx)
		args = append(args, *filter.StartDate)
		argIdx++
	}
	if filter.EndDate != nil {
		baseQuery += fmt.Sprintf(" AND p.received_at <= $%d", argIdx)
		args = append(args, *filter.EndDate)
		argIdx++
	}

	// Count total
	var total int
	countQuery := "SELECT COUNT(*)" + baseQuery
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
		SELECT p.id, p.tenant_id, p.invoice_id, p.client_id,
			c.name as client_name,
			p.amount, p.currency, p.method,
			p.reference, p.collector_id, p.notes, p.received_at, p.created_at, p.created_by_user_id
	` + baseQuery + fmt.Sprintf(" ORDER BY p.received_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, filter.PageSize, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var payments []*billing.Payment
	for rows.Next() {
		var p billing.Payment
		err := rows.Scan(
			&p.ID, &p.TenantID, &p.InvoiceID, &p.ClientID,
			&p.ClientName,
			&p.Amount, &p.Currency, &p.Method, &p.Reference,
			&p.CollectorID, &p.Notes, &p.ReceivedAt, &p.CreatedAt,
			&p.CreatedByUserID,
		)
		if err != nil {
			return nil, 0, err
		}
		payments = append(payments, &p)
	}

	return payments, total, nil
}

func (r *PaymentRepository) GetTotalByInvoice(ctx context.Context, invoiceID uuid.UUID) (int64, error) {
	query := `SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = $1`
	var total int64
	err := r.db.QueryRow(ctx, query, invoiceID).Scan(&total)
	return total, err
}

// GetByInvoiceID is an alias for ListByInvoice (returns first payment or nil)
func (r *PaymentRepository) GetByInvoiceID(ctx context.Context, invoiceID uuid.UUID) (*billing.Payment, error) {
	payments, err := r.ListByInvoice(ctx, invoiceID)
	if err != nil {
		return nil, err
	}
	if len(payments) == 0 {
		return nil, fmt.Errorf("payment not found for invoice")
	}
	return payments[0], nil
}

// GetByClientID returns payments for a client (uses List with filter)
func (r *PaymentRepository) GetByClientID(ctx context.Context, tenantID, clientID uuid.UUID) ([]*billing.Payment, error) {
	filter := PaymentFilter{
		TenantID: tenantID,
		ClientID: &clientID,
	}
	payments, _, err := r.List(ctx, filter)
	return payments, err
}

func (r *PaymentRepository) GetSummary(ctx context.Context, tenantID uuid.UUID, startDate, endDate time.Time) (*billing.BillingSummary, error) {
	query := `
		SELECT
			COUNT(*) FILTER (WHERE status != 'cancelled') as total_invoices,
			COUNT(*) FILTER (WHERE status = 'pending') as pending_invoices,
			COUNT(*) FILTER (WHERE status = 'overdue') as overdue_invoices,
			COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
			COALESCE(SUM(paid_amount) FILTER (WHERE status = 'paid'), 0) as total_revenue,
			COALESCE(SUM(total_amount - paid_amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
			COALESCE(SUM(total_amount - paid_amount) FILTER (WHERE status = 'overdue'), 0) as overdue_amount
		FROM invoices
		WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
	`
	var summary billing.BillingSummary
	err := r.db.QueryRow(ctx, query, tenantID, startDate, endDate).Scan(
		&summary.TotalInvoices, &summary.PendingInvoices, &summary.OverdueInvoices,
		&summary.PaidInvoices, &summary.TotalRevenue, &summary.PendingAmount, &summary.OverdueAmount,
	)
	if err != nil {
		return nil, err
	}

	// Get collected this month
	monthStart := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.Local)
	collectQuery := `SELECT COALESCE(SUM(amount), 0) FROM payments WHERE tenant_id = $1 AND received_at >= $2`
	err = r.db.QueryRow(ctx, collectQuery, tenantID, monthStart).Scan(&summary.CollectedThisMonth)
	if err != nil {
		return nil, err
	}

	return &summary, nil
}


