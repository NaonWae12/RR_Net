package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/reimbursement"
)

type ReimbursementRepository struct {
	db *pgxpool.Pool
}

func NewReimbursementRepository(db *pgxpool.Pool) *ReimbursementRepository {
	return &ReimbursementRepository{db: db}
}

func (r *ReimbursementRepository) Create(ctx context.Context, rb *reimbursement.Reimbursement) error {
	query := `
		INSERT INTO reimbursements (
			id, tenant_id, user_id, amount, category, date, description, status,
			attachment_url, pay_with_payroll, paid_with_payroll_id, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
		)
	`
	_, err := r.db.Exec(ctx, query,
		rb.ID, rb.TenantID, rb.UserID, rb.Amount, rb.Category, rb.Date, rb.Description, rb.Status,
		rb.AttachmentURL, rb.PayWithPayroll, rb.PaidWithPayrollID, rb.CreatedAt, rb.UpdatedAt,
	)
	return err
}

func (r *ReimbursementRepository) GetByID(ctx context.Context, id uuid.UUID) (*reimbursement.Reimbursement, error) {
	query := `
		SELECT r.id, r.tenant_id, r.user_id, r.amount, r.category, r.date, r.description, r.status,
			r.attachment_url, r.approved_by, r.approved_at, r.rejection_reason, r.paid_at, 
			r.pay_with_payroll, r.paid_with_payroll_id, r.payment_method_id, pm.name as payment_method, 
			r.payment_reference, r.created_at, r.updated_at,
			u.name as user_name
		FROM reimbursements r
		JOIN users u ON r.user_id = u.id
		LEFT JOIN payment_methods pm ON r.payment_method_id = pm.id
		WHERE r.id = $1
	`
	var rb reimbursement.Reimbursement
	err := r.db.QueryRow(ctx, query, id).Scan(
		&rb.ID, &rb.TenantID, &rb.UserID, &rb.Amount, &rb.Category, &rb.Date, &rb.Description, &rb.Status,
		&rb.AttachmentURL, &rb.ApprovedBy, &rb.ApprovedAt, &rb.RejectionReason, &rb.PaidAt,
		&rb.PayWithPayroll, &rb.PaidWithPayrollID, &rb.PaymentMethodID, &rb.PaymentMethod, &rb.PaymentReference, &rb.CreatedAt, &rb.UpdatedAt,
		&rb.UserName,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("reimbursement not found")
	}
	return &rb, err
}

func (r *ReimbursementRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID, status *string) ([]*reimbursement.Reimbursement, error) {
	query := `
		SELECT r.id, r.tenant_id, r.user_id, r.amount, r.category, r.date, r.description, r.status,
			r.attachment_url, r.approved_by, r.approved_at, r.rejection_reason, r.paid_at, 
			r.pay_with_payroll, r.paid_with_payroll_id, r.payment_method_id, pm.name as payment_method, 
			r.payment_reference, r.created_at, r.updated_at,
			u.name as user_name
		FROM reimbursements r
		JOIN users u ON r.user_id = u.id
		LEFT JOIN payment_methods pm ON r.payment_method_id = pm.id
		WHERE r.tenant_id = $1
	`
	args := []interface{}{tenantID}
	if status != nil && *status != "" {
		query += " AND r.status = $2"
		args = append(args, *status)
	}
	query += " ORDER BY r.created_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rbs []*reimbursement.Reimbursement
	for rows.Next() {
		var rb reimbursement.Reimbursement
		err := rows.Scan(
			&rb.ID, &rb.TenantID, &rb.UserID, &rb.Amount, &rb.Category, &rb.Date, &rb.Description, &rb.Status,
			&rb.AttachmentURL, &rb.ApprovedBy, &rb.ApprovedAt, &rb.RejectionReason, &rb.PaidAt,
			&rb.PayWithPayroll, &rb.PaidWithPayrollID, &rb.PaymentMethodID, &rb.PaymentMethod, &rb.PaymentReference, &rb.CreatedAt, &rb.UpdatedAt,
			&rb.UserName,
		)
		if err != nil {
			return nil, err
		}
		rbs = append(rbs, &rb)
	}
	return rbs, nil
}

