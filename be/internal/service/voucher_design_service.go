package service

import (
	"context"
	"rrnet/internal/domain/voucher"
	"rrnet/internal/repository"
	"github.com/google/uuid"
)

type VoucherDesignService struct {
	repo       *repository.VoucherDesignRepository
	tenantRepo *repository.TenantRepository
}

func NewVoucherDesignService(repo *repository.VoucherDesignRepository, tenantRepo *repository.TenantRepository) *VoucherDesignService {
	return &VoucherDesignService{
		repo:       repo,
		tenantRepo: tenantRepo,
	}
}

func (s *VoucherDesignService) UpdateGlobalSettings(ctx context.Context, tenantID uuid.UUID, defaultSlug, resellerSlug string) error {
	return s.tenantRepo.UpdateDesignSettings(ctx, tenantID, defaultSlug, resellerSlug)
}

func (s *VoucherDesignService) ListAll(ctx context.Context) ([]*voucher.VoucherDesign, error) {
	return s.repo.List(ctx)
}

func (s *VoucherDesignService) ListOwned(ctx context.Context, tenantID uuid.UUID) ([]*voucher.VoucherDesign, error) {
	return s.repo.ListOwnedByTenant(ctx, tenantID)
}

func (s *VoucherDesignService) Purchase(ctx context.Context, tenantID uuid.UUID, designID uuid.UUID) error {
	// 1. Get design info
	d, err := s.repo.GetByID(ctx, designID)
	if err != nil {
		return err
	}

	// 2. Perform purchase logic (here we just record it)
	// In a real scenario, you'd check tenant balance or process payment
	return s.repo.Purchase(ctx, tenantID, d.ID)
}
