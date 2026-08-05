package service

import (
	"context"
	"fmt"
	"time"

	"rrnet/internal/domain/finance"
	"rrnet/internal/domain/reseller"
	"rrnet/internal/domain/voucher"
	"rrnet/internal/repository"

	"github.com/google/uuid"
)

type FinanceService struct {
	financeRepo *repository.FinanceRepository
}

func NewFinanceService(financeRepo *repository.FinanceRepository) *FinanceService {
	return &FinanceService{
		financeRepo: financeRepo,
	}
}

// RecordVoucherRevenue logs revenue when a voucher is first used
func (s *FinanceService) RecordVoucherRevenue(ctx context.Context, v *voucher.Voucher, pkg *voucher.VoucherPackage) error {
	desc := fmt.Sprintf("Voucher Usage: %s (Package: %s)", v.Code, pkg.Name)

	tx := &finance.Transaction{
		ID:          uuid.New(),
		TenantID:    v.TenantID,
		Type:        finance.TransactionTypeIncome,
		Source:      finance.TransactionSourceVoucherUsage,
		SourceID:    v.ID,
		Amount:      pkg.Price,
		Currency:    pkg.Currency,
		Description: desc,
		CreatedAt:   time.Now(),
	}

	return s.financeRepo.RecordTransaction(ctx, tx)
}

// RecordResellerPurchaseRevenue logs revenue when a reseller buys a batch of vouchers
func (s *FinanceService) RecordResellerPurchaseRevenue(ctx context.Context, p *reseller.ResellerPurchase) error {
	desc := fmt.Sprintf("Reseller Purchase: %d x %s (Reseller: %s)", p.Quantity, p.VoucherPackageName, p.ResellerName)

	tx := &finance.Transaction{
		ID:          uuid.New(),
		TenantID:    p.TenantID,
		Type:        finance.TransactionTypeIncome,
		Source:      finance.TransactionSourceResellerPurchase,
		SourceID:    p.ID,
		Amount:      p.Margin,
		Currency:    "IDR", // Defaulting to IDR for now
		Description: desc,
		CreatedAt:   time.Now(),
	}

	return s.financeRepo.RecordTransaction(ctx, tx)
}

func (s *FinanceService) GetRevenueSummary(ctx context.Context, tenantID uuid.UUID) (*finance.RevenueSummary, error) {
	return s.financeRepo.GetRevenueSummary(ctx, tenantID)
}

func (s *FinanceService) GetFilteredRevenueSummary(ctx context.Context, tenantID uuid.UUID, year, month int) (*finance.RevenueSummary, error) {
	return s.financeRepo.GetFilteredSummary(ctx, tenantID, year, month)
}

func (s *FinanceService) GetTrendData(ctx context.Context, tenantID uuid.UUID, year, month int, source string) (*finance.TrendResponse, error) {
	return s.financeRepo.GetTrendData(ctx, tenantID, year, month, source)
}

func (s *FinanceService) GetBalance(ctx context.Context, tenantID uuid.UUID) (float64, error) {
	return s.financeRepo.GetBalance(ctx, tenantID)
}

func (s *FinanceService) DeleteTransactionBySource(ctx context.Context, tenantID uuid.UUID, source string, sourceID uuid.UUID) error {
	return s.financeRepo.DeleteTransactionBySource(ctx, tenantID, source, sourceID)
}

func (s *FinanceService) DeleteTransactionsBySourceIDs(ctx context.Context, tenantID uuid.UUID, source string, sourceIDs []uuid.UUID) error {
	return s.financeRepo.DeleteTransactionsBySourceIDs(ctx, tenantID, source, sourceIDs)
}
