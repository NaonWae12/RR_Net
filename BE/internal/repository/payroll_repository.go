package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/payroll"
)

type PayrollRepository struct {
	db *pgxpool.Pool
}

func NewPayrollRepository(db *pgxpool.Pool) *PayrollRepository {
	return &PayrollRepository{db: db}
}

func (r *PayrollRepository) CreateRun(ctx context.Context, pr *payroll.PayrollRun) error {
	query := `
		INSERT INTO payroll_runs (id, tenant_id, period, total_amount, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := r.db.Exec(ctx, query,
		pr.ID, pr.TenantID, pr.Period, pr.TotalAmount, pr.Status, pr.CreatedAt, pr.UpdatedAt,
	)
	return err
}

func (r *PayrollRepository) GetRunByID(ctx context.Context, id uuid.UUID) (*payroll.PayrollRun, error) {
	query := `
		SELECT pr.id, pr.tenant_id, pr.period, pr.total_amount, pr.status, pr.created_at, pr.updated_at, pr.processed_at, pr.paid_at, pr.payment_method_id, pm.name as payment_method, pr.payment_reference
		FROM payroll_runs pr
		LEFT JOIN payment_methods pm ON pr.payment_method_id = pm.id
		WHERE pr.id = $1
	`
	var pr payroll.PayrollRun
	err := r.db.QueryRow(ctx, query, id).Scan(
		&pr.ID, &pr.TenantID, &pr.Period, &pr.TotalAmount, &pr.Status, &pr.CreatedAt, &pr.UpdatedAt, &pr.ProcessedAt, &pr.PaidAt, &pr.PaymentMethodID, &pr.PaymentMethod, &pr.PaymentReference,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("payroll run not found")
	}
	return &pr, err
}

func (r *PayrollRepository) ListRunsByTenant(ctx context.Context, tenantID uuid.UUID) ([]*payroll.PayrollRun, error) {
	query := `
		SELECT pr.id, pr.tenant_id, pr.period, pr.total_amount, pr.status, pr.created_at, pr.updated_at, pr.processed_at, pr.paid_at, pr.payment_method_id, pm.name as payment_method, pr.payment_reference
		FROM payroll_runs pr
		LEFT JOIN payment_methods pm ON pr.payment_method_id = pm.id
		WHERE pr.tenant_id = $1
		ORDER BY pr.period DESC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var runs []*payroll.PayrollRun
	for rows.Next() {
		var pr payroll.PayrollRun
		err := rows.Scan(
			&pr.ID, &pr.TenantID, &pr.Period, &pr.TotalAmount, &pr.Status, &pr.CreatedAt, &pr.UpdatedAt, &pr.ProcessedAt, &pr.PaidAt, &pr.PaymentMethodID, &pr.PaymentMethod, &pr.PaymentReference,
		)
		if err != nil {
			return nil, err
		}
		runs = append(runs, &pr)
	}
	return runs, nil
}

func (r *PayrollRepository) CreatePayslip(ctx context.Context, ps *payroll.Payslip) error {
	query := `
		INSERT INTO payslips (
			id, payroll_run_id, user_id, base_salary, total_allowances, total_deductions, 
			total_reimbursements, net_salary, status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err := r.db.Exec(ctx, query,
		ps.ID, ps.PayrollRunID, ps.UserID, ps.BaseSalary, ps.TotalAllowances, ps.TotalDeductions,
		ps.TotalReimbursements, ps.NetSalary, ps.Status, ps.CreatedAt, ps.UpdatedAt,
	)
	return err
}

func (r *PayrollRepository) CreatePayslipItem(ctx context.Context, item *payroll.PayslipItem) error {
	query := `
		INSERT INTO payslip_items (id, payslip_id, description, type, amount, reference_id)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := r.db.Exec(ctx, query,
		item.ID, item.PayslipID, item.Description, item.Type, item.Amount, item.ReferenceID,
	)
	return err
}

