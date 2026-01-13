package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/service_package"
	"rrnet/internal/repository"
)

var (
	ErrServicePackageNameRequired   = errors.New("service package name is required")
	ErrServicePackageInvalidCategory = errors.New("invalid service package category")
	ErrServicePackageInvalidPricing  = errors.New("invalid pricing model for category")
	ErrServicePackageProfileRequired = errors.New("network profile is required")
	ErrServicePackagePriceInvalid    = errors.New("invalid price")
)

type ServicePackageService struct {
	repo *repository.ServicePackageRepository
}

func NewServicePackageService(repo *repository.ServicePackageRepository) *ServicePackageService {
	return &ServicePackageService{repo: repo}
}

type CreateServicePackageRequest struct {
	Name              string                      `json:"name"`
	Category          service_package.Category     `json:"category"`
	PricingModel      service_package.PricingModel `json:"pricing_model"`
	PriceMonthly      float64                     `json:"price_monthly,omitempty"`
	PricePerDevice    float64                     `json:"price_per_device,omitempty"`
	BillingDayDefault *int                        `json:"billing_day_default,omitempty"`
	NetworkProfileID  uuid.UUID                   `json:"network_profile_id"`
	IsActive          bool                        `json:"is_active"`
	Metadata          map[string]interface{}       `json:"metadata,omitempty"`
}

type UpdateServicePackageRequest = CreateServicePackageRequest

type ServicePackageDTO struct {
	ID               uuid.UUID                   `json:"id"`
	Name             string                      `json:"name"`
	Category          service_package.Category     `json:"category"`
	PricingModel      service_package.PricingModel `json:"pricing_model"`
	PriceMonthly      float64                     `json:"price_monthly"`
	PricePerDevice    float64                     `json:"price_per_device"`
	BillingDayDefault *int                        `json:"billing_day_default,omitempty"`
	NetworkProfileID  uuid.UUID                   `json:"network_profile_id"`
	IsActive          bool                        `json:"is_active"`
	CreatedAt         time.Time                   `json:"created_at"`
	UpdatedAt         time.Time                   `json:"updated_at"`
}

func (s *ServicePackageService) Create(ctx context.Context, tenantID uuid.UUID, req *CreateServicePackageRequest) (*ServicePackageDTO, error) {
	if req.Name == "" {
		return nil, ErrServicePackageNameRequired
	}
	if req.NetworkProfileID == (uuid.UUID{}) {
		return nil, ErrServicePackageProfileRequired
	}
	if err := validatePackageReq(req.Category, req.PricingModel, req.PriceMonthly, req.PricePerDevice); err != nil {
		return nil, err
	}

	exists, err := s.repo.NameExists(ctx, tenantID, req.Name, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, repository.ErrServicePackageNameTaken
	}

	now := time.Now()
	metadataJSON, _ := json.Marshal(req.Metadata)

	p := &service_package.ServicePackage{
		ID:               uuid.New(),
		TenantID:          tenantID,
		Name:             req.Name,
		Category:          req.Category,
		PricingModel:      req.PricingModel,
		PriceMonthly:      req.PriceMonthly,
		PricePerDevice:    req.PricePerDevice,
		BillingDayDefault: req.BillingDayDefault,
		NetworkProfileID:  req.NetworkProfileID,
		IsActive:          req.IsActive,
		Metadata:          metadataJSON,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if err := s.repo.Create(ctx, p); err != nil {
		return nil, err
	}
	return toServicePackageDTO(p), nil
}

func (s *ServicePackageService) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*ServicePackageDTO, error) {
	p, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return toServicePackageDTO(p), nil
}

func (s *ServicePackageService) List(ctx context.Context, tenantID uuid.UUID, activeOnly bool, category *service_package.Category) ([]*ServicePackageDTO, error) {
	items, err := s.repo.ListByTenant(ctx, tenantID, activeOnly, category)
	if err != nil {
		return nil, err
	}
	out := make([]*ServicePackageDTO, 0, len(items))
	for _, p := range items {
		out = append(out, toServicePackageDTO(p))
	}
	return out, nil
}

func (s *ServicePackageService) Update(ctx context.Context, tenantID, id uuid.UUID, req *UpdateServicePackageRequest) (*ServicePackageDTO, error) {
	if req.Name == "" {
		return nil, ErrServicePackageNameRequired
	}
	if req.NetworkProfileID == (uuid.UUID{}) {
		return nil, ErrServicePackageProfileRequired
	}
	if err := validatePackageReq(req.Category, req.PricingModel, req.PriceMonthly, req.PricePerDevice); err != nil {
		return nil, err
	}

	exists, err := s.repo.NameExists(ctx, tenantID, req.Name, &id)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, repository.ErrServicePackageNameTaken
	}

	metadataJSON, _ := json.Marshal(req.Metadata)

	p := &service_package.ServicePackage{
		ID:               id,
		TenantID:          tenantID,
		Name:             req.Name,
		Category:          req.Category,
		PricingModel:      req.PricingModel,
		PriceMonthly:      req.PriceMonthly,
		PricePerDevice:    req.PricePerDevice,
		BillingDayDefault: req.BillingDayDefault,
		NetworkProfileID:  req.NetworkProfileID,
		IsActive:          req.IsActive,
		Metadata:          metadataJSON,
		UpdatedAt:         time.Now(),
	}

	if err := s.repo.Update(ctx, p); err != nil {
		return nil, err
	}
	return toServicePackageDTO(p), nil
}

func (s *ServicePackageService) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	return s.repo.SoftDelete(ctx, tenantID, id)
}

func toServicePackageDTO(p *service_package.ServicePackage) *ServicePackageDTO {
	return &ServicePackageDTO{
		ID:               p.ID,
		Name:             p.Name,
		Category:          p.Category,
		PricingModel:      p.PricingModel,
		PriceMonthly:      p.PriceMonthly,
		PricePerDevice:    p.PricePerDevice,
		BillingDayDefault: p.BillingDayDefault,
		NetworkProfileID:  p.NetworkProfileID,
		IsActive:          p.IsActive,
		CreatedAt:         p.CreatedAt,
		UpdatedAt:         p.UpdatedAt,
	}
}

func validatePackageReq(category service_package.Category, pricing service_package.PricingModel, priceMonthly, pricePerDevice float64) error {
	switch category {
	case service_package.CategoryRegular, service_package.CategoryBusiness, service_package.CategoryEnterprise:
		if pricing != service_package.PricingModelFlatMonthly {
			return ErrServicePackageInvalidPricing
		}
		if priceMonthly < 0 {
			return ErrServicePackagePriceInvalid
		}
		return nil
	case service_package.CategoryLite:
		if pricing != service_package.PricingModelPerDevice {
			return ErrServicePackageInvalidPricing
		}
		if pricePerDevice < 0 {
			return ErrServicePackagePriceInvalid
		}
		return nil
	default:
		return ErrServicePackageInvalidCategory
	}
}


