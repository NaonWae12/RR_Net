package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/domain/client"
	"rrnet/internal/repository"
	"rrnet/pkg/utils"
)

var (
	ErrClientCodeRequired  = errors.New("client code is required")
	ErrClientNameRequired  = errors.New("client name is required")
	ErrClientLimitExceeded = errors.New("client limit exceeded for this plan")
	ErrInvalidStatusChange = errors.New("invalid status change")
)

// ClientService handles client business logic
type ClientService struct {
	clientRepo         *repository.ClientRepository
	servicePackageRepo *repository.ServicePackageRepository
	pppoeService       *PPPoEService
	voucherService     *VoucherService
	featureResolver    *FeatureResolver
	limitResolver      *LimitResolver
	encKey32           [32]byte
}

// NewClientService creates a new client service
func NewClientService(
	clientRepo *repository.ClientRepository,
	servicePackageRepo *repository.ServicePackageRepository,
	pppoeService *PPPoEService,
	voucherService *VoucherService,
	featureResolver *FeatureResolver,
	limitResolver *LimitResolver,
	encryptionSecret string,
) *ClientService {
	return &ClientService{
		clientRepo:         clientRepo,
		servicePackageRepo: servicePackageRepo,
		pppoeService:       pppoeService,
		voucherService:     voucherService,
		featureResolver:    featureResolver,
		limitResolver:      limitResolver,
		encKey32:           utils.DeriveKey32(encryptionSecret),
	}
}

// CreateClientRequest represents request to create a client
type CreateClientRequest struct {
	ClientCode string     `json:"client_code"`
	Name       string     `json:"name"`
	Email      *string    `json:"email,omitempty"`
	Phone      *string    `json:"phone,omitempty"`
	Address    *string    `json:"address,omitempty"`
	Latitude   *float64   `json:"latitude,omitempty"`
	Longitude  *float64   `json:"longitude,omitempty"`
	GroupID    *uuid.UUID `json:"group_id,omitempty"`

	// New service model
	Category           client.Category       `json:"category"`
	ConnectionType     client.ConnectionType `json:"connection_type"`
	RouterID           *uuid.UUID            `json:"router_id,omitempty"`
	PPPoEUsername      *string               `json:"pppoe_username,omitempty"`
	PPPoEPassword      *string               `json:"pppoe_password,omitempty"` // never returned back
	PPPoELocalAddress  *string               `json:"pppoe_local_address,omitempty"`
	PPPoERemoteAddress *string               `json:"pppoe_remote_address,omitempty"`
	PPPoEComment       *string               `json:"pppoe_comment,omitempty"`
	ServicePackageID   uuid.UUID             `json:"service_package_id"`
	VoucherPackageID   *uuid.UUID            `json:"voucher_package_id,omitempty"`
	DeviceCount        *int                  `json:"device_count,omitempty"` // lite only

	// Deprecated (kept for backward compatibility; not used by new UI)
	ServicePlan  *string  `json:"service_plan,omitempty"`
	SpeedProfile *string  `json:"speed_profile,omitempty"`
	MonthlyFee   *float64 `json:"monthly_fee,omitempty"`
	BillingDate  *int     `json:"billing_date,omitempty"`

	// Payment tempo (new)
	PaymentTempoOption     *string    `json:"payment_tempo_option,omitempty"` // default|template|manual
	PaymentDueDay          *int       `json:"payment_due_day,omitempty"`      // 1-31
	PaymentTempoTemplateID *uuid.UUID `json:"payment_tempo_template_id,omitempty"`
}