func (r *ReimbursementRepository) ListByUser(ctx context.Context, userID uuid.UUID, status *string) ([]*reimbursement.Reimbursement, error) {
	query := `
		SELECT r.id, r.tenant_id, r.user_id, r.amount, r.category, r.date, r.description, r.status,
			r.attachment_url, r.approved_by, r.approved_at, r.rejection_reason, r.paid_at, 
			r.pay_with_payroll, r.paid_with_payroll_id, r.payment_method_id, pm.name as payment_method, 
			r.payment_reference, r.created_at, r.updated_at,
			u.name as user_name
		FROM reimbursements r
		JOIN users u ON r.user_id = u.id
		LEFT JOIN payment_methods pm ON r.payment_method_id = pm.id
		WHERE r.user_id = $1
	`
	args := []interface{}{userID}
	if status != nil && *status != "" {
		query += " AND r.status = $2"
		args = append(args, *status)
	}
	query += " ORDER BY r.created_at DESC"

	fmt.Printf("[DEBUG] ListByUser - User: %s, Status: %v\n", userID, status)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		fmt.Printf("[ERROR] ListByUser query error: %v\n", err)
		return nil, err
	}
	defer rows.Close()

	var rbs []*reimbursement.Reimbursement
	for rows.Next() {
		var rb reimbursement.Reimbursement
		err := rows.Scan(
			&rb.ID, &rb.TenantID, &rb.UserID, &rb.Amount, &rb.Category, &rb.Date, &rb.Description, &rb.Status,
			&rb.AttachmentURL, &rb.ApprovedBy, &rb.ApprovedAt, &rb.RejectionReason, &rb.PaidAt,
			&rb.PayWithPayroll, &rb.PaidWithPayrollID, &rb.PaymentMethodID, &rb.PaymentMethod, &rb.PaymentReference, &rb.CreatedAt, &rb.UpdatedAt,
			&rb.UserName,
		)
		if err != nil {
			fmt.Printf("[ERROR] ListByUser scan error: %v\n", err)
			return nil, err
		}
		rbs = append(rbs, &rb)
	}

	fmt.Printf("[DEBUG] ListByUser found %d records\n", len(rbs))
	return rbs, nil
}

func (r *ReimbursementRepository) Update(ctx context.Context, rb *reimbursement.Reimbursement) error {
	query := `
		UPDATE reimbursements
		SET amount = $2, category = $3, date = $4, description = $5, status = $6,
			attachment_url = $7, approved_by = $8, approved_at = $9, rejection_reason = $10,
			paid_at = $11, pay_with_payroll = $12, paid_with_payroll_id = $13, 
			payment_method_id = $14, payment_reference = $15, updated_at = $16
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		rb.ID, rb.Amount, rb.Category, rb.Date, rb.Description, rb.Status,
		rb.AttachmentURL, rb.ApprovedBy, rb.ApprovedAt, rb.RejectionReason,
		rb.PaidAt, rb.PayWithPayroll, rb.PaidWithPayrollID,
		rb.PaymentMethodID, rb.PaymentReference, rb.UpdatedAt,
	)
	return err
}

func (r *ReimbursementRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status reimbursement.Status, approvedBy *uuid.UUID, reason *string) error {
	query := `
		UPDATE reimbursements
		SET status = $2, approved_by = $3, approved_at = $4, rejection_reason = $5, updated_at = NOW()
	`
	args := []interface{}{id, status, approvedBy}
	switch status {
	case reimbursement.StatusApproved:
		now := time.Now()
		query += ", approved_at = $4"
		args = append(args, &now, nil)
	case reimbursement.StatusRejected:
		query += ", rejection_reason = $5"
		args = append(args, nil, reason)
	case reimbursement.StatusPaid:
		now := time.Now()
		query += ", paid_at = $4"
		args = append(args, &now, nil)
	}

	query += " WHERE id = $1"
	_, err := r.db.Exec(ctx, query, args...)
	return err
}

func (r *ReimbursementRepository) ClearPaidWithPayroll(ctx context.Context, payslipID uuid.UUID) error {
	query := `UPDATE reimbursements SET paid_with_payroll_id = NULL WHERE paid_with_payroll_id = $1`
	_, err := r.db.Exec(ctx, query, payslipID)
	return err
}

func (r *ReimbursementRepository) SetPaidWithPayroll(ctx context.Context, rbID uuid.UUID, payslipID uuid.UUID) error {
	query := `UPDATE reimbursements SET paid_with_payroll_id = $2 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, rbID, payslipID)
	return err
}
