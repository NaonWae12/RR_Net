package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/finance"
)

type ExpenseRepository struct {
	db *pgxpool.Pool
}

func NewExpenseRepository(db *pgxpool.Pool) *ExpenseRepository {
	return &ExpenseRepository{db: db}
}

func (r *ExpenseRepository) Create(ctx context.Context, e *finance.Expense) error {
	query := `
		INSERT INTO expenses (
			id, tenant_id, title, amount, currency, date, category, description, status,
			payment_method_id, payment_reference, paid_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		)
	`
	fmt.Printf("[ExpenseRepo] Inserting expense: %+v\n", e)
	_, err := r.db.Exec(ctx, query,
		e.ID, e.TenantID, e.Title, e.Amount, e.Currency, e.Date, e.Category, e.Description, e.Status,
		e.PaymentMethodID, e.PaymentReference, e.PaidAt, e.CreatedAt, e.UpdatedAt,
	)
	if err != nil {
		fmt.Printf("[ExpenseRepo] Create Error: %v\n", err)
	}
	return err
}

func (r *ExpenseRepository) GetByID(ctx context.Context, id uuid.UUID) (*finance.Expense, error) {
	query := `
		SELECT id, tenant_id, title, amount, currency, date, category, description, status,
			payment_method_id, payment_reference, paid_at, created_at, updated_at
		FROM expenses
		WHERE id = $1
	`
	var e finance.Expense
	err := r.db.QueryRow(ctx, query, id).Scan(
		&e.ID, &e.TenantID, &e.Title, &e.Amount, &e.Currency, &e.Date, &e.Category, &e.Description, &e.Status,
		&e.PaymentMethodID, &e.PaymentReference, &e.PaidAt, &e.CreatedAt, &e.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("expense not found")
	}
	return &e, err
}

func (r *ExpenseRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID, filter finance.ExpenseFilter) ([]*finance.Expense, error) {
	query := `
		SELECT id, tenant_id, title, amount, currency, date, category, description, status,
			payment_method_id, payment_reference, paid_at, created_at, updated_at
		FROM expenses
		WHERE tenant_id = $1
	`
	args := []interface{}{tenantID}
	placeholderIdx := 2

	if filter.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", placeholderIdx)
		args = append(args, filter.Status)
		placeholderIdx++
	}
	if filter.Category != "" {
		query += fmt.Sprintf(" AND category = $%d", placeholderIdx)
		args = append(args, filter.Category)
		placeholderIdx++
	}

	query += " ORDER BY date DESC, created_at DESC"

	if filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", placeholderIdx)
		args = append(args, filter.Limit)
		placeholderIdx++
	}
	if filter.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", placeholderIdx)
		args = append(args, filter.Offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		fmt.Printf("[ExpenseRepo] List Query Error: %v\n", err)
		return nil, err
	}
	defer rows.Close()

	var expenses []*finance.Expense
	for rows.Next() {
		var e finance.Expense
		err := rows.Scan(
			&e.ID, &e.TenantID, &e.Title, &e.Amount, &e.Currency, &e.Date, &e.Category, &e.Description, &e.Status,
			&e.PaymentMethodID, &e.PaymentReference, &e.PaidAt, &e.CreatedAt, &e.UpdatedAt,
		)
		if err != nil {
			fmt.Printf("[ExpenseRepo] Scan Error: %v\n", err)
			return nil, err
		}
		expenses = append(expenses, &e)
	}
	fmt.Printf("[ExpenseRepo] List found %d expenses for tenant %v\n", len(expenses), tenantID)
	return expenses, nil
}

func (r *ExpenseRepository) Update(ctx context.Context, e *finance.Expense) error {
	query := `
		UPDATE expenses
		SET title = $2, amount = $3, currency = $4, date = $5, category = $6, description = $7, status = $8,
			payment_method_id = $9, payment_reference = $10, paid_at = $11, updated_at = $12
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		e.ID, e.Title, e.Amount, e.Currency, e.Date, e.Category, e.Description, e.Status,
		e.PaymentMethodID, e.PaymentReference, e.PaidAt, e.UpdatedAt,
	)
	return err
}

func (r *ExpenseRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM expenses WHERE id = $1", id)
	return err
}
