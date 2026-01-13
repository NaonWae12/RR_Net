package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"

	"rrnet/internal/domain/wa_template"
	"rrnet/internal/repository"
)

var (
	ErrWATemplateNameRequired    = errors.New("template name is required")
	ErrWATemplateContentRequired = errors.New("template content is required")
)

type WATemplateService struct {
	repo *repository.WATemplateRepository
}

func NewWATemplateService(repo *repository.WATemplateRepository) *WATemplateService {
	return &WATemplateService{repo: repo}
}

func (s *WATemplateService) List(ctx context.Context, tenantID uuid.UUID) ([]*wa_template.Template, error) {
	return s.repo.List(ctx, tenantID, 200)
}

func (s *WATemplateService) Create(ctx context.Context, tenantID uuid.UUID, name, content string) (*wa_template.Template, error) {
	name = strings.TrimSpace(name)
	content = strings.TrimSpace(content)
	if name == "" {
		return nil, ErrWATemplateNameRequired
	}
	if content == "" {
		return nil, ErrWATemplateContentRequired
	}
	return s.repo.Create(ctx, tenantID, name, content)
}

func (s *WATemplateService) Update(ctx context.Context, tenantID, id uuid.UUID, name, content string) (*wa_template.Template, error) {
	name = strings.TrimSpace(name)
	content = strings.TrimSpace(content)
	if name == "" {
		return nil, ErrWATemplateNameRequired
	}
	if content == "" {
		return nil, ErrWATemplateContentRequired
	}
	return s.repo.Update(ctx, tenantID, id, name, content)
}

func (s *WATemplateService) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	return s.repo.Delete(ctx, tenantID, id)
}


