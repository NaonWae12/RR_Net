package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/addon"
	"rrnet/internal/repository"
)

var (
	ErrAddonCodeRequired = errors.New("addon code is required")
	ErrAddonNameRequired = errors.New("addon name is required")
	ErrInvalidAddonValue = errors.New("invalid addon value")
	ErrAddonNotForPlan   = errors.New("addon not available for tenant plan")
)

// AddonService handles addon business logic
type AddonService struct {
	addonRepo  *repository.AddonRepository
	planRepo   *repository.PlanRepository
	tenantRepo *repository.TenantRepository
}

// NewAddonService creates a new addon service
func NewAddonService(addonRepo *repository.AddonRepository, planRepo *repository.PlanRepository, tenantRepo *repository.TenantRepository) *AddonService {
	return &AddonService{
		addonRepo:  addonRepo,
		planRepo:   planRepo,
		tenantRepo: tenantRepo,
	}
}

// CreateAddonRequest represents request to create an addon
type CreateAddonRequest struct {
	Code             string              `json:"code"`
	Name             string              `json:"name"`
	Description      string              `json:"description,omitempty"`
	Price            float64             `json:"price"`
	BillingCycle     addon.BillingCycle  `json:"billing_cycle"`
	Currency         string              `json:"currency,omitempty"`
	Type             addon.AddonType     `json:"addon_type"`
	Value            map[string]interface{} `json:"value"`
	IsActive         bool                `json:"is_active"`
	AvailableForPlans []string           `json:"available_for_plans"`
}

// AddonDTO represents addon data for API responses
type AddonDTO struct {
	ID                uuid.UUID             `json:"id"`
	Code              string                `json:"code"`
	Name              string                `json:"name"`
	Description       *string               `json:"description,omitempty"`
	Price             float64               `json:"price"`
	BillingCycle      addon.BillingCycle    `json:"billing_cycle"`
	Currency          string                `json:"currency"`
	Type              addon.AddonType       `json:"addon_type"`
	Value             map[string]interface{} `json:"value"`
	IsActive          bool                  `json:"is_active"`
	AvailableForPlans []string              `json:"available_for_plans"`
	CreatedAt         time.Time             `json:"created_at"`
	UpdatedAt         time.Time             `json:"updated_at"`
}