// ClientDTO represents client data for API responses
type ClientDTO struct {
	ID                     uuid.UUID             `json:"id"`
	TenantID               uuid.UUID             `json:"tenant_id"`
	ClientCode             string                `json:"client_code"`
	Name                   string                `json:"name"`
	Email                  *string               `json:"email,omitempty"`
	Phone                  *string               `json:"phone,omitempty"`
	Address                *string               `json:"address,omitempty"`
	Latitude               *float64              `json:"latitude,omitempty"`
	Longitude              *float64              `json:"longitude,omitempty"`
	GroupID                *uuid.UUID            `json:"group_id,omitempty"`
	Category               client.Category       `json:"category"`
	ConnectionType         client.ConnectionType `json:"connection_type"`
	ServicePackageID       *uuid.UUID            `json:"service_package_id,omitempty"`
	VoucherPackageID       *uuid.UUID            `json:"voucher_package_id,omitempty"`
	DeviceCount            *int                  `json:"device_count,omitempty"`
	ServicePlan            *string               `json:"service_plan,omitempty"`
	SpeedProfile           *string               `json:"speed_profile,omitempty"`
	MonthlyFee             float64               `json:"monthly_fee"`
	BillingDate            *int                  `json:"billing_date,omitempty"`
	PaymentTempoOption     string                `json:"payment_tempo_option"`
	PaymentDueDay          int                   `json:"payment_due_day"`
	PaymentTempoTemplateID *uuid.UUID            `json:"payment_tempo_template_id,omitempty"`
	Status                 client.Status         `json:"status"`
	IsolirReason           *string               `json:"isolir_reason,omitempty"`
	IsolirAt               *time.Time            `json:"isolir_at,omitempty"`
	RouterID               *uuid.UUID            `json:"router_id,omitempty"`
	PPPoEUsername          *string               `json:"pppoe_username,omitempty"`
	PPPoELocalAddress      *string               `json:"pppoe_local_address,omitempty"`
	PPPoERemoteAddress     *string               `json:"pppoe_remote_address,omitempty"`
	PPPoEComment           *string               `json:"pppoe_comment,omitempty"`
	CreatedAt              time.Time             `json:"created_at"`
	UpdatedAt              time.Time             `json:"updated_at"`
}

