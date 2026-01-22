package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/discount"
	"rrnet/internal/repository"
)

var (
	ErrDiscountNameRequired   = errors.New("discount name is required")
	ErrDiscountTypeInvalid    = errors.New("invalid discount type")
	ErrDiscountValueInvalid   = errors.New("invalid discount value")
	ErrDiscountExpired        = errors.New("discount has expired")
)

// DiscountService handles discount business logic
type DiscountService struct {
	repo *repository.DiscountRepository
}

// NewDiscountService creates a new discount service
func NewDiscountService(repo *repository.DiscountRepository) *DiscountService {
	return &DiscountService{repo: repo}
}

// CreateDiscountRequest represents request to create a discount
type CreateDiscountRequest struct {
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	Type        discount.Type `json:"type"`
	Value       float64    `json:"value"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	IsActive    bool       `json:"is_active"`
}

// UpdateDiscountRequest represents request to update a discount
type UpdateDiscountRequest = CreateDiscountRequest

// DiscountDTO represents discount data for API responses
type DiscountDTO struct {
	ID          uuid.UUID   `json:"id"`
	TenantID    uuid.UUID   `json:"tenant_id"`
	Name        string      `json:"name"`
	Description *string     `json:"description,omitempty"`
	Type        discount.Type `json:"type"`
	Value       float64     `json:"value"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	IsActive    bool        `json:"is_active"`
	IsValid     bool        `json:"is_valid"` // Computed: active, not expired, not deleted
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

// Create creates a new discount
func (s *DiscountService) Create(ctx context.Context, tenantID uuid.UUID, req *CreateDiscountRequest) (*DiscountDTO, error) {
	if req.Name == "" {
		return nil, ErrDiscountNameRequired
	}
	if req.Type != discount.TypePercent && req.Type != discount.TypeNominal {
		return nil, ErrDiscountTypeInvalid
	}
	if req.Value < 0 {
		return nil, ErrDiscountValueInvalid
	}
	if req.Type == discount.TypePercent && req.Value > 100 {
		return nil, ErrDiscountValueInvalid
	}
	// For nominal (IDR) type, value must be a whole number (rounded)
	if req.Type == discount.TypeNominal {
		// Round to nearest integer to ensure no decimals
		roundedValue := float64(int64(req.Value + 0.5))
		if roundedValue != req.Value {
			// If value has decimals, round it
			req.Value = roundedValue
		}
	}
	if req.ExpiresAt != nil && req.ExpiresAt.Before(time.Now()) {
		return nil, ErrDiscountExpired
	}

	// Check if name already exists
	exists, err := s.repo.NameExists(ctx, tenantID, req.Name, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, repository.ErrDiscountNameTaken
	}

	now := time.Now()
	d := &discount.Discount{
		ID:        uuid.New(),
		TenantID:  tenantID,
		Name:      req.Name,
		Description: req.Description,
		Type:      req.Type,
		Value:     req.Value,
		ExpiresAt: req.ExpiresAt,
		IsActive:  req.IsActive,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.Create(ctx, d); err != nil {
		return nil, err
	}
	return toDiscountDTO(d), nil
}

// GetByID retrieves a discount by ID
func (s *DiscountService) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*DiscountDTO, error) {
	d, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}
	return toDiscountDTO(d), nil
}

// List retrieves all discounts for a tenant
func (s *DiscountService) List(ctx context.Context, tenantID uuid.UUID, includeInactive bool) ([]*DiscountDTO, error) {
	discounts, err := s.repo.List(ctx, tenantID, includeInactive)
	if err != nil {
		return nil, err
	}
	return toDiscountDTOs(discounts), nil
}

// ListValid retrieves only valid (active, not expired) discounts
func (s *DiscountService) ListValid(ctx context.Context, tenantID uuid.UUID) ([]*DiscountDTO, error) {
	discounts, err := s.repo.ListValid(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return toDiscountDTOs(discounts), nil
}

// Update updates a discount
func (s *DiscountService) Update(ctx context.Context, tenantID, id uuid.UUID, req *UpdateDiscountRequest) (*DiscountDTO, error) {
	if req.Name == "" {
		return nil, ErrDiscountNameRequired
	}
	if req.Type != discount.TypePercent && req.Type != discount.TypeNominal {
		return nil, ErrDiscountTypeInvalid
	}
	if req.Value < 0 {
		return nil, ErrDiscountValueInvalid
	}
	if req.Type == discount.TypePercent && req.Value > 100 {
		return nil, ErrDiscountValueInvalid
	}
	// For nominal (IDR) type, value must be a whole number (rounded)
	if req.Type == discount.TypeNominal {
		// Round to nearest integer to ensure no decimals
		roundedValue := float64(int64(req.Value + 0.5))
		if roundedValue != req.Value {
			// If value has decimals, round it
			req.Value = roundedValue
		}
	}
	if req.ExpiresAt != nil && req.ExpiresAt.Before(time.Now()) {
		return nil, ErrDiscountExpired
	}

	// Check if name already exists (excluding current discount)
	excludeID := &id
	exists, err := s.repo.NameExists(ctx, tenantID, req.Name, excludeID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, repository.ErrDiscountNameTaken
	}

	// Get existing discount
	d, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}

	// Update fields
	d.Name = req.Name
	d.Description = req.Description
	d.Type = req.Type
	d.Value = req.Value
	d.ExpiresAt = req.ExpiresAt
	d.IsActive = req.IsActive
	d.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, d); err != nil {
		return nil, err
	}
	return toDiscountDTO(d), nil
}

// Delete soft deletes a discount
func (s *DiscountService) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	return s.repo.Delete(ctx, id, tenantID)
}

// Helper functions
func toDiscountDTO(d *discount.Discount) *DiscountDTO {
	return &DiscountDTO{
		ID:          d.ID,
		TenantID:    d.TenantID,
		Name:        d.Name,
		Description: d.Description,
		Type:        d.Type,
		Value:       d.Value,
		ExpiresAt:   d.ExpiresAt,
		IsActive:    d.IsActive,
		IsValid:     d.IsValid(),
		CreatedAt:   d.CreatedAt,
		UpdatedAt:   d.UpdatedAt,
	}
}

func toDiscountDTOs(discounts []*discount.Discount) []*DiscountDTO {
	dtos := make([]*DiscountDTO, len(discounts))
	for i, d := range discounts {
		dtos[i] = toDiscountDTO(d)
	}
	return dtos
}

