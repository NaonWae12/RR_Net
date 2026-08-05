package repository

import (
	"context"
	"fmt"
	"time"

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

const expenseCols = `
	id, tenant_id, title, amount, currency, date, category, description, status,
	payment_method_id, payment_reference, paid_at,
	is_recurring, recurring_day, recurring_end_at, parent_expense_id,
	created_at, updated_at
`

func scanExpense(row interface {
	Scan(...any) error
}) (*finance.Expense, error) {
	var e finance.Expense
	err := row.Scan(
		&e.ID, &e.TenantID, &e.Title, &e.Amount, &e.Currency, &e.Date, &e.Category, &e.Description, &e.Status,
		&e.PaymentMethodID, &e.PaymentReference, &e.PaidAt,
		&e.IsRecurring, &e.RecurringDay, &e.RecurringEndAt, &e.ParentExpenseID,
		&e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *ExpenseRepository) Create(ctx context.Context, e *finance.Expense) error {
	query := `
		INSERT INTO expenses (
			id, tenant_id, title, amount, currency, date, category, description, status,
			payment_method_id, payment_reference, paid_at,
			is_recurring, recurring_day, recurring_end_at, parent_expense_id,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
			$13, $14, $15, $16,
			$17, $18
		)
	`
	_, err := r.db.Exec(ctx, query,
		e.ID, e.TenantID, e.Title, e.Amount, e.Currency, e.Date, e.Category, e.Description, e.Status,
		e.PaymentMethodID, e.PaymentReference, e.PaidAt,
		e.IsRecurring, e.RecurringDay, e.RecurringEndAt, e.ParentExpenseID,
		e.CreatedAt, e.UpdatedAt,
	)
	if err != nil {
		fmt.Printf("[ExpenseRepo] Create Error: %v\n", err)
	}
	return err
}

func (r *ExpenseRepository) GetByID(ctx context.Context, id uuid.UUID) (*finance.Expense, error) {
	query := `SELECT ` + expenseCols + ` FROM expenses WHERE id = $1`
	row := r.db.QueryRow(ctx, query, id)
	e, err := scanExpense(row)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("expense not found")
	}
	return e, err
}

func (r *ExpenseRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID, filter finance.ExpenseFilter) ([]*finance.Expense, error) {
	query := `SELECT ` + expenseCols + ` FROM expenses WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	ph := 2

	if filter.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", ph)
		args = append(args, filter.Status)
		ph++
	}
	if filter.Category != "" {
		query += fmt.Sprintf(" AND category = $%d", ph)
		args = append(args, filter.Category)
		ph++
	}
	if filter.IsRecurring != nil {
		query += fmt.Sprintf(" AND is_recurring = $%d", ph)
		args = append(args, *filter.IsRecurring)
		ph++
	}

	query += " ORDER BY date DESC, created_at DESC"

	if filter.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", ph)
		args = append(args, filter.Limit)
		ph++
	}
	if filter.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", ph)
		args = append(args, filter.Offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var expenses []*finance.Expense
	for rows.Next() {
		e, err := scanExpense(rows)
		if err != nil {
			return nil, err
		}
		expenses = append(expenses, e)
	}
	return expenses, nil
}

// ListRecurringDue returns all recurring template expenses whose recurring_day == today's day
// and have not yet generated a child expense this month.
func (r *ExpenseRepository) ListRecurringDue(ctx context.Context, today time.Time) ([]*finance.Expense, error) {
	query := `
		SELECT ` + expenseCols + `
		FROM expenses e
		WHERE e.is_recurring = TRUE
		  AND e.recurring_day = $1
		  AND (e.recurring_end_at IS NULL OR e.recurring_end_at >= $2)
		  AND NOT EXISTS (
		      SELECT 1 FROM expenses child
		      WHERE child.parent_expense_id = e.id
		        AND DATE_TRUNC('month', child.date) = DATE_TRUNC('month', $2::date)
		  )
	`
	day := today.Day()
	rows, err := r.db.Query(ctx, query, day, today)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*finance.Expense
	for rows.Next() {
		e, err := scanExpense(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, e)
	}
	return result, nil
}

func (r *ExpenseRepository) Update(ctx context.Context, e *finance.Expense) error {
	query := `
		UPDATE expenses
		SET title = $2, amount = $3, currency = $4, date = $5, category = $6, description = $7, status = $8,
			payment_method_id = $9, payment_reference = $10, paid_at = $11,
			is_recurring = $12, recurring_day = $13, recurring_end_at = $14,
			updated_at = $15
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		e.ID, e.Title, e.Amount, e.Currency, e.Date, e.Category, e.Description, e.Status,
		e.PaymentMethodID, e.PaymentReference, e.PaidAt,
		e.IsRecurring, e.RecurringDay, e.RecurringEndAt,
		e.UpdatedAt,
	)
	return err
}

func (r *ExpenseRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, "DELETE FROM expenses WHERE id = $1", id)
	return err
}