// Create creates a new client
func (s *ClientService) Create(ctx context.Context, tenantID uuid.UUID, req *CreateClientRequest) (*ClientDTO, error) {
	// Check feature availability
	if !s.featureResolver.Has(ctx, tenantID, "client_management") {
		// Allow basic client management for all plans
	}

	// Check limit
	currentCount, err := s.clientRepo.CountByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if !s.limitResolver.CanAdd(ctx, tenantID, "max_clients", currentCount, 1) {
		return nil, ErrClientLimitExceeded
	}

	// Validate
	req.ClientCode = strings.TrimSpace(req.ClientCode)
	if req.ClientCode == "" {
		code, err := s.generateUniqueClientCode(ctx, tenantID)
		if err != nil {
			return nil, err
		}
		req.ClientCode = code
	}
	if req.Name == "" {
		return nil, ErrClientNameRequired
	}
	if req.ServicePackageID == (uuid.UUID{}) {
		return nil, errors.New("service_package_id is required")
	}

	// Validate service model rules + load package
	pkg, err := s.servicePackageRepo.GetByID(ctx, tenantID, req.ServicePackageID)
	if err != nil {
		if err == repository.ErrServicePackageNotFound {
			return nil, errors.New("service package not found")
		}
		return nil, err
	}
	if client.Category(pkg.Category) != req.Category {
		return nil, errors.New("service package category mismatch")
	}

	var pppoePasswordEnc *string
	var pppoePasswordUpdatedAt *time.Time
	if req.Category == client.CategoryLite {
		if req.DeviceCount == nil || *req.DeviceCount < 1 {
			return nil, errors.New("device_count is required for lite")
		}
		if req.PPPoEUsername != nil && *req.PPPoEUsername != "" {
			return nil, errors.New("pppoe_username is not allowed for lite")
		}
		if req.PPPoEPassword != nil && *req.PPPoEPassword != "" {
			return nil, errors.New("pppoe_password is not allowed for lite")
		}
	} else {
		if req.PPPoEUsername == nil || *req.PPPoEUsername == "" {
			return nil, errors.New("pppoe_username is required")
		}
		if req.PPPoEPassword == nil || *req.PPPoEPassword == "" {
			return nil, errors.New("pppoe_password is required")
		}
		enc, err := utils.EncryptStringAESGCM(s.encKey32, *req.PPPoEPassword)
		if err != nil {
			return nil, err
		}
		pppoePasswordEnc = &enc
		now := time.Now()
		pppoePasswordUpdatedAt = &now
	}

	// Check code uniqueness
	exists, err := s.clientRepo.ClientCodeExists(ctx, tenantID, req.ClientCode, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, repository.ErrClientCodeTaken
	}

	// Create client
	now := time.Now()
	metadata, _ := json.Marshal(map[string]interface{}{})

	// Keep legacy service_plan populated for UI/backward compatibility
	servicePlan := req.ServicePlan
	if servicePlan == nil || *servicePlan == "" {
		servicePlan = &pkg.Name
	}

	// Payment tempo defaults/validation
	paymentOption := "default"
	if req.PaymentTempoOption != nil && strings.TrimSpace(*req.PaymentTempoOption) != "" {
		paymentOption = strings.TrimSpace(*req.PaymentTempoOption)
	}
	if paymentOption != "default" && paymentOption != "template" && paymentOption != "manual" {
		return nil, errors.New("payment_tempo_option must be one of: default, template, manual")
	}

	connType := req.ConnectionType
	if connType == "" {
		connType = client.ConnectionTypePPPoE // Default
	}

	paymentDueDay := now.Day()
	if req.PaymentDueDay != nil {
		if *req.PaymentDueDay < 1 || *req.PaymentDueDay > 31 {
			return nil, errors.New("payment_due_day must be between 1 and 31")
		}
		paymentDueDay = *req.PaymentDueDay
	}
	var paymentTemplateID *uuid.UUID
	if paymentOption == "template" {
		if req.PaymentTempoTemplateID == nil || *req.PaymentTempoTemplateID == uuid.Nil {
			return nil, errors.New("payment_tempo_template_id is required when payment_tempo_option=template")
		}
		paymentTemplateID = req.PaymentTempoTemplateID
	}
	if paymentOption == "manual" {
		// manual means due day is explicitly chosen; enforce presence for clarity
		if req.PaymentDueDay == nil {
			return nil, errors.New("payment_due_day is required when payment_tempo_option=manual")
		}
	}

	c := &client.Client{
		ID:                     uuid.New(),
		TenantID:               tenantID,
		ClientCode:             req.ClientCode,
		Name:                   req.Name,
		Email:                  req.Email,
		Phone:                  req.Phone,
		Address:                req.Address,
		Latitude:               req.Latitude,
		Longitude:              req.Longitude,
		GroupID:                req.GroupID,
		Category:               req.Category,
		ConnectionType:         connType,
		RouterID:               req.RouterID,
		PPPoEUsername:          req.PPPoEUsername,
		PPPoELocalAddress:      req.PPPoELocalAddress,
		PPPoERemoteAddress:     req.PPPoERemoteAddress,
		PPPoEComment:           req.PPPoEComment,
		ServicePackageID:       &req.ServicePackageID,
		VoucherPackageID:       req.VoucherPackageID,
		DeviceCount:            req.DeviceCount,
		PPPoEPasswordEnc:       pppoePasswordEnc,
		PPPoEPasswordUpdatedAt: pppoePasswordUpdatedAt,
		ServicePlan:            servicePlan,
		SpeedProfile:           req.SpeedProfile,
		MonthlyFee:             utils.Value(req.MonthlyFee),
		BillingDate:            req.BillingDate,
		PaymentTempoOption:     paymentOption,
		PaymentDueDay:          paymentDueDay,
		PaymentTempoTemplateID: paymentTemplateID,
		Status:                 client.StatusActive,
		Metadata:               metadata,
		CreatedAt:              now,
		UpdatedAt:              now,
	}

	if err := s.clientRepo.Create(ctx, c); err != nil {
		return nil, err
	}

	// Create PPPoE secret if connection type is pppoe
	if c.ConnectionType == client.ConnectionTypePPPoE && c.RouterID != nil && c.PPPoEUsername != nil && req.PPPoEPassword != nil && c.ServicePackageID != nil {
		pkg, err := s.servicePackageRepo.GetByID(ctx, tenantID, *c.ServicePackageID)
		if err == nil {
			pppoeReq := CreatePPPoESecretRequest{
				ClientID:      c.ID,
				RouterID:      *c.RouterID,
				ProfileID:     pkg.NetworkProfileID,
				Username:      *c.PPPoEUsername,
				Password:      *req.PPPoEPassword,
				LocalAddress:  utils.Value(c.PPPoELocalAddress),
				RemoteAddress: utils.Value(c.PPPoERemoteAddress),
				Comment:       utils.Value(c.PPPoEComment),
			}
			_, pppoeErr := s.pppoeService.CreatePPPoESecret(ctx, tenantID, pppoeReq)
			if pppoeErr != nil {
				log.Error().Err(pppoeErr).Msg("Failed to auto-create PPPoE secret during client creation")
			}
		}
	}

	// Create Hotspot voucher if connection type is hotspot
	if c.ConnectionType == client.ConnectionTypeHotspot && c.VoucherPackageID != nil && c.PPPoEUsername != nil && req.PPPoEPassword != nil {
		voucherReq := CreateVoucherRequest{
			PackageID: *c.VoucherPackageID,
			RouterID:  c.RouterID,
			Code:      *c.PPPoEUsername,
			Password:  *req.PPPoEPassword,
			Notes:     fmt.Sprintf("Client: %s (%s)", c.Name, c.ClientCode),
		}
		_, voucherErr := s.voucherService.CreateVoucher(ctx, tenantID, voucherReq)
		if voucherErr != nil {
			log.Error().Err(voucherErr).Msg("Failed to auto-create Hotspot voucher during client creation")
		}
	}

	return s.toDTO(c), nil
}

