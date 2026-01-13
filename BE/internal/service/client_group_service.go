package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/client_group"
	"rrnet/internal/repository"
)

var (
	ErrClientGroupNameRequired = errors.New("client group name is required")
)

type ClientGroupService struct {
	repo *repository.ClientGroupRepository
}

func NewClientGroupService(repo *repository.ClientGroupRepository) *ClientGroupService {
	return &ClientGroupService{repo: repo}
}

type CreateClientGroupRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

type UpdateClientGroupRequest = CreateClientGroupRequest

type ClientGroupDTO struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (s *ClientGroupService) List(ctx context.Context, tenantID uuid.UUID) ([]*ClientGroupDTO, error) {
	items, err := s.repo.ListByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	out := make([]*ClientGroupDTO, 0, len(items))
	for _, g := range items {
		out = append(out, toClientGroupDTO(g))
	}
	return out, nil
}

func (s *ClientGroupService) Create(ctx context.Context, tenantID uuid.UUID, req *CreateClientGroupRequest) (*ClientGroupDTO, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, ErrClientGroupNameRequired
	}

	exists, err := s.repo.NameExists(ctx, tenantID, name, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, repository.ErrClientGroupNameTaken
	}

	now := time.Now()
	g := &client_group.ClientGroup{
		ID:          uuid.New(),
		TenantID:    tenantID,
		Name:        name,
		Description: req.Description,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.Create(ctx, g); err != nil {
		return nil, err
	}
	return toClientGroupDTO(g), nil
}

func (s *ClientGroupService) Update(ctx context.Context, tenantID, id uuid.UUID, req *UpdateClientGroupRequest) (*ClientGroupDTO, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, ErrClientGroupNameRequired
	}

	exists, err := s.repo.NameExists(ctx, tenantID, name, &id)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, repository.ErrClientGroupNameTaken
	}

	g := &client_group.ClientGroup{
		ID:          id,
		TenantID:    tenantID,
		Name:        name,
		Description: req.Description,
		UpdatedAt:   time.Now(),
	}
	if err := s.repo.Update(ctx, g); err != nil {
		return nil, err
	}
	return toClientGroupDTO(g), nil
}

func (s *ClientGroupService) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func toClientGroupDTO(g *client_group.ClientGroup) *ClientGroupDTO {
	return &ClientGroupDTO{
		ID:          g.ID,
		Name:        g.Name,
		Description: g.Description,
		CreatedAt:   g.CreatedAt,
		UpdatedAt:   g.UpdatedAt,
	}
}


