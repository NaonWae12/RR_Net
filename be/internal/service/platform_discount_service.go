package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/billing"
	"rrnet/internal/repository"
)

var (
	ErrPlatformDiscountCodeRequired = errors.New("discount code is required")
	ErrPlatformDiscountCodeTaken    = errors.New("discount code already exists")
)

type PlatformDiscountService struct {
	repo *repository.PlatformDiscountRepository
}

func NewPlatformDiscountService(repo *repository.PlatformDiscountRepository) *PlatformDiscountService {
	return &PlatformDiscountService{repo: repo}
}

type CreatePlatformDiscountRequest struct {
	Code        string                       `json:"code"`
	Name        string                       `json:"name"`
	Description *string                      `json:"description,omitempty"`
	Type        billing.PlatformDiscountType `json:"type"`
	Value       float64                      `json:"value"`
	MinPurchase float64                      `json:"min_purchase"`
	MaxDiscount *float64                     `json:"max_discount,omitempty"`
	UsageLimit  *int                         `json:"usage_limit,omitempty"`
	ExpiresAt   *time.Time                   `json:"expires_at,omitempty"`
	IsActive    bool                         `json:"is_active"`
}

type UpdatePlatformDiscountRequest = CreatePlatformDiscountRequest

func (s *PlatformDiscountService) Create(ctx context.Context, req *CreatePlatformDiscountRequest) (*billing.PlatformDiscount, error) {
	if req.Code == "" {
		return nil, ErrPlatformDiscountCodeRequired
	}

	exists, err := s.repo.CodeExists(ctx, req.Code, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrPlatformDiscountCodeTaken
	}

	now := time.Now()
	d := &billing.PlatformDiscount{
		ID:          uuid.New(),
		Code:        req.Code,
		Name:        req.Name,
		Description: req.Description,
		Type:        req.Type,
		Value:       req.Value,
		MinPurchase: req.MinPurchase,
		MaxDiscount: req.MaxDiscount,
		UsageLimit:  req.UsageLimit,
		UsedCount:   0,
		ExpiresAt:   req.ExpiresAt,
		IsActive:    req.IsActive,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Create(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *PlatformDiscountService) GetByID(ctx context.Context, id uuid.UUID) (*billing.PlatformDiscount, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *PlatformDiscountService) GetByCode(ctx context.Context, code string) (*billing.PlatformDiscount, error) {
	return s.repo.GetByCode(ctx, code)
}

func (s *PlatformDiscountService) List(ctx context.Context, includeInactive bool) ([]*billing.PlatformDiscount, error) {
	return s.repo.List(ctx, includeInactive)
}

func (s *PlatformDiscountService) Update(ctx context.Context, id uuid.UUID, req *UpdatePlatformDiscountRequest) (*billing.PlatformDiscount, error) {
	d, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	exists, err := s.repo.CodeExists(ctx, req.Code, &id)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrPlatformDiscountCodeTaken
	}

	d.Code = req.Code
	d.Name = req.Name
	d.Description = req.Description
	d.Type = req.Type
	d.Value = req.Value
	d.MinPurchase = req.MinPurchase
	d.MaxDiscount = req.MaxDiscount
	d.UsageLimit = req.UsageLimit
	d.ExpiresAt = req.ExpiresAt
	d.IsActive = req.IsActive
	d.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *PlatformDiscountService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

func (s *PlatformDiscountService) ValidateCode(ctx context.Context, code string, amount float64) (*billing.PlatformDiscount, float64, error) {
	d, err := s.repo.GetByCode(ctx, code)
	if err != nil {
		return nil, 0, err
	}

	if !d.IsValid(amount) {
		return nil, 0, errors.New("discount code is not applicable or has expired")
	}

	discountAmount := d.CalculateDiscount(amount)
	return d, discountAmount, nil
}
