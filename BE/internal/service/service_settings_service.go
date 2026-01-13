package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"rrnet/internal/repository"
)

var (
	ErrDiscountTypeInvalid  = errors.New("invalid discount type")
	ErrDiscountValueInvalid = errors.New("invalid discount value")
)

type ServiceDiscountType string

const (
	ServiceDiscountTypePercent ServiceDiscountType = "percent"
	ServiceDiscountTypeNominal ServiceDiscountType = "nominal"
)

type ServiceDiscountSetting struct {
	Enabled bool               `json:"enabled"`
	Type    ServiceDiscountType `json:"type"`
	Value   float64            `json:"value"`
}

type ServiceSettingsDTO struct {
	ServiceDiscount ServiceDiscountSetting `json:"service_discount"`
}

type ServiceSettingsService struct {
	tenantRepo *repository.TenantRepository
}

func NewServiceSettingsService(tenantRepo *repository.TenantRepository) *ServiceSettingsService {
	return &ServiceSettingsService{tenantRepo: tenantRepo}
}

func (s *ServiceSettingsService) Get(ctx context.Context, tenantID uuid.UUID) (*ServiceSettingsDTO, error) {
	t, err := s.tenantRepo.GetByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &ServiceSettingsDTO{
		ServiceDiscount: readServiceDiscount(t.Settings),
	}, nil
}

func (s *ServiceSettingsService) UpdateDiscount(ctx context.Context, tenantID uuid.UUID, in ServiceDiscountSetting) (*ServiceSettingsDTO, error) {
	if in.Enabled {
		if in.Type != ServiceDiscountTypePercent && in.Type != ServiceDiscountTypeNominal {
			return nil, ErrDiscountTypeInvalid
		}
		if in.Value < 0 {
			return nil, ErrDiscountValueInvalid
		}
		if in.Type == ServiceDiscountTypePercent && in.Value > 100 {
			return nil, ErrDiscountValueInvalid
		}
	}

	t, err := s.tenantRepo.GetByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if t.Settings == nil {
		t.Settings = map[string]interface{}{}
	}
	t.Settings["service_discount"] = map[string]interface{}{
		"enabled": in.Enabled,
		"type":    string(in.Type),
		"value":   in.Value,
	}
	if err := s.tenantRepo.UpdateSettings(ctx, tenantID, t.Settings); err != nil {
		return nil, err
	}
	return &ServiceSettingsDTO{ServiceDiscount: in}, nil
}

func readServiceDiscount(settings map[string]interface{}) ServiceDiscountSetting {
	out := ServiceDiscountSetting{
		Enabled: false,
		Type:    ServiceDiscountTypePercent,
		Value:   0,
	}
	if settings == nil {
		return out
	}
	raw, ok := settings["service_discount"].(map[string]interface{})
	if !ok || raw == nil {
		return out
	}
	if v, ok := raw["enabled"].(bool); ok {
		out.Enabled = v
	}
	if t, ok := raw["type"].(string); ok && t != "" {
		if t == string(ServiceDiscountTypePercent) {
			out.Type = ServiceDiscountTypePercent
		}
		if t == string(ServiceDiscountTypeNominal) {
			out.Type = ServiceDiscountTypeNominal
		}
	}
	if val, ok := raw["value"].(float64); ok {
		out.Value = val
	}
	return out
}


