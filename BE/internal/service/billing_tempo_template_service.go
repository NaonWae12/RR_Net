package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/billing"
	"rrnet/internal/repository"
)

var (
	ErrTempoTemplateNameRequired = errors.New("tempo template name is required")
	ErrTempoTemplateDueDayInvalid = errors.New("tempo template due_day must be between 1 and 31")
)

type BillingTempoTemplateService struct {
	repo *repository.BillingTempoTemplateRepository
}

func NewBillingTempoTemplateService(repo *repository.BillingTempoTemplateRepository) *BillingTempoTemplateService {
	return &BillingTempoTemplateService{repo: repo}
}

type CreateTempoTemplateRequest struct {
	Name        string  `json:"name"`
	DueDay      int     `json:"due_day"`
	Description *string `json:"description,omitempty"`
}

type UpdateTempoTemplateRequest = CreateTempoTemplateRequest

type TempoTemplateDTO struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	DueDay      int       `json:"due_day"`
	Description *string   `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (s *BillingTempoTemplateService) List(ctx context.Context, tenantID uuid.UUID) ([]*TempoTemplateDTO, error) {
	items, err := s.repo.ListByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	out := make([]*TempoTemplateDTO, 0, len(items))
	for _, t := range items {
		out = append(out, toTempoTemplateDTO(t))
	}
	return out, nil
}

func (s *BillingTempoTemplateService) Create(ctx context.Context, tenantID uuid.UUID, req *CreateTempoTemplateRequest) (*TempoTemplateDTO, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, ErrTempoTemplateNameRequired
	}
	if req.DueDay < 1 || req.DueDay > 31 {
		return nil, ErrTempoTemplateDueDayInvalid
	}
	exists, err := s.repo.NameExists(ctx, tenantID, name, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, repository.ErrTempoTemplateNameTaken
	}

	now := time.Now()
	t := &billing.TempoTemplate{
		ID:          uuid.New(),
		TenantID:    tenantID,
		Name:        name,
		DueDay:      req.DueDay,
		Description: req.Description,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.Create(ctx, t); err != nil {
		return nil, err
	}
	return toTempoTemplateDTO(t), nil
}

func (s *BillingTempoTemplateService) Update(ctx context.Context, tenantID, id uuid.UUID, req *UpdateTempoTemplateRequest) (*TempoTemplateDTO, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, ErrTempoTemplateNameRequired
	}
	if req.DueDay < 1 || req.DueDay > 31 {
		return nil, ErrTempoTemplateDueDayInvalid
	}

	exists, err := s.repo.NameExists(ctx, tenantID, name, &id)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, repository.ErrTempoTemplateNameTaken
	}

	t := &billing.TempoTemplate{
		ID:          id,
		TenantID:    tenantID,
		Name:        name,
		DueDay:      req.DueDay,
		Description: req.Description,
		UpdatedAt:   time.Now(),
	}
	if err := s.repo.Update(ctx, t); err != nil {
		return nil, err
	}
	return toTempoTemplateDTO(t), nil
}

func (s *BillingTempoTemplateService) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func toTempoTemplateDTO(t *billing.TempoTemplate) *TempoTemplateDTO {
	return &TempoTemplateDTO{
		ID:          t.ID,
		Name:        t.Name,
		DueDay:      t.DueDay,
		Description: t.Description,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}
}


