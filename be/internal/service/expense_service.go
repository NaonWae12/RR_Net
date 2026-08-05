package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/finance"
	"rrnet/internal/repository"
)

type ExpenseService struct {
	repo *repository.ExpenseRepository
}

func NewExpenseService(repo *repository.ExpenseRepository) *ExpenseService {
	return &ExpenseService{repo: repo}
}

func (s *ExpenseService) CreateExpense(ctx context.Context, tenantID uuid.UUID, e *finance.Expense) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	e.TenantID = tenantID
	e.CreatedAt = time.Now()
	e.UpdatedAt = time.Now()

	if e.Status == "" {
		e.Status = "approved"
	}

	if e.Currency == "" {
		e.Currency = "IDR"
	}

	// If paying immediately, mark as paid
	if e.PaidAt != nil || e.PaymentMethodID != nil {
		e.Status = "paid"
		if e.PaidAt == nil {
			now := time.Now()
			e.PaidAt = &now
		}
	}

	// Recurring templates are never directly "paid" — they just schedule child expenses
	if e.IsRecurring {
		e.Status = "approved"
		e.PaidAt = nil
		e.PaymentMethodID = nil
		e.PaymentReference = ""
	}

	return s.repo.Create(ctx, e)
}

func (s *ExpenseService) ListExpenses(ctx context.Context, tenantID uuid.UUID, filter finance.ExpenseFilter) ([]*finance.Expense, error) {
	return s.repo.ListByTenant(ctx, tenantID, filter)
}

func (s *ExpenseService) GetExpense(ctx context.Context, id uuid.UUID) (*finance.Expense, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *ExpenseService) MarkAsPaid(ctx context.Context, id uuid.UUID, paymentMethodID uuid.UUID, reference string) error {
	e, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	// Cannot mark a recurring template as paid directly — only its children
	if e.IsRecurring && e.ParentExpenseID == nil {
		return fmt.Errorf("cannot mark a recurring template as paid; mark the generated monthly expense instead")
	}

	now := time.Now()
	e.Status = "paid"
	e.PaymentMethodID = &paymentMethodID
	e.PaymentReference = reference
	e.PaidAt = &now
	e.UpdatedAt = now

	return s.repo.Update(ctx, e)
}

func (s *ExpenseService) UpdateExpense(ctx context.Context, e *finance.Expense) error {
	e.UpdatedAt = time.Now()
	return s.repo.Update(ctx, e)
}

func (s *ExpenseService) DeleteExpense(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

// GenerateRecurringExpenses creates a new child expense for each recurring template
// whose recurring_day matches today, if one hasn't been created yet this month.
// Called by the daily scheduler.
func (s *ExpenseService) GenerateRecurringExpenses(ctx context.Context) (int, error) {
	today := time.Now()
	templates, err := s.repo.ListRecurringDue(ctx, today)
	if err != nil {
		return 0, fmt.Errorf("list recurring due: %w", err)
	}

	count := 0
	for _, tmpl := range templates {
		child := &finance.Expense{
			ID:              uuid.New(),
			TenantID:        tmpl.TenantID,
			Title:           tmpl.Title,
			Amount:          tmpl.Amount,
			Currency:        tmpl.Currency,
			Date:            today,
			Category:        tmpl.Category,
			Description:     tmpl.Description,
			Status:          "approved",
			IsRecurring:     false, // child is not a template
			ParentExpenseID: &tmpl.ID,
			CreatedAt:       today,
			UpdatedAt:       today,
		}
		if err := s.repo.Create(ctx, child); err != nil {
			fmt.Printf("[ExpenseService] failed to generate recurring expense for template %s: %v\n", tmpl.ID, err)
			continue
		}
		count++
	}
	return count, nil
}