func (r *PayrollRepository) ListPayslipsByRun(ctx context.Context, runID uuid.UUID) ([]*payroll.Payslip, error) {
	query := `
		SELECT p.id, p.payroll_run_id, p.user_id, p.base_salary, p.total_allowances, p.total_deductions, 
		       p.total_reimbursements, p.net_salary, p.status, p.created_at, p.updated_at, p.paid_at,
		       p.payment_method_id, pm.name as payment_method, p.payment_reference, u.name as user_name
		FROM payslips p
		JOIN users u ON p.user_id = u.id
		JOIN roles r ON u.role_id = r.id
		LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
		WHERE p.payroll_run_id = $1 AND r.code != 'client'
		ORDER BY u.name ASC
	`
	rows, err := r.db.Query(ctx, query, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payslips []*payroll.Payslip
	for rows.Next() {
		var ps payroll.Payslip
		err := rows.Scan(
			&ps.ID, &ps.PayrollRunID, &ps.UserID, &ps.BaseSalary, &ps.TotalAllowances, &ps.TotalDeductions,
			&ps.TotalReimbursements, &ps.NetSalary, &ps.Status, &ps.CreatedAt, &ps.UpdatedAt, &ps.PaidAt,
			&ps.PaymentMethodID, &ps.PaymentMethod, &ps.PaymentReference, &ps.UserName,
		)
		if err != nil {
			return nil, err
		}
		payslips = append(payslips, &ps)
	}

	// Load items for each payslip
	for _, ps := range payslips {
		items, err := r.ListPayslipItems(ctx, ps.ID)
		if err != nil {
			continue // Skip if error loading items
		}
		ps.Items = items
	}
	return payslips, nil
}

func (r *PayrollRepository) GetPayslipByID(ctx context.Context, id uuid.UUID) (*payroll.Payslip, error) {
	query := `
		SELECT p.id, p.payroll_run_id, p.user_id, p.base_salary, p.total_allowances, p.total_deductions, 
		       p.total_reimbursements, p.net_salary, p.status, p.created_at, p.updated_at, p.paid_at,
		       p.payment_method_id, pm.name as payment_method, p.payment_reference, pr.period
		FROM payslips p
		JOIN payroll_runs pr ON p.payroll_run_id = pr.id
		LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
		WHERE p.id = $1
	`
	var ps payroll.Payslip
	err := r.db.QueryRow(ctx, query, id).Scan(
		&ps.ID, &ps.PayrollRunID, &ps.UserID, &ps.BaseSalary, &ps.TotalAllowances, &ps.TotalDeductions,
		&ps.TotalReimbursements, &ps.NetSalary, &ps.Status, &ps.CreatedAt, &ps.UpdatedAt, &ps.PaidAt,
		&ps.PaymentMethodID, &ps.PaymentMethod, &ps.PaymentReference, &ps.Period,
	)
	if err != nil {
		return nil, err
	}
	return &ps, nil
}

func (r *PayrollRepository) ListPayslipItems(ctx context.Context, payslipID uuid.UUID) ([]*payroll.PayslipItem, error) {
	query := `
		SELECT id, payslip_id, description, type, amount, reference_id
		FROM payslip_items
		WHERE payslip_id = $1
	`
	rows, err := r.db.Query(ctx, query, payslipID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []*payroll.PayslipItem
	for rows.Next() {
		var item payroll.PayslipItem
		err := rows.Scan(&item.ID, &item.PayslipID, &item.Description, &item.Type, &item.Amount, &item.ReferenceID)
		if err != nil {
			return nil, err
		}
		items = append(items, &item)
	}
	return items, nil
}

func (r *PayrollRepository) UpdateRun(ctx context.Context, pr *payroll.PayrollRun) error {
	query := `
		UPDATE payroll_runs
		SET total_amount = $2, status = $3, updated_at = $4, processed_at = $5, paid_at = $6,
		    payment_method_id = $7, payment_reference = $8
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		pr.ID, pr.TotalAmount, pr.Status, pr.UpdatedAt, pr.ProcessedAt, pr.PaidAt,
		pr.PaymentMethodID, pr.PaymentReference,
	)
	return err
}

func (r *PayrollRepository) UpdateRunStatus(ctx context.Context, id uuid.UUID, status payroll.Status, paymentMethodID *uuid.UUID, paymentRef *string) error {
	query := `UPDATE payroll_runs SET status = $2, updated_at = NOW() `
	args := []interface{}{id, status}
	argCount := 3
	switch status {
	case payroll.StatusProcessed:
		query += `, processed_at = NOW()`
	case payroll.StatusPaid:
		query += `, paid_at = NOW()`
		if paymentMethodID != nil {
			query += fmt.Sprintf(", payment_method_id = $%d", argCount)
			args = append(args, *paymentMethodID)
			argCount++
		}
		if paymentRef != nil {
			query += fmt.Sprintf(", payment_reference = $%d", argCount)
			args = append(args, *paymentRef)
			argCount++
		}
	}
	query += " WHERE id = $1"
	tag, err := r.db.Exec(ctx, query, args...)
	if err == nil {
		fmt.Printf("[DEBUG] UpdateRunStatus - Run ID: %s, Status: %s, Rows Affected: %d\n", id, status, tag.RowsAffected())
	} else {
		fmt.Printf("[ERROR] UpdateRunStatus - Run ID: %s, Error: %v\n", id, err)
	}
	return err
}

func (r *PayrollRepository) UpdatePayslipStatus(ctx context.Context, id uuid.UUID, status payroll.PayslipStatus, paymentMethodID *uuid.UUID, paymentRef *string) error {
	query := `UPDATE payslips SET status = $2, updated_at = NOW() `
	args := []interface{}{id, status}
	argCount := 3
	if status == payroll.PayslipStatusPaid {
		query += `, paid_at = NOW()`
		if paymentMethodID != nil {
			query += fmt.Sprintf(", payment_method_id = $%d", argCount)
			args = append(args, *paymentMethodID)
			argCount++
		}
		if paymentRef != nil {
			query += fmt.Sprintf(", payment_reference = $%d", argCount)
			args = append(args, *paymentRef)
			argCount++
		}
	}
	query += " WHERE id = $1"
	tag, err := r.db.Exec(ctx, query, args...)
	if err == nil {
		fmt.Printf("[DEBUG] UpdatePayslipStatus - Payslip ID: %s, Status: %s, Rows Affected: %d\n", id, status, tag.RowsAffected())
	} else {
		fmt.Printf("[ERROR] UpdatePayslipStatus - Payslip ID: %s, Error: %v\n", id, err)
	}
	return err
}

func (r *PayrollRepository) GetRunByPeriod(ctx context.Context, tenantID uuid.UUID, period string) (*payroll.PayrollRun, error) {
	query := `
		SELECT pr.id, pr.tenant_id, pr.period, pr.total_amount, pr.status, pr.created_at, pr.updated_at, pr.processed_at, pr.paid_at, pr.payment_method_id, pm.name as payment_method, pr.payment_reference
		FROM payroll_runs pr
		LEFT JOIN payment_methods pm ON pr.payment_method_id = pm.id
		WHERE pr.tenant_id = $1 AND pr.period = $2
	`
	var pr payroll.PayrollRun
	err := r.db.QueryRow(ctx, query, tenantID, period).Scan(
		&pr.ID, &pr.TenantID, &pr.Period, &pr.TotalAmount, &pr.Status, &pr.CreatedAt, &pr.UpdatedAt, &pr.ProcessedAt, &pr.PaidAt, &pr.PaymentMethodID, &pr.PaymentMethod, &pr.PaymentReference,
	)
	if err == pgx.ErrNoRows {
		return nil, nil // Return nil, nil to indicate not found without error
	}
	return &pr, err
}

func (r *PayrollRepository) GetPayslipByUserAndRun(ctx context.Context, userID, runID uuid.UUID) (*payroll.Payslip, error) {
	query := `
		SELECT p.id, p.payroll_run_id, p.user_id, p.base_salary, p.total_allowances, p.total_deductions, 
		       p.total_reimbursements, p.net_salary, p.status, p.created_at, p.updated_at, p.paid_at,
		       p.payment_method_id, pm.name as payment_method, p.payment_reference
		FROM payslips p
		LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
		WHERE p.user_id = $1 AND p.payroll_run_id = $2
	`
	var ps payroll.Payslip
	err := r.db.QueryRow(ctx, query, userID, runID).Scan(
		&ps.ID, &ps.PayrollRunID, &ps.UserID, &ps.BaseSalary, &ps.TotalAllowances, &ps.TotalDeductions,
		&ps.TotalReimbursements, &ps.NetSalary, &ps.Status, &ps.CreatedAt, &ps.UpdatedAt, &ps.PaidAt,
		&ps.PaymentMethodID, &ps.PaymentMethod, &ps.PaymentReference,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &ps, err
}

func (r *PayrollRepository) UpdatePayslip(ctx context.Context, ps *payroll.Payslip) error {
	query := `
		UPDATE payslips
		SET base_salary = $2, total_allowances = $3, total_deductions = $4, 
		    total_reimbursements = $5, net_salary = $6, status = $7, updated_at = $8
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		ps.ID, ps.BaseSalary, ps.TotalAllowances, ps.TotalDeductions,
		ps.TotalReimbursements, ps.NetSalary, ps.Status, ps.UpdatedAt,
	)
	return err
}

func (r *PayrollRepository) ListPayslipsByUser(ctx context.Context, userID uuid.UUID) ([]*payroll.Payslip, error) {
	query := `
		SELECT p.id, p.payroll_run_id, p.user_id, p.base_salary, p.total_allowances, p.total_deductions, 
		       p.total_reimbursements, p.net_salary, p.status, p.created_at, p.updated_at, p.paid_at,
		       p.payment_method_id, pm.name as payment_method, p.payment_reference, pr.period
		FROM payslips p
		JOIN payroll_runs pr ON p.payroll_run_id = pr.id
		LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
		WHERE p.user_id = $1
		ORDER BY pr.period DESC
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payslips []*payroll.Payslip
	for rows.Next() {
		var ps payroll.Payslip
		err := rows.Scan(
			&ps.ID, &ps.PayrollRunID, &ps.UserID, &ps.BaseSalary, &ps.TotalAllowances, &ps.TotalDeductions,
			&ps.TotalReimbursements, &ps.NetSalary, &ps.Status, &ps.CreatedAt, &ps.UpdatedAt, &ps.PaidAt,
			&ps.PaymentMethodID, &ps.PaymentMethod, &ps.PaymentReference, &ps.Period,
		)
		if err != nil {
			return nil, err
		}
		payslips = append(payslips, &ps)
	}
	return payslips, nil
}

func (r *PayrollRepository) DeletePayslipItems(ctx context.Context, payslipID uuid.UUID) error {
	query := `DELETE FROM payslip_items WHERE payslip_id = $1`
	_, err := r.db.Exec(ctx, query, payslipID)
	return err
}
