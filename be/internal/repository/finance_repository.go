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

type FinanceRepository struct {
	db *pgxpool.Pool
}

func NewFinanceRepository(db *pgxpool.Pool) *FinanceRepository {
	return &FinanceRepository{db: db}
}

func (r *FinanceRepository) RecordTransaction(ctx context.Context, tx *finance.Transaction) error {
	// Start a DB transaction to ensure both transaction record and balance update succeed
	dbTx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer dbTx.Rollback(ctx)

	// 1. Insert transaction
	query := `
		INSERT INTO finance_transactions (
			id, tenant_id, type, source, source_id, amount, currency, description, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err = dbTx.Exec(ctx, query,
		tx.ID, tx.TenantID, tx.Type, tx.Source, tx.SourceID, tx.Amount, tx.Currency, tx.Description, tx.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert transaction: %w", err)
	}

	// 2. Update balance
	// Use UPSERT logic for balance
	balanceChange := tx.Amount
	if tx.Type == finance.TransactionTypeExpense {
		balanceChange = -tx.Amount
	}

	balanceQuery := `
		INSERT INTO tenant_balances (tenant_id, balance, updated_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (tenant_id) DO UPDATE SET
			balance = tenant_balances.balance + $2,
			updated_at = $3
	`
	_, err = dbTx.Exec(ctx, balanceQuery, tx.TenantID, balanceChange, time.Now())
	if err != nil {
		return fmt.Errorf("failed to update balance: %w", err)
	}

	return dbTx.Commit(ctx)
}

func (r *FinanceRepository) GetBalance(ctx context.Context, tenantID uuid.UUID) (float64, error) {
	query := `SELECT balance FROM tenant_balances WHERE tenant_id = $1`
	var balance float64
	err := r.db.QueryRow(ctx, query, tenantID).Scan(&balance)
	if err == pgx.ErrNoRows {
		return 0, nil
	}
	return balance, err
}

func (r *FinanceRepository) GetRevenueSummary(ctx context.Context, tenantID uuid.UUID) (*finance.RevenueSummary, error) {
	summary := &finance.RevenueSummary{}

	// 1. Total Balance
	balance, err := r.GetBalance(ctx, tenantID)
	if err == nil {
		summary.TotalBalance = balance
	}

	// 2. Today's Revenue
	todayQuery := `
		SELECT COALESCE(SUM(amount), 0) 
		FROM finance_transactions 
		WHERE tenant_id = $1 AND type = 'income' AND created_at >= CURRENT_DATE
	`
	_ = r.db.QueryRow(ctx, todayQuery, tenantID).Scan(&summary.TodayRevenue)

	// 3. Breakdown by source
	breakdownQuery := `
		SELECT source, COALESCE(SUM(amount), 0) 
		FROM finance_transactions 
		WHERE tenant_id = $1 AND type = 'income'
		GROUP BY source
	`
	rows, err := r.db.Query(ctx, breakdownQuery, tenantID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var source string
			var amount float64
			if err := rows.Scan(&source, &amount); err == nil {
				switch source {
				case string(finance.TransactionSourceVoucherUsage):
					summary.VoucherRevenue = amount
				case string(finance.TransactionSourceResellerPurchase):
					summary.ResellerRevenue = amount
				case string(finance.TransactionSourceBillingPayment):
					summary.BillingRevenue = amount
				}
			}
		}
	}

	return summary, nil
}
func (r *FinanceRepository) GetFilteredSummary(ctx context.Context, tenantID uuid.UUID, year, month int) (*finance.RevenueSummary, error) {
	summary := &finance.RevenueSummary{}

	// 1. Total Balance (Always global)
	balance, err := r.GetBalance(ctx, tenantID)
	if err == nil {
		summary.TotalBalance = balance
	}

	// 2. Today's Revenue
	todayQuery := `
		SELECT COALESCE(SUM(amount), 0) 
		FROM finance_transactions 
		WHERE tenant_id = $1 AND type = 'income' AND created_at >= CURRENT_DATE
	`
	_ = r.db.QueryRow(ctx, todayQuery, tenantID).Scan(&summary.TodayRevenue)

	// 3. Filtered Breakdown by source
	// Using PostgreSQL date_part to filter by year and month
	breakdownQuery := `
		SELECT source, COALESCE(SUM(amount), 0) 
		FROM finance_transactions 
		WHERE tenant_id = $1 AND type = 'income'
		AND date_part('year', created_at) = $2
		AND date_part('month', created_at) = $3
		GROUP BY source
	`
	rows, err := r.db.Query(ctx, breakdownQuery, tenantID, year, month)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var source string
			var amount float64
			if err := rows.Scan(&source, &amount); err == nil {
				switch source {
				case string(finance.TransactionSourceVoucherUsage):
					summary.VoucherRevenue = amount
				case string(finance.TransactionSourceResellerPurchase):
					summary.ResellerRevenue = amount
				case string(finance.TransactionSourceBillingPayment):
					summary.BillingRevenue = amount
				}
			}
		}
	}

	return summary, nil
}

func (r *FinanceRepository) GetTrendData(ctx context.Context, tenantID uuid.UUID, year, month int, source string) (*finance.TrendResponse, error) {
	resp := &finance.TrendResponse{
		Source: source,
		Points: []finance.TrendPoint{},
	}

	query := `
		SELECT 
			TO_CHAR(created_at, 'YYYY-MM-DD') as date_str,
			SUM(amount) as daily_total
		FROM finance_transactions
		WHERE tenant_id = $1 
		AND type = 'income'
		AND ($2 = '' OR source = $2)
		AND date_part('year', created_at) = $3
		AND date_part('month', created_at) = $4
		GROUP BY date_str
		ORDER BY date_str ASC
	`
	rows, err := r.db.Query(ctx, query, tenantID, source, year, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var total float64
	for rows.Next() {
		var p finance.TrendPoint
		if err := rows.Scan(&p.Date, &p.Amount); err == nil {
			resp.Points = append(resp.Points, p)
			total += p.Amount
		}
	}
	resp.TotalAmount = total

	return resp, nil
}

// DeleteTransactionBySource removes a single transaction matching source and sourceID, and adjusts tenant balance
func (r *FinanceRepository) DeleteTransactionBySource(ctx context.Context, tenantID uuid.UUID, source string, sourceID uuid.UUID) error {
	return r.DeleteTransactionsBySourceIDs(ctx, tenantID, source, []uuid.UUID{sourceID})
}

// DeleteTransactionsBySourceIDs removes transactions matching source and sourceIDs, and adjusts tenant balance accordingly
func (r *FinanceRepository) DeleteTransactionsBySourceIDs(ctx context.Context, tenantID uuid.UUID, source string, sourceIDs []uuid.UUID) error {
	if len(sourceIDs) == 0 {
		return nil
	}

	dbTx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer dbTx.Rollback(ctx)

	// 1. Fetch matching transactions to know their amounts and types before deleting
	queryFetch := `
		SELECT type, amount 
		FROM finance_transactions 
		WHERE tenant_id = $1 AND source = $2 AND source_id = ANY($3)
	`
	rows, err := dbTx.Query(ctx, queryFetch, tenantID, source, sourceIDs)
	if err != nil {
		return fmt.Errorf("failed to fetch transactions for deletion: %w", err)
	}

	var netBalanceChange float64
	for rows.Next() {
		var txType string
		var amount float64
		if err := rows.Scan(&txType, &amount); err == nil {
			if txType == string(finance.TransactionTypeIncome) {
				netBalanceChange -= amount // Revert income
			} else if txType == string(finance.TransactionTypeExpense) {
				netBalanceChange += amount // Revert expense
			}
		}
	}
	rows.Close()

	// 2. Adjust balance if there's balance change
	if netBalanceChange != 0 {
		balanceQuery := `
			UPDATE tenant_balances 
			SET balance = balance + $2, updated_at = $3 
			WHERE tenant_id = $1
		`
		_, err = dbTx.Exec(ctx, balanceQuery, tenantID, netBalanceChange, time.Now())
		if err != nil {
			return fmt.Errorf("failed to adjust balance on transaction deletion: %w", err)
		}
	}

	// 3. Delete transactions
	deleteQuery := `
		DELETE FROM finance_transactions 
		WHERE tenant_id = $1 AND source = $2 AND source_id = ANY($3)
	`
	_, err = dbTx.Exec(ctx, deleteQuery, tenantID, source, sourceIDs)
	if err != nil {
		return fmt.Errorf("failed to delete finance_transactions: %w", err)
	}

	return dbTx.Commit(ctx)
}
