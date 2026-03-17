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

func (r *PaymentRepository) CheckDuplicatePending(ctx context.Context, invoiceID, collectorID uuid.UUID, amount int64, since time.Time) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM payments 
			WHERE invoice_id = $1 
			AND collector_id = $2 
			AND amount = $3 
			AND status = 'pending'
			AND created_at > $4
		)
	`
	var exists bool
	err := r.db.QueryRow(ctx, query, invoiceID, collectorID, amount, since).Scan(&exists)
	return exists, err
}

func (r *PaymentRepository) Create(ctx context.Context, payment *billing.Payment) error {
	query := `
		INSERT INTO payments (
			id, tenant_id, invoice_id, client_id, amount, currency, method,
			reference, collector_id, notes, status, received_at, created_at, created_by_user_id
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`
	_, err := r.db.Exec(ctx, query,
		payment.ID, payment.TenantID, payment.InvoiceID, payment.ClientID,
		payment.Amount, payment.Currency, payment.Method, payment.Reference,
		payment.CollectorID, payment.Notes, payment.Status, payment.ReceivedAt, payment.CreatedAt,
		payment.CreatedByUserID,
	)
	return err
}

func (r *PaymentRepository) GetByID(ctx context.Context, id uuid.UUID) (*billing.Payment, error) {
	query := `
		SELECT p.id, p.tenant_id, p.invoice_id, p.client_id,
			c.name as client_name,
			p.amount, p.currency, p.method,
			p.reference, p.collector_id, u.name as collector_name, p.notes, p.status, p.received_at, p.created_at, p.created_by_user_id
		FROM payments p
		LEFT JOIN clients c ON c.id = p.client_id
		LEFT JOIN users u ON u.id = p.collector_id
		WHERE p.id = $1
	`
	var payment billing.Payment
	err := r.db.QueryRow(ctx, query, id).Scan(
		&payment.ID, &payment.TenantID, &payment.InvoiceID, &payment.ClientID,
		&payment.ClientName,
		&payment.Amount, &payment.Currency, &payment.Method, &payment.Reference,
		&payment.CollectorID, &payment.CollectorName, &payment.Notes, &payment.Status, &payment.ReceivedAt, &payment.CreatedAt,
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
			p.reference, p.collector_id, u.name as collector_name, p.notes, p.status, p.received_at, p.created_at, p.created_by_user_id
		FROM payments p
		LEFT JOIN clients c ON c.id = p.client_id
		LEFT JOIN users u ON u.id = p.collector_id
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
			&p.CollectorID, &p.CollectorName, &p.Notes, &p.Status, &p.ReceivedAt, &p.CreatedAt,
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
	Status      *billing.PaymentStatus
}

func (r *PaymentRepository) List(ctx context.Context, filter PaymentFilter) ([]*billing.Payment, int, error) {
	baseQuery := ` FROM payments p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN users u ON u.id = p.collector_id WHERE p.tenant_id = $1`
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
	if filter.Status != nil {
		baseQuery += fmt.Sprintf(" AND p.status = $%d", argIdx)
		args = append(args, *filter.Status)
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
			p.reference, p.collector_id, u.name as collector_name, p.notes, p.status, p.received_at, p.created_at, p.created_by_user_id
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
			&p.CollectorID, &p.CollectorName, &p.Notes, &p.Status, &p.ReceivedAt, &p.CreatedAt,
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
	// 1. Get invoice counts and receivables (Global/All time for receivables)
	invoiceQuery := `
		SELECT
			COUNT(*) FILTER (WHERE status != 'cancelled') as total_invoices,
			COUNT(*) FILTER (WHERE status = 'pending' AND due_date >= CURRENT_DATE) as pending_invoices,
			COUNT(*) FILTER (WHERE status = 'overdue' OR (status = 'pending' AND due_date < CURRENT_DATE)) as overdue_invoices,
			COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
			COALESCE(SUM(total_amount - paid_amount) FILTER (WHERE status = 'pending' AND due_date >= CURRENT_DATE), 0) as pending_amount,
			COALESCE(SUM(total_amount - paid_amount) FILTER (WHERE status = 'overdue' OR (status = 'pending' AND due_date < CURRENT_DATE)), 0) as overdue_amount
		FROM invoices
		WHERE tenant_id = $1 AND status != 'cancelled'
	`
	var summary billing.BillingSummary
	err := r.db.QueryRow(ctx, invoiceQuery, tenantID).Scan(
		&summary.TotalInvoices, &summary.PendingInvoices, &summary.OverdueInvoices,
		&summary.PaidInvoices, &summary.PendingAmount, &summary.OverdueAmount,
	)
	if err != nil {
		return nil, err
	}

	// 2. Get total revenue in the specified period (based on payment date)
	revenueQuery := `
		SELECT COALESCE(SUM(amount), 0)
		FROM payments
		WHERE tenant_id = $1 AND received_at BETWEEN $2 AND $3
	`
	err = r.db.QueryRow(ctx, revenueQuery, tenantID, startDate, endDate).Scan(&summary.TotalRevenue)
	if err != nil {
		return nil, err
	}

	// 3. Get collected this month
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	monthEnd := monthStart.AddDate(0, 1, 0)
	collectQuery := `SELECT COALESCE(SUM(amount), 0) FROM payments WHERE tenant_id = $1 AND received_at >= $2 AND received_at < $3`
	err = r.db.QueryRow(ctx, collectQuery, tenantID, monthStart, monthEnd).Scan(&summary.CollectedThisMonth)
	if err != nil {
		return nil, err
	}

	return &summary, nil
}

func (r *PaymentRepository) GetRevenueAnalytics(ctx context.Context, tenantID uuid.UUID, startDate, endDate time.Time, interval string) (*billing.RevenueAnalytics, error) {
	analytics := &billing.RevenueAnalytics{
		Trend:            []billing.RevenueTrendItem{},
		ByGroup:          []billing.RevenueByGroup{},
		ByConnectionType: []billing.RevenueByConn{},
	}

	// 1. Trend
	var timeTrunc string
	switch interval {
	case "daily":
		timeTrunc = "day"
	case "weekly":
		timeTrunc = "week"
	case "yearly":
		timeTrunc = "year"
	default:
		timeTrunc = "month"
	}

	trendQuery := fmt.Sprintf(`
		SELECT date_trunc('%s', received_at) as period, COALESCE(SUM(amount), 0)
		FROM payments
		WHERE tenant_id = $1 AND received_at BETWEEN $2 AND $3
		GROUP BY period
		ORDER BY period ASC
	`, timeTrunc)

	rows, err := r.db.Query(ctx, trendQuery, tenantID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item billing.RevenueTrendItem
		var period time.Time
		if err := rows.Scan(&period, &item.Amount); err != nil {
			return nil, err
		}
		item.Date = period.Format(time.RFC3339)
		analytics.Trend = append(analytics.Trend, item)
	}

	// 2. By Group
	groupQuery := `
		SELECT c.group_id, COALESCE(cg.name, 'No Group'), SUM(p.amount)
		FROM payments p
		JOIN clients c ON c.id = p.client_id
		LEFT JOIN client_groups cg ON cg.id = c.group_id
		WHERE p.tenant_id = $1 AND p.received_at BETWEEN $2 AND $3
		GROUP BY c.group_id, cg.name
		ORDER BY SUM(p.amount) DESC
	`
	gRows, err := r.db.Query(ctx, groupQuery, tenantID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer gRows.Close()

	for gRows.Next() {
		var item billing.RevenueByGroup
		var groupID *uuid.UUID
		if err := gRows.Scan(&groupID, &item.GroupName, &item.Amount); err != nil {
			return nil, err
		}
		if groupID != nil {
			item.GroupID = *groupID
		}
		analytics.ByGroup = append(analytics.ByGroup, item)
	}

	// 3. By Connection Type
	connQuery := `
		SELECT COALESCE(c.connection_type, 'unknown'), SUM(p.amount)
		FROM payments p
		JOIN clients c ON c.id = p.client_id
		WHERE p.tenant_id = $1 AND p.received_at BETWEEN $2 AND $3
		GROUP BY c.connection_type
		ORDER BY SUM(p.amount) DESC
	`
	cRows, err := r.db.Query(ctx, connQuery, tenantID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer cRows.Close()

	for cRows.Next() {
		var item billing.RevenueByConn
		if err := cRows.Scan(&item.ConnectionType, &item.Amount); err != nil {
			return nil, err
		}
		analytics.ByConnectionType = append(analytics.ByConnectionType, item)
	}

	// 4. Period Totals
	totalQuery := `SELECT COALESCE(SUM(amount), 0) FROM payments WHERE tenant_id = $1 AND received_at BETWEEN $2 AND $3`
	err = r.db.QueryRow(ctx, totalQuery, tenantID, startDate, endDate).Scan(&analytics.PeriodTotal)
	if err != nil {
		return nil, err
	}

	duration := endDate.Sub(startDate)
	prevStart := startDate.Add(-duration)
	prevEnd := startDate
	err = r.db.QueryRow(ctx, totalQuery, tenantID, prevStart, prevEnd).Scan(&analytics.PreviousPeriodTotal)
	if err != nil {
		// Non-critical, just default to 0
		analytics.PreviousPeriodTotal = 0
	}

	return analytics, nil
}

// UpdateStatus updates the status of payments
func (r *PaymentRepository) UpdateStatus(ctx context.Context, tenantID, collectorID uuid.UUID, date time.Time, status billing.PaymentStatus) error {
	query := `
		UPDATE payments
		SET status = $1
		WHERE tenant_id = $2 AND collector_id = $3 AND date_trunc('day', received_at) = date_trunc('day', $4::timestamp)
	`
	_, err := r.db.Exec(ctx, query, status, tenantID, collectorID, date)
	return err
}

type Settlement struct {
	CollectorID    uuid.UUID             `json:"collector_id"`
	CollectorName  string                `json:"collector_name"`
	Date           string                `json:"date"`
	Amount         int64                 `json:"amount"`
	Count          int                   `json:"count"`
	Status         billing.PaymentStatus `json:"status"`
	FirstPaymentAt time.Time             `json:"first_payment_at"`
}

// GetSettlements aggregates payments by collector and date
func (r *PaymentRepository) GetSettlements(ctx context.Context, tenantID uuid.UUID, startDate, endDate time.Time, status *billing.PaymentStatus, collectorID *uuid.UUID) ([]*Settlement, error) {
	baseQuery := `
		SELECT
			p.collector_id,
			u.name as collector_name,
			date_trunc('day', p.received_at) as day,
			p.status as status,
			SUM(p.amount) as amount,
			COUNT(p.id) as count,
			MIN(p.received_at) as first_payment_at
		FROM payments p
		LEFT JOIN users u ON u.id = p.collector_id
		WHERE p.tenant_id = $1 AND p.method = 'collector' AND p.received_at BETWEEN $2 AND $3
	`
	args := []interface{}{tenantID, startDate, endDate}
	argIdx := 4

	if status != nil {
		baseQuery += fmt.Sprintf(" AND p.status = $%d", argIdx)
		args = append(args, *status)
		argIdx++
	}
	if collectorID != nil {
		baseQuery += fmt.Sprintf(" AND p.collector_id = $%d", argIdx)
		args = append(args, *collectorID)
		argIdx++
	}

	baseQuery += `
		GROUP BY p.collector_id, u.name, day, p.status
		ORDER BY day DESC, u.name ASC
	`

	rows, err := r.db.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var settlements []*Settlement
	for rows.Next() {
		var s Settlement
		var day time.Time
		err := rows.Scan(
			&s.CollectorID, &s.CollectorName, &day, &s.Status, &s.Amount, &s.Count, &s.FirstPaymentAt,
		)
		if err != nil {
			return nil, err
		}
		s.Date = day.Format("2006-01-02")
		settlements = append(settlements, &s)
	}
	return settlements, nil
}
func (r *PaymentRepository) Delete(ctx context.Context, id uuid.UUID, tenantID uuid.UUID) error {
	query := `DELETE FROM payments WHERE id = $1 AND tenant_id = $2`
	_, err := r.db.Exec(ctx, query, id, tenantID)
	return err
}