func (s *ClientService) generateUniqueClientCode(ctx context.Context, tenantID uuid.UUID) (string, error) {
	// Format: CYYMMDD-XXXXXXXX (hex), e.g. C260104-1A2B3C4D
	// Keep it short, URL-safe, and searchable.
	for i := 0; i < 20; i++ {
		b := make([]byte, 4)
		if _, err := rand.Read(b); err != nil {
			return "", err
		}
		code := "C" + time.Now().Format("060102") + "-" + strings.ToUpper(hex.EncodeToString(b))

		exists, err := s.clientRepo.ClientCodeExists(ctx, tenantID, code, nil)
		if err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	return "", errors.New("failed to generate unique client code")
}

// GetByID retrieves a client by ID
func (s *ClientService) GetByID(ctx context.Context, tenantID, clientID uuid.UUID) (*ClientDTO, error) {
	c, err := s.clientRepo.GetByID(ctx, tenantID, clientID)
	if err != nil {
		return nil, err
	}
	return s.toDTO(c), nil
}

// List retrieves clients with filters
func (s *ClientService) List(ctx context.Context, tenantID uuid.UUID, filter *client.ClientListFilter) ([]*ClientDTO, int, error) {
	clients, total, err := s.clientRepo.List(ctx, tenantID, filter)
	if err != nil {
		return nil, 0, err
	}

	dtos := make([]*ClientDTO, len(clients))
	for i, c := range clients {
		dtos[i] = s.toDTO(c)
	}
	return dtos, total, nil
}

// UpdateClientRequest represents request to update a client
type UpdateClientRequest struct {
	Name      string     `json:"name"`
	Email     *string    `json:"email,omitempty"`
	Phone     *string    `json:"phone,omitempty"`
	Address   *string    `json:"address,omitempty"`
	Latitude  *float64   `json:"latitude,omitempty"`
	Longitude *float64   `json:"longitude,omitempty"`
	GroupID   *uuid.UUID `json:"group_id,omitempty"`

	// New service model
	Category           client.Category       `json:"category"`
	ConnectionType     client.ConnectionType `json:"connection_type"`
	RouterID           *uuid.UUID            `json:"router_id,omitempty"`
	PPPoEUsername      *string               `json:"pppoe_username,omitempty"`
	PPPoEPassword      *string               `json:"pppoe_password,omitempty"`
	PPPoELocalAddress  *string               `json:"pppoe_local_address,omitempty"`
	PPPoERemoteAddress *string               `json:"pppoe_remote_address,omitempty"`
	PPPoEComment       *string               `json:"pppoe_comment,omitempty"`
	ServicePackageID   uuid.UUID             `json:"service_package_id"`
	VoucherPackageID   *uuid.UUID            `json:"voucher_package_id,omitempty"`
	DeviceCount        *int                  `json:"device_count,omitempty"`

	// Deprecated (kept only for compatibility; not used by new UI)
	ServicePlan  *string `json:"service_plan,omitempty"`
	SpeedProfile *string `json:"speed_profile,omitempty"`

	// Payment tempo (new)
	PaymentTempoOption     *string    `json:"payment_tempo_option,omitempty"`
	PaymentDueDay          *int       `json:"payment_due_day,omitempty"`
	PaymentTempoTemplateID *uuid.UUID `json:"payment_tempo_template_id,omitempty"`
}

// Update updates a client
func (s *ClientService) Update(ctx context.Context, tenantID, clientID uuid.UUID, req *UpdateClientRequest) (*ClientDTO, error) {
	// Get existing client
	c, err := s.clientRepo.GetByID(ctx, tenantID, clientID)
	if err != nil {
		return nil, err
	}

	// Update fields
	if req.Name != "" {
		c.Name = req.Name
	}
	c.Email = req.Email
	c.Phone = req.Phone
	c.Address = req.Address
	c.Latitude = req.Latitude
	c.Longitude = req.Longitude
	c.GroupID = req.GroupID

	// Payment tempo (optional update)
	if req.PaymentTempoOption != nil && strings.TrimSpace(*req.PaymentTempoOption) != "" {
		opt := strings.TrimSpace(*req.PaymentTempoOption)
		if opt != "default" && opt != "template" && opt != "manual" {
			return nil, errors.New("payment_tempo_option must be one of: default, template, manual")
		}
		c.PaymentTempoOption = opt
		// Reset template id when option changes away from template
		if opt != "template" {
			c.PaymentTempoTemplateID = nil
		}
	}
	if req.PaymentDueDay != nil {
		if *req.PaymentDueDay < 1 || *req.PaymentDueDay > 31 {
			return nil, errors.New("payment_due_day must be between 1 and 31")
		}
		c.PaymentDueDay = *req.PaymentDueDay
	}
	if c.PaymentTempoOption == "template" {
		if req.PaymentTempoTemplateID != nil && *req.PaymentTempoTemplateID != uuid.Nil {
			c.PaymentTempoTemplateID = req.PaymentTempoTemplateID
		}
		if c.PaymentTempoTemplateID == nil || *c.PaymentTempoTemplateID == uuid.Nil {
			return nil, errors.New("payment_tempo_template_id is required when payment_tempo_option=template")
		}
	}

	if req.ServicePackageID == (uuid.UUID{}) {
		return nil, errors.New("service_package_id is required")
	}
	pkg, err := s.servicePackageRepo.GetByID(ctx, tenantID, req.ServicePackageID)
	if err != nil {
		if err == repository.ErrServicePackageNotFound {
			return nil, errors.New("service package not found")
		}
		return nil, err
	}
	if client.Category(pkg.Category) != req.Category {
		return nil, errors.New("service package category mismatch")
	}

	c.Category = req.Category
	if req.ConnectionType != "" {
		c.ConnectionType = req.ConnectionType
	}
	c.RouterID = req.RouterID
	c.PPPoELocalAddress = req.PPPoELocalAddress
	c.PPPoERemoteAddress = req.PPPoERemoteAddress
	c.PPPoEComment = req.PPPoEComment
	c.ServicePackageID = &req.ServicePackageID
	c.VoucherPackageID = req.VoucherPackageID
	c.DeviceCount = req.DeviceCount
	c.PPPoEUsername = req.PPPoEUsername

	if req.Category == client.CategoryLite {
		if req.DeviceCount == nil || *req.DeviceCount < 1 {
			return nil, errors.New("device_count is required for lite")
		}
		// Clear PPPoE fields for lite
		c.PPPoEUsername = nil
		c.PPPoEPasswordEnc = nil
		c.PPPoEPasswordUpdatedAt = nil
	} else {
		if req.PPPoEUsername == nil || *req.PPPoEUsername == "" {
			return nil, errors.New("pppoe_username is required")
		}
		// Only update password if provided (avoid forcing re-entry on edit)
		if req.PPPoEPassword != nil && *req.PPPoEPassword != "" {
			enc, err := utils.EncryptStringAESGCM(s.encKey32, *req.PPPoEPassword)
			if err != nil {
				return nil, err
			}
			c.PPPoEPasswordEnc = &enc
			now := time.Now()
			c.PPPoEPasswordUpdatedAt = &now
		}
	}

	// Keep legacy service_plan populated for UI/backward compatibility
	servicePlan := req.ServicePlan
	if servicePlan == nil || *servicePlan == "" {
		servicePlan = &pkg.Name
	}
	c.ServicePlan = servicePlan
	c.SpeedProfile = req.SpeedProfile

	if err := s.clientRepo.Update(ctx, c); err != nil {
		return nil, err
	}

	return s.toDTO(c), nil
}

// ChangeStatusRequest represents request to change client status
type ChangeStatusRequest struct {
	Status client.Status `json:"status"`
	Reason *string       `json:"reason,omitempty"`
}

// ChangeStatus changes client status
func (s *ClientService) ChangeStatus(ctx context.Context, tenantID, clientID uuid.UUID, req *ChangeStatusRequest) (*ClientDTO, error) {
	// Get existing client
	c, err := s.clientRepo.GetByID(ctx, tenantID, clientID)
	if err != nil {
		return nil, err
	}

	// Validate transition
	if !c.CanTransitionTo(req.Status) {
		return nil, ErrInvalidStatusChange
	}

	// Update status
	if err := s.clientRepo.UpdateStatus(ctx, tenantID, clientID, req.Status, req.Reason); err != nil {
		return nil, err
	}

	// Return updated client
	return s.GetByID(ctx, tenantID, clientID)
}

// Delete soft deletes a client
func (s *ClientService) Delete(ctx context.Context, tenantID, clientID uuid.UUID) error {
	return s.clientRepo.SoftDelete(ctx, tenantID, clientID)
}

// GetStats returns client statistics for a tenant
func (s *ClientService) GetStats(ctx context.Context, tenantID uuid.UUID) (map[string]interface{}, error) {
	total, err := s.clientRepo.CountByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	limit := s.limitResolver.Get(ctx, tenantID, "max_clients")
	remaining := s.limitResolver.GetRemaining(ctx, tenantID, "max_clients", total)

	return map[string]interface{}{
		"total":     total,
		"limit":     limit,
		"unlimited": limit == Unlimited,
		"remaining": remaining,
	}, nil
}

// toDTO converts client entity to DTO
func (s *ClientService) toDTO(c *client.Client) *ClientDTO {
	return &ClientDTO{
		ID:                     c.ID,
		TenantID:               c.TenantID,
		ClientCode:             c.ClientCode,
		Name:                   c.Name,
		Email:                  c.Email,
		Phone:                  c.Phone,
		Address:                c.Address,
		Latitude:               c.Latitude,
		Longitude:              c.Longitude,
		GroupID:                c.GroupID,
		Category:               c.Category,
		ConnectionType:         c.ConnectionType,
		ServicePackageID:       c.ServicePackageID,
		VoucherPackageID:       c.VoucherPackageID,
		DeviceCount:            c.DeviceCount,
		ServicePlan:            c.ServicePlan,
		SpeedProfile:           c.SpeedProfile,
		MonthlyFee:             c.MonthlyFee,
		BillingDate:            c.BillingDate,
		PaymentTempoOption:     c.PaymentTempoOption,
		PaymentDueDay:          c.PaymentDueDay,
		PaymentTempoTemplateID: c.PaymentTempoTemplateID,
		Status:                 c.Status,
		IsolirReason:           c.IsolirReason,
		IsolirAt:               c.IsolirAt,
		RouterID:               c.RouterID,
		PPPoEUsername:          c.PPPoEUsername,
		PPPoELocalAddress:      c.PPPoELocalAddress,
		PPPoERemoteAddress:     c.PPPoERemoteAddress,
		PPPoEComment:           c.PPPoEComment,
		CreatedAt:              c.CreatedAt,
		UpdatedAt:              c.UpdatedAt,
	}
}
