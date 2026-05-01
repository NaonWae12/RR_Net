package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/billing"
)

type PlatformBillingRepository struct {
	db *pgxpool.Pool
}

func NewPlatformBillingRepository(db *pgxpool.Pool) *PlatformBillingRepository {
	return &PlatformBillingRepository{db: db}
}

func (r *PlatformBillingRepository) GetDB() *pgxpool.Pool {
	return r.db
}

func (r *PlatformBillingRepository) CreateInvoice(ctx context.Context, inv *billing.PlatformInvoice) error {
	query := `
		INSERT INTO platform_invoices (
			id, tenant_id, plan_id, invoice_number, period_start, period_end, due_date,
			subtotal, discount_amount, discount_id, addon_id, addon_quantity, amount, currency, status, paid_amount, notes, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
	`
	_, err := r.db.Exec(ctx, query,
		inv.ID, inv.TenantID, inv.PlanID, inv.InvoiceNumber, inv.PeriodStart, inv.PeriodEnd, inv.DueDate,
		inv.Subtotal, inv.DiscountAmount, inv.DiscountID, inv.AddonID, inv.AddonQuantity, inv.Amount, inv.Currency, inv.Status, inv.PaidAmount, inv.Notes, inv.CreatedAt, inv.UpdatedAt,
	)
	return err
}

func (r *PlatformBillingRepository) GetInvoiceByID(ctx context.Context, id uuid.UUID) (*billing.PlatformInvoice, error) {
	query := `
		SELECT 
			i.id, i.tenant_id, t.name as tenant_name, i.plan_id, p.name as plan_name, p.price_monthly as plan_price, i.invoice_number, 
			i.period_start, i.period_end, i.due_date, i.subtotal, i.discount_amount, i.discount_id, i.addon_id, i.addon_quantity, a.name as addon_name, i.amount, i.currency, i.status, 
			i.paid_amount, i.paid_at, i.notes, i.created_at, i.updated_at
		FROM platform_invoices i
		JOIN tenants t ON i.tenant_id = t.id
		JOIN plans p ON i.plan_id = p.id
		LEFT JOIN addons a ON i.addon_id = a.id
		WHERE i.id = $1
	`
	var inv billing.PlatformInvoice
	var planPrice float64
	err := r.db.QueryRow(ctx, query, id).Scan(
		&inv.ID, &inv.TenantID, &inv.TenantName, &inv.PlanID, &inv.PlanName, &planPrice, &inv.InvoiceNumber,
		&inv.PeriodStart, &inv.PeriodEnd, &inv.DueDate, &inv.Subtotal, &inv.DiscountAmount, &inv.DiscountID, &inv.AddonID, &inv.AddonQuantity, &inv.AddonName, &inv.Amount, &inv.Currency, &inv.Status,
		&inv.PaidAmount, &inv.PaidAt, &inv.Notes, &inv.CreatedAt, &inv.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("platform invoice not found")
		}
		return nil, err
	}

	// Self-healing: Update subtotal if it's zero but plan has a price
	if inv.Subtotal == 0 && planPrice > 0 && inv.AddonID == nil {
		inv.Subtotal = int64(planPrice)
		// If amount is also 0, update it too
		if inv.Amount == 0 {
			inv.Amount = inv.Subtotal
		}
	}

	return &inv, nil
}

