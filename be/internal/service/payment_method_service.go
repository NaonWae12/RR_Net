package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	paymentmethod "rrnet/internal/domain/payment_method"
	"rrnet/internal/repository"
)

var (
	ErrPaymentMethodNotFound = errors.New("payment method not found")
	ErrInvalidCategory       = errors.New("invalid payment method category")
	ErrPaymentMethodInUse    = errors.New("payment method is in use and cannot be deleted")
)

type PaymentMethodService struct {
	repo *repository.PaymentMethodRepository
}

func NewPaymentMethodService(repo *repository.PaymentMethodRepository) *PaymentMethodService {
	return &PaymentMethodService{repo: repo}
}

type CreatePaymentMethodRequest struct {
	Name          string                 `json:"name"`
	Category      string                 `json:"category"`
	Provider      *string                `json:"provider"`
	AccountNumber *string                `json:"account_number"`
	AccountName   *string                `json:"account_name"`
	IsActive      bool                   `json:"is_active"`
	Metadata      map[string]interface{} `json:"metadata"`
}

type UpdatePaymentMethodRequest struct {
	Name          string                 `json:"name"`
	Category      string                 `json:"category"`
	Provider      *string                `json:"provider"`
	AccountNumber *string                `json:"account_number"`
	AccountName   *string                `json:"account_name"`
	IsActive      bool                   `json:"is_active"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// CreatePaymentMethod creates a new payment method (platform-level for superadmin)
func (s *PaymentMethodService) CreatePaymentMethod(ctx context.Context, req *CreatePaymentMethodRequest) (*paymentmethod.PaymentMethod, error) {
	// Validate category
	category := paymentmethod.Category(req.Category)
	if category != paymentmethod.CategoryBank &&
		category != paymentmethod.CategoryCash &&
		category != paymentmethod.CategoryEWallet &&
		category != paymentmethod.CategoryPayLater {
		return nil, ErrInvalidCategory
	}

	// Marshal metadata
	metadataJSON, err := json.Marshal(req.Metadata)
	if err != nil {
		return nil, err
	}

	pm := &paymentmethod.PaymentMethod{
		ID:            uuid.New(),
		TenantID:      nil, // Platform-level (NULL in DB)
		Name:          req.Name,
		Category:      category,
		Provider:      req.Provider,
		AccountNumber: req.AccountNumber,
		AccountName:   req.AccountName,
		IsActive:      req.IsActive,
		Metadata:      metadataJSON,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := s.repo.Create(ctx, pm); err != nil {
		log.Error().Err(err).Msg("Failed to create payment method")
		return nil, err
	}

	log.Info().Str("id", pm.ID.String()).Str("name", pm.Name).Msg("Payment method created")
	return pm, nil
}

// ListPaymentMethods lists all platform-level payment methods
func (s *PaymentMethodService) ListPaymentMethods(ctx context.Context) ([]*paymentmethod.PaymentMethod, error) {
	return s.repo.ListByTenant(ctx, nil)
}

// GetPaymentMethod retrieves a payment method by ID
func (s *PaymentMethodService) GetPaymentMethod(ctx context.Context, id uuid.UUID) (*paymentmethod.PaymentMethod, error) {
	pm, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, ErrPaymentMethodNotFound
	}
	return pm, nil
}

// UpdatePaymentMethod updates a payment method
func (s *PaymentMethodService) UpdatePaymentMethod(ctx context.Context, id uuid.UUID, req *UpdatePaymentMethodRequest) (*paymentmethod.PaymentMethod, error) {
	// Get existing payment method
	pm, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, ErrPaymentMethodNotFound
	}

	// Validate category
	category := paymentmethod.Category(req.Category)
	if category != paymentmethod.CategoryBank &&
		category != paymentmethod.CategoryCash &&
		category != paymentmethod.CategoryEWallet &&
		category != paymentmethod.CategoryPayLater {
		return nil, ErrInvalidCategory
	}

	// Marshal metadata
	metadataJSON, err := json.Marshal(req.Metadata)
	if err != nil {
		return nil, err
	}

	// Update fields
	pm.Name = req.Name
	pm.Category = category
	pm.Provider = req.Provider
	pm.AccountNumber = req.AccountNumber
	pm.AccountName = req.AccountName
	pm.IsActive = req.IsActive
	pm.Metadata = metadataJSON
	pm.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, pm); err != nil {
		log.Error().Err(err).Msg("Failed to update payment method")
		return nil, err
	}

	log.Info().Str("id", pm.ID.String()).Str("name", pm.Name).Msg("Payment method updated")
	return pm, nil
}

// DeletePaymentMethod deletes a payment method
func (s *PaymentMethodService) DeletePaymentMethod(ctx context.Context, id uuid.UUID) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		log.Error().Err(err).Msg("Failed to delete payment method")
		if err.Error() == "payment method is in use" {
			return ErrPaymentMethodInUse
		}
		return err
	}

	log.Info().Str("id", id.String()).Msg("Payment method deleted")
	return nil
}

// ToggleStatus toggles the active status of a payment method
func (s *PaymentMethodService) ToggleStatus(ctx context.Context, id uuid.UUID) (*paymentmethod.PaymentMethod, error) {
	pm, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, ErrPaymentMethodNotFound
	}

	pm.IsActive = !pm.IsActive
	pm.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, pm); err != nil {
		log.Error().Err(err).Msg("Failed to toggle payment method status")
		return nil, err
	}

	log.Info().Str("id", pm.ID.String()).Bool("is_active", pm.IsActive).Msg("Payment method status toggled")
	return pm, nil
}

// Legacy methods for backward compatibility
func (s *PaymentMethodService) Create(ctx context.Context, tenantID uuid.UUID, pm *paymentmethod.PaymentMethod) error {
	pm.ID = uuid.New()
	pm.TenantID = &tenantID
	pm.IsActive = true
	pm.CreatedAt = time.Now()
	pm.UpdatedAt = time.Now()
	return s.repo.Create(ctx, pm)
}

func (s *PaymentMethodService) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*paymentmethod.PaymentMethod, error) {
	return s.repo.ListByTenant(ctx, &tenantID)
}

func (s *PaymentMethodService) Update(ctx context.Context, pm *paymentmethod.PaymentMethod) error {
	return s.repo.Update(ctx, pm)
}

func (s *PaymentMethodService) Delete(ctx context.Context, id uuid.UUID) error {
	err := s.repo.Delete(ctx, id)
	if err != nil && err.Error() == "payment method is in use" {
		return ErrPaymentMethodInUse
	}
	return err
}