// Create creates a new addon
func (s *AddonService) Create(ctx context.Context, req *CreateAddonRequest) (*AddonDTO, error) {
	// Validate
	if req.Code == "" {
		return nil, ErrAddonCodeRequired
	}
	if req.Name == "" {
		return nil, ErrAddonNameRequired
	}

	// Check code uniqueness
	exists, err := s.addonRepo.CodeExists(ctx, req.Code, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, repository.ErrAddonCodeTaken
	}

	// Marshal value and available plans
	valueJSON, err := json.Marshal(req.Value)
	if err != nil {
		return nil, ErrInvalidAddonValue
	}
	plansJSON, err := json.Marshal(req.AvailableForPlans)
	if err != nil {
		return nil, err
	}

	// Set defaults
	currency := req.Currency
	if currency == "" {
		currency = "IDR"
	}
	billingCycle := req.BillingCycle
	if billingCycle == "" {
		billingCycle = addon.BillingCycleMonthly
	}

	// Create addon
	now := time.Now()
	var desc *string
	if req.Description != "" {
		desc = &req.Description
	}

	a := &addon.Addon{
		ID:                uuid.New(),
		Code:              req.Code,
		Name:              req.Name,
		Description:       desc,
		Price:             req.Price,
		BillingCycle:      billingCycle,
		Currency:          currency,
		Type:              req.Type,
		Value:             valueJSON,
		IsActive:          req.IsActive,
		AvailableForPlans: plansJSON,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if err := s.addonRepo.Create(ctx, a); err != nil {
		return nil, err
	}

	return s.toDTO(a), nil
}

// GetByID retrieves an addon by ID
func (s *AddonService) GetByID(ctx context.Context, id uuid.UUID) (*AddonDTO, error) {
	a, err := s.addonRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.toDTO(a), nil
}

// List retrieves all addons
func (s *AddonService) List(ctx context.Context, activeOnly bool, addonType *addon.AddonType) ([]*AddonDTO, error) {
	addons, err := s.addonRepo.List(ctx, activeOnly, addonType)
	if err != nil {
		return nil, err
	}

	dtos := make([]*AddonDTO, len(addons))
	for i, a := range addons {
		dtos[i] = s.toDTO(a)
	}
	return dtos, nil
}

// UpdateAddonRequest represents request to update an addon
type UpdateAddonRequest struct {
	Name              string                 `json:"name"`
	Description       string                 `json:"description,omitempty"`
	Price             float64                `json:"price"`
	BillingCycle      addon.BillingCycle     `json:"billing_cycle"`
	Currency          string                 `json:"currency,omitempty"`
	Type              addon.AddonType        `json:"addon_type"`
	Value             map[string]interface{} `json:"value"`
	IsActive          bool                   `json:"is_active"`
	AvailableForPlans []string               `json:"available_for_plans"`
}

// Update updates an addon
func (s *AddonService) Update(ctx context.Context, id uuid.UUID, req *UpdateAddonRequest) (*AddonDTO, error) {
	// Get existing addon
	a, err := s.addonRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Update fields
	if req.Name != "" {
		a.Name = req.Name
	}
	if req.Description != "" {
		a.Description = &req.Description
	}
	a.Price = req.Price
	if req.BillingCycle != "" {
		a.BillingCycle = req.BillingCycle
	}
	if req.Currency != "" {
		a.Currency = req.Currency
	}
	if req.Type != "" {
		a.Type = req.Type
	}
	if req.Value != nil {
		valueJSON, err := json.Marshal(req.Value)
		if err != nil {
			return nil, ErrInvalidAddonValue
		}
		a.Value = valueJSON
	}
	a.IsActive = req.IsActive
	if req.AvailableForPlans != nil {
		plansJSON, _ := json.Marshal(req.AvailableForPlans)
		a.AvailableForPlans = plansJSON
	}

	if err := s.addonRepo.Update(ctx, a); err != nil {
		return nil, err
	}

	return s.toDTO(a), nil
}

// Delete deletes an addon
func (s *AddonService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.addonRepo.Delete(ctx, id)
}

// TenantAddonDTO represents tenant addon data for API responses
type TenantAddonDTO struct {
	ID        uuid.UUID   `json:"id"`
	TenantID  uuid.UUID   `json:"tenant_id"`
	AddonID   uuid.UUID   `json:"addon_id"`
	Addon     *AddonDTO   `json:"addon,omitempty"`
	StartedAt time.Time   `json:"started_at"`
	ExpiresAt *time.Time  `json:"expires_at,omitempty"`
}

// AssignToTenant assigns an addon to a tenant
func (s *AddonService) AssignToTenant(ctx context.Context, tenantID, addonID uuid.UUID, expiresAt *time.Time) error {
	// Verify addon exists and is active
	a, err := s.addonRepo.GetByID(ctx, addonID)
	if err != nil {
		return err
	}
	if !a.IsActive {
		return errors.New("addon is not active")
	}

	// Verify addon is available for tenant's plan
	plan, err := s.planRepo.GetTenantPlan(ctx, tenantID)
	if err == nil && plan != nil {
		if !a.IsAvailableForPlan(plan.Code) {
			return ErrAddonNotForPlan
		}
	}

	return s.addonRepo.AssignAddonToTenant(ctx, tenantID, addonID, expiresAt)
}

// RemoveFromTenant removes an addon from a tenant
func (s *AddonService) RemoveFromTenant(ctx context.Context, tenantID, addonID uuid.UUID) error {
	return s.addonRepo.RemoveAddonFromTenant(ctx, tenantID, addonID)
}

// GetTenantAddons retrieves all addons for a tenant
func (s *AddonService) GetTenantAddons(ctx context.Context, tenantID uuid.UUID) ([]*TenantAddonDTO, error) {
	tenantAddons, err := s.addonRepo.GetTenantAddons(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	dtos := make([]*TenantAddonDTO, len(tenantAddons))
	for i, ta := range tenantAddons {
		dto := &TenantAddonDTO{
			ID:        ta.ID,
			TenantID:  ta.TenantID,
			AddonID:   ta.AddonID,
			StartedAt: ta.StartedAt,
			ExpiresAt: ta.ExpiresAt,
		}
		if ta.Addon != nil {
			dto.Addon = s.toDTO(ta.Addon)
		}
		dtos[i] = dto
	}
	return dtos, nil
}

// toDTO converts addon entity to DTO
func (s *AddonService) toDTO(a *addon.Addon) *AddonDTO {
	var value map[string]interface{}
	_ = json.Unmarshal(a.Value, &value)

	var plans []string
	_ = json.Unmarshal(a.AvailableForPlans, &plans)

	return &AddonDTO{
		ID:                a.ID,
		Code:              a.Code,
		Name:              a.Name,
		Description:       a.Description,
		Price:             a.Price,
		BillingCycle:      a.BillingCycle,
		Currency:          a.Currency,
		Type:              a.Type,
		Value:             value,
		IsActive:          a.IsActive,
		AvailableForPlans: plans,
		CreatedAt:         a.CreatedAt,
		UpdatedAt:         a.UpdatedAt,
	}
}