func (r *PlatformBillingRepository) ListInvoices(ctx context.Context, tenantID *uuid.UUID) ([]*billing.PlatformInvoice, error) {
	query := `
		SELECT 
			i.id, i.tenant_id, t.name as tenant_name, i.plan_id, p.name as plan_name, i.invoice_number, 
			i.period_start, i.period_end, i.due_date, i.subtotal, i.discount_amount, i.discount_id, i.addon_id, i.addon_quantity, a.name as addon_name, i.amount, i.currency, i.status, 
			i.paid_amount, i.paid_at, i.notes, i.created_at, i.updated_at
		FROM platform_invoices i
		JOIN tenants t ON i.tenant_id = t.id
		JOIN plans p ON i.plan_id = p.id
		LEFT JOIN addons a ON i.addon_id = a.id
	`
	args := []interface{}{}
	if tenantID != nil {
		query += " WHERE i.tenant_id = $1"
		args = append(args, *tenantID)
	}
	query += " ORDER BY i.created_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	invoices := []*billing.PlatformInvoice{}
	for rows.Next() {
		var inv billing.PlatformInvoice
		err := rows.Scan(
			&inv.ID, &inv.TenantID, &inv.TenantName, &inv.PlanID, &inv.PlanName, &inv.InvoiceNumber,
			&inv.PeriodStart, &inv.PeriodEnd, &inv.DueDate, &inv.Subtotal, &inv.DiscountAmount, &inv.DiscountID, &inv.AddonID, &inv.AddonQuantity, &inv.AddonName, &inv.Amount, &inv.Currency, &inv.Status,
			&inv.PaidAmount, &inv.PaidAt, &inv.Notes, &inv.CreatedAt, &inv.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		invoices = append(invoices, &inv)
	}
	return invoices, nil
}

func (r *PlatformBillingRepository) UpdateInvoiceStatus(ctx context.Context, id uuid.UUID, status billing.PlatformInvoiceStatus, paidAmount int64, paidAt *time.Time) error {
	query := `
		UPDATE platform_invoices 
		SET status = $2, paid_amount = $3, paid_at = $4, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, status, paidAmount, paidAt)
	return err
}

func (r *PlatformBillingRepository) ApplyDiscount(ctx context.Context, id uuid.UUID, discountID uuid.UUID, discountAmount int64, finalAmount int64, subtotal int64) error {
	query := `
		UPDATE platform_invoices 
		SET discount_id = $2, discount_amount = $3, amount = $4, subtotal = $5, updated_at = NOW()
		WHERE id = $1 AND status = 'pending'
	`
	_, err := r.db.Exec(ctx, query, id, discountID, discountAmount, finalAmount, subtotal)
	return err
}

func (r *PlatformBillingRepository) RemoveDiscount(ctx context.Context, id uuid.UUID, originalAmount int64) error {
	query := `
		UPDATE platform_invoices 
		SET discount_id = NULL, discount_amount = 0, amount = $2, updated_at = NOW()
		WHERE id = $1 AND status = 'pending'
	`
	_, err := r.db.Exec(ctx, query, id, originalAmount)
	return err
}

func (r *PlatformBillingRepository) UpdateInvoicePlan(ctx context.Context, id uuid.UUID, planID uuid.UUID, subtotal int64, amount int64, periodEnd time.Time) error {
	query := `
		UPDATE platform_invoices 
		SET plan_id = $2, subtotal = $3, amount = $4, period_end = $5, updated_at = NOW()
		WHERE id = $1 AND status = 'pending'
	`
	_, err := r.db.Exec(ctx, query, id, planID, subtotal, amount, periodEnd)
	return err
}

func (r *PlatformBillingRepository) CreatePayment(ctx context.Context, p *billing.PlatformPayment) error {
	query := `
		INSERT INTO platform_payments (
			id, platform_invoice_id, tenant_id, amount, currency, method, reference, 
			proof_image_url, status, notes, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	_, err := r.db.Exec(ctx, query,
		p.ID, p.PlatformInvoiceID, p.TenantID, p.Amount, p.Currency, p.Method, p.Reference,
		p.ProofImageURL, p.Status, p.Notes, p.CreatedAt, p.UpdatedAt,
	)
	return err
}

func (r *PlatformBillingRepository) GetPaymentByID(ctx context.Context, id uuid.UUID) (*billing.PlatformPayment, error) {
	query := `
		SELECT 
			id, platform_invoice_id, tenant_id, amount, currency, method, reference, 
			proof_image_url, status, notes, verified_at, verified_by, created_at, updated_at
		FROM platform_payments
		WHERE id = $1
	`
	var p billing.PlatformPayment
	err := r.db.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.PlatformInvoiceID, &p.TenantID, &p.Amount, &p.Currency, &p.Method, &p.Reference,
		&p.ProofImageURL, &p.Status, &p.Notes, &p.VerifiedAt, &p.VerifiedBy, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *PlatformBillingRepository) UpdatePaymentStatus(ctx context.Context, id uuid.UUID, status billing.PlatformPaymentStatus, verifiedBy uuid.UUID) error {
	query := `
		UPDATE platform_payments 
		SET status = $2, verified_at = NOW(), verified_by = $3, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, status, verifiedBy)
	return err
}

func (r *PlatformBillingRepository) ListPayments(ctx context.Context, invoiceID *uuid.UUID) ([]*billing.PlatformPayment, error) {
	query := `
		SELECT 
			id, platform_invoice_id, tenant_id, amount, currency, method, reference, 
			proof_image_url, status, notes, verified_at, verified_by, created_at, updated_at
		FROM platform_payments
	`
	args := []interface{}{}
	if invoiceID != nil {
		query += " WHERE platform_invoice_id = $1"
		args = append(args, *invoiceID)
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	payments := []*billing.PlatformPayment{}
	for rows.Next() {
		var p billing.PlatformPayment
		err := rows.Scan(
			&p.ID, &p.PlatformInvoiceID, &p.TenantID, &p.Amount, &p.Currency, &p.Method, &p.Reference,
			&p.ProofImageURL, &p.Status, &p.Notes, &p.VerifiedAt, &p.VerifiedBy, &p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		payments = append(payments, &p)
	}
	return payments, nil
}

func (r *PlatformBillingRepository) ExistsForTenantPeriod(ctx context.Context, tenantID uuid.UUID, start, end time.Time) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM platform_invoices WHERE tenant_id = $1 AND period_start = $2 AND period_end = $3)`
	var exists bool
	err := r.db.QueryRow(ctx, query, tenantID, start, end).Scan(&exists)
	return exists, err
}

func (r *PlatformBillingRepository) GenerateInvoiceNumber(ctx context.Context) (string, error) {
	var count int
	err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM platform_invoices").Scan(&count)
	if err != nil {
		return "", err
	}
	now := time.Now()
	return fmt.Sprintf("INV-PLT-%d%02d-%04d", now.Year(), int(now.Month()), count+1), nil
}

func (r *PlatformBillingRepository) DeleteInvoice(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM platform_invoices WHERE id = $1 AND status = 'pending'", id)
	return err
}
