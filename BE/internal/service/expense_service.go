package service

import (
	"context"
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

	if e.PaidAt != nil || e.PaymentMethodID != nil {
		e.Status = "paid"
		if e.PaidAt == nil {
			now := time.Now()
			e.PaidAt = &now
		}
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
