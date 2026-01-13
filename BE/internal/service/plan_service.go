package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/config"
	"rrnet/internal/domain/plan"
	"rrnet/internal/repository"
)

var (
	ErrPlanCodeRequired  = errors.New("plan code is required")
	ErrPlanNameRequired  = errors.New("plan name is required")
	ErrInvalidPlanLimits = errors.New("invalid plan limits")
)

// PlanService handles plan business logic
type PlanService struct {
	planRepo   *repository.PlanRepository
	tenantRepo *repository.TenantRepository
}

// NewPlanService creates a new plan service
func NewPlanService(planRepo *repository.PlanRepository, tenantRepo *repository.TenantRepository) *PlanService {
	return &PlanService{
		planRepo:   planRepo,
		tenantRepo: tenantRepo,
	}
}

// CreatePlanRequest represents request to create a plan
type CreatePlanRequest struct {
	Code         string   `json:"code"`
	Name         string   `json:"name"`
	Description  string   `json:"description,omitempty"`
	PriceMonthly float64  `json:"price_monthly"`
	PriceYearly  *float64 `json:"price_yearly,omitempty"`
	Currency     string   `json:"currency,omitempty"`
	Limits       map[string]int `json:"limits"`
	Features     []string `json:"features"`
	IsActive     bool     `json:"is_active"`
	IsPublic     bool     `json:"is_public"`
	SortOrder    int      `json:"sort_order"`
}

