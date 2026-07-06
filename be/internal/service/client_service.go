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

	"rrnet/internal/auth"
	"rrnet/internal/domain/client"
	"rrnet/internal/domain/discount"
	"rrnet/internal/domain/service_package"
	"rrnet/internal/domain/user"
	"rrnet/internal/repository"
	"rrnet/pkg/utils"
)

var (
	ErrClientCodeRequired     = errors.New("client code is required")
	ErrClientNameRequired     = errors.New("client name is required")
	ErrClientLimitExceeded    = errors.New("client limit exceeded for this plan")
	ErrInvalidStatusChange    = errors.New("invalid status change")
	ErrServicePackageRequired = errors.New("service_package_id is required")
	ErrVoucherPackageRequired = errors.New("voucher_package_id is required for hotspot connection")
	ErrServicePackageNotFound = errors.New("service package not found")
	ErrCategoryMismatch       = errors.New("service package category mismatch")
	ErrDeviceCountRequired    = errors.New("device_count is required for lite")
)

// ClientService handles client business logic
type ClientService struct {
	clientRepo         *repository.ClientRepository
	servicePackageRepo *repository.ServicePackageRepository
	pppoeService       *PPPoEService
	voucherService     *VoucherService
	featureResolver    *FeatureResolver
	limitResolver      *LimitResolver
	userRepo           *repository.UserRepository
	routerRepo         *repository.RouterRepository
	billingService     *BillingService
	discountRepo       *repository.DiscountRepository
	encKey32           [32]byte
}

