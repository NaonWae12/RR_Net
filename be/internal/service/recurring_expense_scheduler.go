package service

import (
	"context"
	"fmt"
	"time"
)

// RecurringExpenseScheduler runs daily to auto-generate operational expense bills
// for all tenants whose recurring templates are due today.
type RecurringExpenseScheduler struct {
	expenseSvc *ExpenseService
}

func NewRecurringExpenseScheduler(expenseSvc *ExpenseService) *RecurringExpenseScheduler {
	return &RecurringExpenseScheduler{expenseSvc: expenseSvc}
}

// Start launches the daily scheduler in a background goroutine.
func (s *RecurringExpenseScheduler) Start(ctx context.Context) {
	go func() {
		// Run once immediately on startup (in case server was down yesterday)
		s.runOnce(ctx)

		for {
			next := nextDailyRun(10, 10) // 00:10 local time
			select {
			case <-ctx.Done():
				return
			case <-time.After(time.Until(next)):
				s.runOnce(ctx)
			}
		}
	}()
	fmt.Println("[RecurringExpenseScheduler] started — runs daily at 00:10 local time")
}

func (s *RecurringExpenseScheduler) runOnce(ctx context.Context) {
	count, err := s.expenseSvc.GenerateRecurringExpenses(ctx)
	if err != nil {
		fmt.Printf("[RecurringExpenseScheduler] error: %v\n", err)
		return
	}
	if count > 0 {
		fmt.Printf("[RecurringExpenseScheduler] generated %d recurring expense(s)\n", count)
	}
}

// nextDailyRun returns the next occurrence of the given hour:minute local time.
func nextDailyRun(hour, minute int) time.Time {
	now := time.Now()
	next := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, time.Local)
	if !next.After(now) {
		next = next.Add(24 * time.Hour)
	}
	return next
}