// PlanDTO represents plan data for API responses
type PlanDTO struct {
	ID           uuid.UUID      `json:"id"`
	Code         string         `json:"code"`
	Name         string         `json:"name"`
	Description  *string        `json:"description,omitempty"`
	PriceMonthly float64        `json:"price_monthly"`
	PriceYearly  *float64       `json:"price_yearly,omitempty"`
	Currency     string         `json:"currency"`
	Limits       map[string]int `json:"limits"`
	Features     []string       `json:"features"`
	IsActive     bool           `json:"is_active"`
	IsPublic     bool           `json:"is_public"`
	SortOrder    int            `json:"sort_order"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

// Create creates a new plan
func (s *PlanService) Create(ctx context.Context, req *CreatePlanRequest) (*PlanDTO, error) {
	// Validate
	if req.Code == "" {
		return nil, ErrPlanCodeRequired
	}
	if req.Name == "" {
		return nil, ErrPlanNameRequired
	}

	// Check code uniqueness
	exists, err := s.planRepo.CodeExists(ctx, req.Code, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, repository.ErrPlanCodeTaken
	}

	// Validate feature codes
	if err := config.ValidateFeatureCodes(req.Features); err != nil {
		return nil, err
	}

	// Marshal limits and features
	limitsJSON, err := json.Marshal(req.Limits)
	if err != nil {
		return nil, ErrInvalidPlanLimits
	}
	featuresJSON, err := json.Marshal(req.Features)
	if err != nil {
		return nil, err
	}

	// Set defaults
	currency := req.Currency
	if currency == "" {
		currency = "IDR"
	}

	// Create plan
	now := time.Now()
	var desc *string
	if req.Description != "" {
		desc = &req.Description
	}

	p := &plan.Plan{
		ID:           uuid.New(),
		Code:         req.Code,
		Name:         req.Name,
		Description:  desc,
		PriceMonthly: req.PriceMonthly,
		PriceYearly:  req.PriceYearly,
		Currency:     currency,
		Limits:       limitsJSON,
		Features:     featuresJSON,
		IsActive:     req.IsActive,
		IsPublic:     req.IsPublic,
		SortOrder:    req.SortOrder,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.planRepo.Create(ctx, p); err != nil {
		return nil, err
	}

	return s.toDTO(p), nil
}

// GetByID retrieves a plan by ID
func (s *PlanService) GetByID(ctx context.Context, id uuid.UUID) (*PlanDTO, error) {
	p, err := s.planRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.toDTO(p), nil
}

// GetByCode retrieves a plan by code
func (s *PlanService) GetByCode(ctx context.Context, code string) (*PlanDTO, error) {
	p, err := s.planRepo.GetByCode(ctx, code)
	if err != nil {
		return nil, err
	}
	return s.toDTO(p), nil
}

// List retrieves all plans
func (s *PlanService) List(ctx context.Context, activeOnly, publicOnly bool) ([]*PlanDTO, error) {
	plans, err := s.planRepo.List(ctx, activeOnly, publicOnly)
	if err != nil {
		return nil, err
	}

	dtos := make([]*PlanDTO, len(plans))
	for i, p := range plans {
		dtos[i] = s.toDTO(p)
	}
	return dtos, nil
}

// UpdatePlanRequest represents request to update a plan
type UpdatePlanRequest struct {
	Name         string   `json:"name"`
	Description  string   `json:"description,omitempty"`
	PriceMonthly float64  `json:"price_monthly"`
	PriceYearly  *float64 `json:"price_yearly,omitempty"`
	Currency     string   `json:"currency,omitempty"`
	Limits       map[string]int `json:"limits"`
	Features     []string `json:"features"`
	IsActive     bool     `json:"is_active"`
	IsPublic     bool     `json:"is_public"`
	SortOrder    int      `json:"sort_order"`
}

// Update updates a plan
func (s *PlanService) Update(ctx context.Context, id uuid.UUID, req *UpdatePlanRequest) (*PlanDTO, error) {
	// Get existing plan
	p, err := s.planRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Update fields
	if req.Name != "" {
		p.Name = req.Name
	}
	if req.Description != "" {
		p.Description = &req.Description
	}
	p.PriceMonthly = req.PriceMonthly
	p.PriceYearly = req.PriceYearly
	if req.Currency != "" {
		p.Currency = req.Currency
	}
	if req.Limits != nil {
		limitsJSON, err := json.Marshal(req.Limits)
		if err != nil {
			return nil, ErrInvalidPlanLimits
		}
		p.Limits = limitsJSON
	}
	if req.Features != nil {
		// Validate feature codes before updating
		if err := config.ValidateFeatureCodes(req.Features); err != nil {
			return nil, err
		}
		featuresJSON, _ := json.Marshal(req.Features)
		p.Features = featuresJSON
	}
	p.IsActive = req.IsActive
	p.IsPublic = req.IsPublic
	p.SortOrder = req.SortOrder

	if err := s.planRepo.Update(ctx, p); err != nil {
		return nil, err
	}

	return s.toDTO(p), nil
}

// Delete deletes a plan
func (s *PlanService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.planRepo.Delete(ctx, id)
}

// AssignToTenant assigns a plan to a tenant
func (s *PlanService) AssignToTenant(ctx context.Context, tenantID, planID uuid.UUID) error {
	// Verify plan exists and is active
	p, err := s.planRepo.GetByID(ctx, planID)
	if err != nil {
		return err
	}
	if !p.IsActive {
		return errors.New("plan is not active")
	}

	return s.planRepo.AssignPlanToTenant(ctx, tenantID, planID)
}

// GetTenantPlan retrieves the plan assigned to a tenant
func (s *PlanService) GetTenantPlan(ctx context.Context, tenantID uuid.UUID) (*PlanDTO, error) {
	p, err := s.planRepo.GetTenantPlan(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return s.toDTO(p), nil
}

// toDTO converts plan entity to DTO
func (s *PlanService) toDTO(p *plan.Plan) *PlanDTO {
	var limits map[string]int
	_ = json.Unmarshal(p.Limits, &limits)

	var features []string
	_ = json.Unmarshal(p.Features, &features)

	return &PlanDTO{
		ID:           p.ID,
		Code:         p.Code,
		Name:         p.Name,
		Description:  p.Description,
		PriceMonthly: p.PriceMonthly,
		PriceYearly:  p.PriceYearly,
		Currency:     p.Currency,
		Limits:       limits,
		Features:     features,
		IsActive:     p.IsActive,
		IsPublic:     p.IsPublic,
		SortOrder:    p.SortOrder,
		CreatedAt:    p.CreatedAt,
		UpdatedAt:    p.UpdatedAt,
	}
}