// NewClientService creates a new client service
func NewClientService(
	clientRepo *repository.ClientRepository,
	servicePackageRepo *repository.ServicePackageRepository,
	pppoeService *PPPoEService,
	voucherService *VoucherService,
	billingService *BillingService,
	featureResolver *FeatureResolver,
	limitResolver *LimitResolver,
	userRepo *repository.UserRepository,
	routerRepo *repository.RouterRepository,
	discountRepo *repository.DiscountRepository,
	encryptionSecret string,
) *ClientService {
	return &ClientService{
		clientRepo:         clientRepo,
		servicePackageRepo: servicePackageRepo,
		pppoeService:       pppoeService,
		voucherService:     voucherService,
		featureResolver:    featureResolver,
		limitResolver:      limitResolver,
		userRepo:           userRepo,
		routerRepo:         routerRepo,
		billingService:     billingService,
		discountRepo:       discountRepo,
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
	DiscountID *uuid.UUID `json:"discount_id,omitempty"`

	// New service model
	Category           client.Category       `json:"category"`
	ConnectionType     client.ConnectionType `json:"connection_type"`
	RouterID           *uuid.UUID            `json:"router_id,omitempty"`
	PPPoEUsername      *string               `json:"pppoe_username,omitempty"`
	PPPoEPassword      *string               `json:"pppoe_password,omitempty"` // never returned back
	PPPoELocalAddress  *string               `json:"pppoe_local_address,omitempty"`
	PPPoERemoteAddress *string               `json:"pppoe_remote_address,omitempty"`
	PPPoEComment       *string               `json:"pppoe_comment,omitempty"`
	ServicePackageID   *uuid.UUID            `json:"service_package_id"`
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

	// Toggle for auto-invoice creation
	AutoCreateInvoice *bool `json:"auto_create_invoice,omitempty"`
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
	DiscountID             *uuid.UUID            `json:"discount_id,omitempty"`
	DiscountType           *string               `json:"discount_type,omitempty"`
	DiscountValue          *float64              `json:"discount_value,omitempty"`
	Category               client.Category       `json:"category"`
	ConnectionType         client.ConnectionType `json:"connection_type"`
	ServicePackageID       *uuid.UUID            `json:"service_package_id,omitempty"`
	VoucherPackageID       *uuid.UUID            `json:"voucher_package_id,omitempty"`
	DeviceCount            *int                  `json:"device_count,omitempty"`
	PackageName            *string               `json:"package_name,omitempty"`
	ServicePlan            *string               `json:"service_plan,omitempty"`
	SpeedProfile           *string               `json:"speed_profile,omitempty"`
	MonthlyFee             float64               `json:"monthly_fee"`
	BillingDate            *int                  `json:"billing_date,omitempty"`
	PaymentTempoOption     string                `json:"payment_tempo_option"`
	PaymentDueDay          int                   `json:"payment_due_day"`
	PaymentTempoTemplateID *uuid.UUID            `json:"payment_tempo_template_id,omitempty"`
	Status                 client.Status         `json:"status"`
	PaymentStatus          string                `json:"payment_status,omitempty"`
	IsolirReason           *string               `json:"isolir_reason,omitempty"`
	IsolirAt               *time.Time            `json:"isolir_at,omitempty"`
	RouterID               *uuid.UUID            `json:"router_id,omitempty"`
	RouterName             *string               `json:"router_name,omitempty"`
	PPPoEUsername          *string               `json:"pppoe_username,omitempty"`
	PPPoEPassword          *string               `json:"pppoe_password,omitempty"`
	PPPoELocalAddress      *string               `json:"pppoe_local_address,omitempty"`
	PPPoERemoteAddress     *string               `json:"pppoe_remote_address,omitempty"`
	PPPoEComment           *string               `json:"pppoe_comment,omitempty"`
	CreatedAt              time.Time             `json:"created_at"`
	UpdatedAt              time.Time             `json:"updated_at"`
	PaymentDueDate         *time.Time            `json:"payment_due_date,omitempty"`
	CreatedByName          *string               `json:"created_by_name,omitempty"`
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
	// Validate service model rules + load package
	isHotspot := req.ConnectionType == client.ConnectionTypeHotspot
	isNone := req.ConnectionType == client.ConnectionTypeNone
	var pkg *service_package.ServicePackage

	if isNone {
		// No service package or voucher package required for connection_type none
	} else if isHotspot {
		if req.VoucherPackageID == nil || *req.VoucherPackageID == uuid.Nil {
			return nil, errors.New("voucher_package_id is required for hotspot connection")
		}
		// ServicePackageID is optional for hotspot
	} else {
		if req.ServicePackageID == nil || *req.ServicePackageID == uuid.Nil {
			return nil, errors.New("service_package_id is required")
		}
		var err error
		pkg, err = s.servicePackageRepo.GetByID(ctx, tenantID, *req.ServicePackageID)
		if err != nil {
			if err == repository.ErrServicePackageNotFound {
				return nil, errors.New("service package not found")
			}
			return nil, err
		}
		if client.Category(pkg.Category) != req.Category {
			return nil, errors.New("service package category mismatch")
		}
	}

	var pppoePasswordEnc *string
	var pppoePasswordUpdatedAt *time.Time
	if isNone {
		// PPPoE credentials not required for connection_type none
	} else if req.Category == client.CategoryLite {
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
	monthlyFee := utils.Value(req.MonthlyFee)

	if isHotspot {
		vpkg, err := s.voucherService.GetPackage(ctx, *req.VoucherPackageID)
		if err == nil {
			if servicePlan == nil || *servicePlan == "" {
				servicePlan = &vpkg.Name
			}
			if monthlyFee <= 0 {
				deviceCount := 1
				if req.DeviceCount != nil && *req.DeviceCount > 0 {
					deviceCount = *req.DeviceCount
				}
				monthlyFee = vpkg.Price * float64(deviceCount)
			}
		}
	} else if pkg != nil {
		if servicePlan == nil || *servicePlan == "" {
			servicePlan = &pkg.Name
		}
		if monthlyFee <= 0 {
			if pkg.PricingModel == service_package.PricingModelFlatMonthly {
				monthlyFee = pkg.PriceMonthly
			} else if pkg.PricingModel == service_package.PricingModelPerDevice && req.DeviceCount != nil {
				monthlyFee = pkg.PricePerDevice * float64(*req.DeviceCount)
			}
		}
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

	initialStatus := client.StatusActive
	var createdByID *uuid.UUID
	if role, ok := auth.GetRole(ctx); ok && role == "technician" {
		initialStatus = client.StatusPending
	}
	if uid, ok := auth.GetUserID(ctx); ok {
		createdByID = &uid
	}

	c := &client.Client{
		ID:                 uuid.New(),
		TenantID:           tenantID,
		CreatedByID:        createdByID,
		ClientCode:         req.ClientCode,
		Name:               req.Name,
		Email:              req.Email,
		Phone:              req.Phone,
		Address:            req.Address,
		Latitude:           req.Latitude,
		Longitude:          req.Longitude,
		GroupID:            req.GroupID,
		DiscountID:         req.DiscountID,
		Category:           req.Category,
		ConnectionType:     connType,
		RouterID:           req.RouterID,
		PPPoEUsername:      req.PPPoEUsername,
		PPPoELocalAddress:  req.PPPoELocalAddress,
		PPPoERemoteAddress: req.PPPoERemoteAddress,
		PPPoEComment:       req.PPPoEComment,
		ServicePackageID: func() *uuid.UUID {
			if isHotspot || isNone {
				return nil
			}
			return req.ServicePackageID
		}(),
		VoucherPackageID: func() *uuid.UUID {
			if isNone {
				return nil
			}
			return req.VoucherPackageID
		}(),
		DeviceCount:            req.DeviceCount,
		PPPoEPasswordEnc:       pppoePasswordEnc,
		PPPoEPasswordUpdatedAt: pppoePasswordUpdatedAt,
		ServicePlan:            servicePlan,
		SpeedProfile:           req.SpeedProfile,
		MonthlyFee:             monthlyFee,
		BillingDate:            req.BillingDate,
		PaymentTempoOption:     paymentOption,
		PaymentDueDay:          paymentDueDay,
		PaymentTempoTemplateID: paymentTemplateID,
		Status:                 initialStatus,
		Metadata:               metadata,
		CreatedAt:              now,
		UpdatedAt:              now,
	}

	// SECURITY: Auto-Create User account for Client Login (Fast DB operation, keep synchronous)
	if req.Email != nil && *req.Email != "" {
		// Check if user already exists
		existingUser, _ := s.userRepo.GetByEmail(ctx, &tenantID, *req.Email)
		if existingUser != nil {
			c.UserID = &existingUser.ID
		} else {
			// Create new user record
			role, err := s.userRepo.GetRoleByCode(ctx, "client")
			if err == nil {
				// Use "password" as default
				hash, err := auth.HashPassword("password")
				if err == nil {
					newUserID := uuid.New()
					u := &user.User{
						ID:           newUserID,
						TenantID:     &tenantID,
						RoleID:       role.ID,
						Email:        *req.Email,
						PasswordHash: hash,
						Name:         req.Name,
						Phone:        req.Phone,
						Status:       "active",
						CreatedAt:    now,
						UpdatedAt:    now,
					}
					if err := s.userRepo.Create(ctx, u); err == nil {
						c.UserID = &newUserID
					} else {
						log.Error().Err(err).Msg("Failed to auto-create user for client")
					}
				}
			}
		}
	}

	if err := s.clientRepo.Create(ctx, c); err != nil {
		return nil, err
	}

	// PERFORM SLOW OPERATIONS IN BACKGROUND
	// Moving MikroTik sync and Voucher creation to background to prevent frontend timeouts.
	// These operations connect to external routers which can be slow or unreachable.
	go func(cInternal *client.Client, reqInternal *CreateClientRequest, tID uuid.UUID) {
		// Use background context with a generous timeout to ensure it finishes even if request context is cancelled
		bgCtx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		// Do not auto-provision on router if client is pending approval
		if cInternal.Status == client.StatusPending {
			return
		}

		// Create PPPoE secret if connection type is pppoe
		if cInternal.ConnectionType == client.ConnectionTypePPPoE && cInternal.RouterID != nil && cInternal.PPPoEUsername != nil && reqInternal.PPPoEPassword != nil && cInternal.ServicePackageID != nil {
			pkg, err := s.servicePackageRepo.GetByID(bgCtx, tID, *cInternal.ServicePackageID)
			if err == nil {
				pppoeReq := CreatePPPoESecretRequest{
					ClientID:      cInternal.ID,
					RouterID:      *cInternal.RouterID,
					ProfileID:     pkg.NetworkProfileID,
					Username:      *cInternal.PPPoEUsername,
					Password:      *reqInternal.PPPoEPassword,
					LocalAddress:  utils.Value(cInternal.PPPoELocalAddress),
					RemoteAddress: utils.Value(cInternal.PPPoERemoteAddress),
					Comment:       utils.Value(cInternal.PPPoEComment),
				}
				_, pppoeErr := s.pppoeService.CreatePPPoESecret(bgCtx, tID, pppoeReq)
				if pppoeErr != nil {
					log.Error().Err(pppoeErr).Msg("Background Process: Failed to auto-create PPPoE secret during client creation")
				}
			}
		}

		// Create Hotspot voucher if connection type is hotspot
		if cInternal.ConnectionType == client.ConnectionTypeHotspot && cInternal.VoucherPackageID != nil && cInternal.PPPoEUsername != nil && reqInternal.PPPoEPassword != nil {
			voucherReq := CreateVoucherRequest{
				PackageID:   *cInternal.VoucherPackageID,
				RouterID:    cInternal.RouterID,
				Code:        *cInternal.PPPoEUsername,
				Password:    *reqInternal.PPPoEPassword,
				Notes:       fmt.Sprintf("Client: %s (%s)", cInternal.Name, cInternal.ClientCode),
				SharedUsers: utils.Value(cInternal.DeviceCount),
			}
			_, voucherErr := s.voucherService.CreateVoucher(bgCtx, tID, voucherReq)
			if voucherErr != nil {
				log.Error().Err(voucherErr).Msg("Background Process: Failed to auto-create Hotspot voucher during client creation")
			}
		}

		// Auto-Generate First Invoice if requested
		if reqInternal.AutoCreateInvoice != nil && *reqInternal.AutoCreateInvoice {
			_, invErr := s.billingService.GenerateMonthlyInvoice(bgCtx, tID, cInternal.ID)
			if invErr != nil {
				log.Error().Err(invErr).Msg("Background Process: Failed to auto-generate first invoice during client creation")
			} else {
				log.Info().Str("client_id", cInternal.ID.String()).Msg("Background Process: Auto-generated first invoice for new client")
			}
		}
	}(c, req, tenantID)

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
	dto := s.toDTO(c)

	// If Hotspot, fetch active voucher to populate username/password/device_count
	if c.ConnectionType == client.ConnectionTypeHotspot && c.PPPoEUsername != nil {
		v, err := s.voucherService.GetVoucherByCode(ctx, tenantID, *c.PPPoEUsername)
		if err == nil && v != nil {
			dto.PPPoEPassword = &v.Password
			dto.DeviceCount = &v.SharedUsers
			// If voucher has specific router, reflect it
			if v.RouterID != nil {
				dto.RouterID = v.RouterID
			}
		}
	}
	if c.RouterID != nil {
		r, err := s.routerRepo.GetByID(ctx, *c.RouterID)
		if err == nil {
			dto.RouterName = &r.Name
		}
	}

	// NEW: Fetch Discount Details if available
	if c.DiscountID != nil {
		d, err := s.discountRepo.GetByID(ctx, *c.DiscountID, tenantID)
		if err == nil {
			t := string(d.Type)
			dto.DiscountType = &t
			dto.DiscountValue = &d.Value
		}
	}

	// Fetch Payment Status & Due Date
	paymentStatuses, err := s.billingService.GetClientPaymentStatuses(ctx, tenantID, []uuid.UUID{clientID})
	if err == nil {
		if status, ok := paymentStatuses[clientID]; ok {
			dto.PaymentStatus = status
		} else {
			dto.PaymentStatus = "paid"
		}
	}

	dueDates, err := s.billingService.GetClientDueDates(ctx, tenantID, []uuid.UUID{clientID})
	if err == nil {
		if dueDate, ok := dueDates[clientID]; ok {
			dto.PaymentDueDate = &dueDate
		}
	}

	// Fetch Creator Name
	if c.CreatedByID != nil {
		u, err := s.userRepo.GetByID(ctx, *c.CreatedByID)
		if err == nil {
			dto.CreatedByName = &u.Name
		}
	}

	return dto, nil
}

// List retrieves clients with filters
func (s *ClientService) List(ctx context.Context, tenantID uuid.UUID, filter *client.ClientListFilter) ([]*ClientDTO, int, error) {
	clients, total, err := s.clientRepo.List(ctx, tenantID, filter)
	if err != nil {
		return nil, 0, err
	}

	// Collect IDs for bulk fetching payment status
	clientIDs := make([]uuid.UUID, len(clients))
	for i, c := range clients {
		clientIDs[i] = c.ID
	}

	paymentStatuses, err := s.billingService.GetClientPaymentStatuses(ctx, tenantID, clientIDs)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch payment statuses")
	}

	dueDates, err := s.billingService.GetClientDueDates(ctx, tenantID, clientIDs)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch payment due dates")
	}

	// Fetch all discounts for this tenant to populate DTOs efficiently
	discounts, _ := s.discountRepo.List(ctx, tenantID, true)
	discountMap := make(map[uuid.UUID]*discount.Discount)
	for _, d := range discounts {
		discountMap[d.ID] = d
	}

	dtos := make([]*ClientDTO, len(clients))
	for i, c := range clients {
		dtos[i] = s.toDTO(c)
		// Populate discount details if client has a discount
		if c.DiscountID != nil {
			if d, ok := discountMap[*c.DiscountID]; ok {
				t := string(d.Type)
				dtos[i].DiscountType = &t
				dtos[i].DiscountValue = &d.Value
			}
		}

		// Populate payment status
		if paymentStatuses != nil {
			if status, ok := paymentStatuses[c.ID]; ok {
				dtos[i].PaymentStatus = status
			} else {
				dtos[i].PaymentStatus = "paid"
			}
		}

		// Populate due date
		if dueDates != nil {
			if dueDate, ok := dueDates[c.ID]; ok {
				dtos[i].PaymentDueDate = &dueDate
			}
		}
	}
	return dtos, total, nil
}

// UpdateClientRequest represents request to update a client
type UpdateClientRequest struct {
	Name       string     `json:"name"`
	Email      *string    `json:"email,omitempty"`
	Phone      *string    `json:"phone,omitempty"`
	Address    *string    `json:"address,omitempty"`
	Latitude   *float64   `json:"latitude,omitempty"`
	Longitude  *float64   `json:"longitude,omitempty"`
	GroupID    *uuid.UUID `json:"group_id,omitempty"`
	DiscountID *uuid.UUID `json:"discount_id,omitempty"`

	// New service model
	Category           client.Category       `json:"category"`
	ConnectionType     client.ConnectionType `json:"connection_type"`
	RouterID           *uuid.UUID            `json:"router_id,omitempty"`
	PPPoEUsername      *string               `json:"pppoe_username,omitempty"`
	PPPoEPassword      *string               `json:"pppoe_password,omitempty"`
	PPPoELocalAddress  *string               `json:"pppoe_local_address,omitempty"`
	PPPoERemoteAddress *string               `json:"pppoe_remote_address,omitempty"`
	PPPoEComment       *string               `json:"pppoe_comment,omitempty"`
	ServicePackageID   *uuid.UUID            `json:"service_package_id"`
	VoucherPackageID   *uuid.UUID            `json:"voucher_package_id,omitempty"`
	DeviceCount        *int                  `json:"device_count,omitempty"`

	// Deprecated (kept only for compatibility; not used by new UI)
	ServicePlan  *string  `json:"service_plan,omitempty"`
	SpeedProfile *string  `json:"speed_profile,omitempty"`
	MonthlyFee   *float64 `json:"monthly_fee,omitempty"`

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

	// Capture old values for transition handling
	oldConnType := c.ConnectionType
	oldUsername := ""
	if c.PPPoEUsername != nil {
		oldUsername = *c.PPPoEUsername
	}
	oldRouterID := c.RouterID

	// Update fields - only if provided
	if req.Name != "" {
		c.Name = req.Name
	}
	if req.Email != nil {
		c.Email = req.Email
	}
	if req.Phone != nil {
		c.Phone = req.Phone
	}
	if req.Address != nil {
		c.Address = req.Address
	}
	if req.Latitude != nil {
		c.Latitude = req.Latitude
	}
	if req.Longitude != nil {
		c.Longitude = req.Longitude
	}
	if req.GroupID != nil {
		c.GroupID = req.GroupID
	}
	if req.DiscountID != nil {
		c.DiscountID = req.DiscountID
	}

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

	// Validate service model rules + load package
	isHotspot := req.ConnectionType == client.ConnectionTypeHotspot
	isNone := req.ConnectionType == client.ConnectionTypeNone
	var pkg *service_package.ServicePackage

	if isNone {
		// No service package or voucher package validation for none connection type
	} else if isHotspot {
		if req.VoucherPackageID == nil || *req.VoucherPackageID == uuid.Nil {
			return nil, ErrVoucherPackageRequired
		}
	} else {
		if req.ServicePackageID == nil || *req.ServicePackageID == uuid.Nil {
			return nil, ErrServicePackageRequired
		}
		var err error
		pkg, err = s.servicePackageRepo.GetByID(ctx, tenantID, *req.ServicePackageID)
		if err != nil {
			if err == repository.ErrServicePackageNotFound {
				return nil, ErrServicePackageNotFound
			}
			return nil, err
		}
		if client.Category(pkg.Category) != req.Category {
			return nil, ErrCategoryMismatch
		}
	}

	if req.Category != "" {
		c.Category = req.Category
	}
	if req.ConnectionType != "" {
		c.ConnectionType = req.ConnectionType
	}
	if req.RouterID != nil {
		c.RouterID = req.RouterID
	}
	if req.PPPoELocalAddress != nil {
		c.PPPoELocalAddress = req.PPPoELocalAddress
	}
	if req.PPPoERemoteAddress != nil {
		c.PPPoERemoteAddress = req.PPPoERemoteAddress
	}
	if req.PPPoEComment != nil {
		c.PPPoEComment = req.PPPoEComment
	}
	if isNone {
		c.ServicePackageID = nil
		c.VoucherPackageID = nil
	} else if isHotspot {
		c.ServicePackageID = nil
	} else if req.ServicePackageID != nil && *req.ServicePackageID != uuid.Nil {
		c.ServicePackageID = req.ServicePackageID
	}
	if req.VoucherPackageID != nil {
		c.VoucherPackageID = req.VoucherPackageID
	}
	if req.DeviceCount != nil {
		c.DeviceCount = req.DeviceCount
	}
	if req.PPPoEUsername != nil {
		c.PPPoEUsername = req.PPPoEUsername
	}

	// Sync MonthlyFee and ServicePlan from package if changed or missing
	if isNone {
		// No monthly fee sync from package needed for none
	} else if isHotspot {
		// Try to fetch package details if we have an ID
		// Check both req and c for the ID, as req might only have one of them if partial update
		vpID := req.VoucherPackageID
		if vpID == nil || *vpID == uuid.Nil {
			vpID = c.VoucherPackageID
		}

		if vpID != nil && *vpID != uuid.Nil {
			vpkg, err := s.voucherService.GetPackage(ctx, *vpID)
			if err == nil {
				c.ServicePlan = &vpkg.Name
				// Recalculate fee if not manually overridden OR if it was 0
				if req.MonthlyFee == nil || *req.MonthlyFee <= 0 {
					// Use DeviceCount (which maps to shared_users for Hotspot) for price calculation
					deviceCount := 1
					if c.DeviceCount != nil && *c.DeviceCount > 0 {
						deviceCount = *c.DeviceCount
					}
					c.MonthlyFee = vpkg.Price * float64(deviceCount)
				} else {
					c.MonthlyFee = *req.MonthlyFee
				}
			}
		}

	} else if pkg != nil {
		c.ServicePlan = &pkg.Name
		if req.MonthlyFee == nil || *req.MonthlyFee <= 0 {
			if pkg.PricingModel == service_package.PricingModelFlatMonthly {
				c.MonthlyFee = pkg.PriceMonthly
			} else if pkg.PricingModel == service_package.PricingModelPerDevice && c.DeviceCount != nil {
				c.MonthlyFee = pkg.PricePerDevice * float64(*c.DeviceCount)
			}
		} else {
			c.MonthlyFee = *req.MonthlyFee
		}
	} else if req.MonthlyFee != nil {
		c.MonthlyFee = *req.MonthlyFee
	}

	if isNone {
		c.PPPoEUsername = nil
		c.PPPoEPasswordEnc = nil
		c.PPPoEPasswordUpdatedAt = nil
	} else if req.Category == client.CategoryLite {
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
		if pkg != nil {
			servicePlan = &pkg.Name
		} else if c.ServicePlan != nil {
			servicePlan = c.ServicePlan
		}
	}
	c.ServicePlan = servicePlan
	c.SpeedProfile = req.SpeedProfile

	// Capture plain password for sync
	plainPassword := ""
	if req.PPPoEPassword != nil && *req.PPPoEPassword != "" {
		plainPassword = *req.PPPoEPassword
	} else if c.PPPoEPasswordEnc != nil {
		dec, _ := utils.DecryptStringAESGCM(s.encKey32, *c.PPPoEPasswordEnc)
		plainPassword = dec
	}

	if err := s.clientRepo.Update(ctx, c); err != nil {
		return nil, err
	}

	// PERFORM BACKGROUND SYNC / TRANSITION
	go func(cInternal *client.Client, oldType client.ConnectionType, oldUser string, oldRid *uuid.UUID, pass string, tID uuid.UUID) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()

		newUsername := ""
		if cInternal.PPPoEUsername != nil {
			newUsername = *cInternal.PPPoEUsername
		}

		typeChanged := oldType != cInternal.ConnectionType
		userChanged := oldUser != newUsername && oldUser != ""
		routerChanged := (oldRid == nil && cInternal.RouterID != nil) || (oldRid != nil && cInternal.RouterID == nil) || (oldRid != nil && cInternal.RouterID != nil && *oldRid != *cInternal.RouterID)

		// 1. Cleanup old if changed
		if typeChanged || userChanged || routerChanged {
			log.Info().Str("clientID", cInternal.ID.String()).Msg("Connection transition detected, cleaning up old service")
			if oldType == client.ConnectionTypePPPoE {
				secrets, _ := s.pppoeService.pppoeRepo.GetByClientID(bgCtx, cInternal.ID)
				for _, secret := range secrets {
					_ = s.pppoeService.DeletePPPoESecret(bgCtx, tID, secret.ID)
				}
			} else if oldType == client.ConnectionTypeHotspot && oldUser != "" {
				v, _ := s.voucherService.GetVoucherByCode(bgCtx, tID, oldUser)
				if v != nil {
					_ = s.voucherService.DeleteVoucher(bgCtx, v.ID)
				}
			}
		}

		// 2. Create/Sync new service
		if cInternal.ConnectionType == client.ConnectionTypePPPoE && cInternal.RouterID != nil && cInternal.PPPoEUsername != nil && pass != "" && cInternal.ServicePackageID != nil {
			pkg, err := s.servicePackageRepo.GetByID(bgCtx, tID, *cInternal.ServicePackageID)
			if err == nil {
				pppoeReq := CreatePPPoESecretRequest{
					ClientID:      cInternal.ID,
					RouterID:      *cInternal.RouterID,
					ProfileID:     pkg.NetworkProfileID,
					Username:      *cInternal.PPPoEUsername,
					Password:      pass,
					LocalAddress:  utils.Value(cInternal.PPPoELocalAddress),
					RemoteAddress: utils.Value(cInternal.PPPoERemoteAddress),
					Comment:       utils.Value(cInternal.PPPoEComment),
				}
				// We use Create because we cleaned up above, or it will update if exists
				_, _ = s.pppoeService.CreatePPPoESecret(bgCtx, tID, pppoeReq)
			}
		} else if cInternal.ConnectionType == client.ConnectionTypeHotspot && cInternal.VoucherPackageID != nil && cInternal.PPPoEUsername != nil && pass != "" {
			// Check if voucher with current username exists
			v, err := s.voucherService.GetVoucherByCode(bgCtx, tID, *cInternal.PPPoEUsername)
			if err == nil && v != nil {
				// Update existing voucher
				req := UpdateVoucherRequest{
					ID:          v.ID,
					PackageID:   *cInternal.VoucherPackageID,
					Code:        *cInternal.PPPoEUsername,
					Password:    pass,
					SharedUsers: utils.Value(cInternal.DeviceCount),
				}
				_, err := s.voucherService.UpdateVoucher(bgCtx, tID, req)
				if err != nil {
					log.Error().Err(err).Str("client", cInternal.Name).Msg("Failed to update hotspot voucher")
				}
			} else {
				// Create new voucher
				voucherReq := CreateVoucherRequest{
					PackageID:   *cInternal.VoucherPackageID,
					RouterID:    cInternal.RouterID,
					Code:        *cInternal.PPPoEUsername,
					Password:    pass,
					Notes:       fmt.Sprintf("Client: %s (%s)", cInternal.Name, cInternal.ClientCode),
					SharedUsers: utils.Value(cInternal.DeviceCount),
				}
				_, err := s.voucherService.CreateVoucher(bgCtx, tID, voucherReq)
				if err != nil {
					log.Error().Err(err).Str("client", cInternal.Name).Msg("Failed to create hotspot voucher")
				}
			}
		}
	}(c, oldConnType, oldUsername, oldRouterID, plainPassword, tenantID)

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
	dto := &ClientDTO{
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
		DiscountID:             c.DiscountID,
		Category:               c.Category,
		ConnectionType:         c.ConnectionType,
		ServicePackageID:       c.ServicePackageID,
		VoucherPackageID:       c.VoucherPackageID,
		DeviceCount:            c.DeviceCount,
		PackageName:            c.ServicePlan,
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

	// Decrypt password if present for management view
	if c.PPPoEPasswordEnc != nil {
		dec, err := utils.DecryptStringAESGCM(s.encKey32, *c.PPPoEPasswordEnc)
		if err == nil {
			dto.PPPoEPassword = &dec
		}
	}

	return dto
}
