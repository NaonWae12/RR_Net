package service

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/domain/network"
	"rrnet/internal/infra/mikrotik"
	"rrnet/internal/repository"
	"rrnet/pkg/utils"
)

type PPPoEService struct {
	pppoeRepo    *repository.PPPoERepository
	routerRepo   *repository.RouterRepository
	profileRepo  *repository.NetworkProfileRepository
	clientRepo   *repository.ClientRepository
	encKey32     [32]byte
}

func NewPPPoEService(
	pppoeRepo *repository.PPPoERepository,
	routerRepo *repository.RouterRepository,
	profileRepo *repository.NetworkProfileRepository,
	clientRepo *repository.ClientRepository,
	encryptionSecret string,
) *PPPoEService {
	return &PPPoEService{
		pppoeRepo:   pppoeRepo,
		routerRepo:  routerRepo,
		profileRepo: profileRepo,
		clientRepo: clientRepo,
		encKey32:    utils.DeriveKey32(encryptionSecret),
	}
}

type CreatePPPoESecretRequest struct {
	ClientID      uuid.UUID `json:"client_id"`
	RouterID      uuid.UUID `json:"router_id"`
	ProfileID     uuid.UUID `json:"profile_id"`
	Username      string    `json:"username"`
	Password      string    `json:"password"`
	Service       string    `json:"service,omitempty"`
	CallerID      string    `json:"caller_id,omitempty"`
	RemoteAddress string    `json:"remote_address,omitempty"`
	LocalAddress  string    `json:"local_address,omitempty"`
	Comment       string    `json:"comment,omitempty"`
}

func (s *PPPoEService) CreatePPPoESecret(ctx context.Context, tenantID uuid.UUID, req CreatePPPoESecretRequest) (*network.PPPoESecret, error) {
	// Validate router exists and is MikroTik
	router, err := s.routerRepo.GetByID(ctx, req.RouterID)
	if err != nil {
		return nil, fmt.Errorf("router not found: %w", err)
	}
	if router.TenantID != tenantID {
		return nil, fmt.Errorf("router not found")
	}
	if router.Type != network.RouterTypeMikroTik {
		return nil, fmt.Errorf("only MikroTik routers are supported")
	}

	// Validate profile exists and is active
	profile, err := s.profileRepo.GetByID(ctx, req.ProfileID)
	if err != nil {
		return nil, fmt.Errorf("profile not found: %w", err)
	}
	if profile.TenantID != tenantID {
		return nil, fmt.Errorf("profile not found")
	}
	if !profile.IsActive {
		return nil, fmt.Errorf("profile is not active")
	}

	// Validate client exists
	client, err := s.clientRepo.GetByID(ctx, tenantID, req.ClientID)
	if err != nil {
		return nil, fmt.Errorf("client not found: %w", err)
	}
	if client.TenantID != tenantID {
		return nil, fmt.Errorf("client not found")
	}

	// Check username uniqueness
	existing, err := s.pppoeRepo.GetByUsername(ctx, tenantID, req.Username)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("username already exists")
	}

	// Auto-fill local/remote address if not provided. Source is create-secret form only; profile no longer provides these.
	localAddress := req.LocalAddress
	remoteAddress := req.RemoteAddress

	// Local address: 1. From request, 2. From router
	if localAddress == "" {
		addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
		routerLocalAddr, err := mikrotik.GetPPPoEServerLocalAddress(ctx, addr, router.APIUseTLS, router.Username, router.Password)
		if err == nil {
			localAddress = routerLocalAddr
			log.Info().
				Str("tenant_id", tenantID.String()).
				Str("router_id", router.ID.String()).
				Str("local_address", localAddress).
				Msg("PPPoE Service: Using local address from router")
		} else {
			log.Warn().
				Str("tenant_id", tenantID.String()).
				Str("router_id", router.ID.String()).
				Err(err).
				Msg("PPPoE Service: Failed to get local address from router, leaving empty")
		}
	}

	// Remote address: from request only (set in create-secret form)
	if remoteAddress == "" {
		log.Warn().
			Str("tenant_id", tenantID.String()).
			Str("profile_id", profile.ID.String()).
			Msg("PPPoE Service: No remote address provided, leaving empty")
	}

	// Encrypt password
	passwordEnc, err := utils.EncryptStringAESGCM(s.encKey32, req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt password: %w", err)
	}

	// Create secret
	now := time.Now()
	secret := &network.PPPoESecret{
		ID:            uuid.New(),
		TenantID:      tenantID,
		ClientID:      req.ClientID,
		RouterID:      req.RouterID,
		ProfileID:     req.ProfileID,
		Username:      req.Username,
		Password:      passwordEnc,
		Service:       req.Service,
		CallerID:      req.CallerID,
		RemoteAddress: remoteAddress,
		LocalAddress:  localAddress,
		Comment:       req.Comment,
		IsDisabled:    false,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if secret.Service == "" {
		secret.Service = "pppoe"
	}

	// Save to database
	if err := s.pppoeRepo.Create(ctx, secret); err != nil {
		return nil, fmt.Errorf("failed to create PPPoE secret: %w", err)
	}

	// Sync to router (non-blocking, log errors but don't fail)
	if err := s.syncSecretToRouter(ctx, router, profile, secret, req.Password); err != nil {
		log.Warn().
			Str("tenant_id", tenantID.String()).
			Str("secret_id", secret.ID.String()).
			Str("router_name", router.Name).
			Str("router_host", router.Host).
			Err(err).
			Msg("PPPoE Service: Failed to sync secret to router (non-blocking)")
		// Don't return error - secret is saved in DB, can sync later
	} else {
		log.Info().
			Str("tenant_id", tenantID.String()).
			Str("secret_id", secret.ID.String()).
			Str("router_name", router.Name).
			Msg("PPPoE Service: Secret synced to router successfully")
	}

	return secret, nil
}

type UpdatePPPoESecretRequest struct {
	RouterID      *uuid.UUID `json:"router_id,omitempty"`
	ProfileID     *uuid.UUID `json:"profile_id,omitempty"`
	Username      *string    `json:"username,omitempty"`
	Password      *string    `json:"password,omitempty"`
	Service       *string    `json:"service,omitempty"`
	CallerID      *string    `json:"caller_id,omitempty"`
	RemoteAddress *string    `json:"remote_address,omitempty"`
	LocalAddress  *string    `json:"local_address,omitempty"`
	Comment       *string    `json:"comment,omitempty"`
}

func (s *PPPoEService) UpdatePPPoESecret(ctx context.Context, tenantID uuid.UUID, id uuid.UUID, req UpdatePPPoESecretRequest) (*network.PPPoESecret, error) {
	// Get existing secret
	secret, err := s.pppoeRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("PPPoE secret not found: %w", err)
	}
	if secret.TenantID != tenantID {
		return nil, fmt.Errorf("PPPoE secret not found")
	}

	// Get router
	router, err := s.routerRepo.GetByID(ctx, secret.RouterID)
	if err != nil {
		return nil, fmt.Errorf("router not found: %w", err)
	}
	if router.Type != network.RouterTypeMikroTik {
		return nil, fmt.Errorf("only MikroTik routers are supported")
	}

	// Update fields
	if req.RouterID != nil {
		// Validate new router
		newRouter, err := s.routerRepo.GetByID(ctx, *req.RouterID)
		if err != nil {
			return nil, fmt.Errorf("router not found: %w", err)
		}
		if newRouter.TenantID != tenantID {
			return nil, fmt.Errorf("router not found")
		}
		if newRouter.Type != network.RouterTypeMikroTik {
			return nil, fmt.Errorf("only MikroTik routers are supported")
		}
		secret.RouterID = *req.RouterID
		router = newRouter
	}

	if req.ProfileID != nil {
		// Validate profile
		profile, err := s.profileRepo.GetByID(ctx, *req.ProfileID)
		if err != nil {
			return nil, fmt.Errorf("profile not found: %w", err)
		}
		if profile.TenantID != tenantID {
			return nil, fmt.Errorf("profile not found")
		}
		if !profile.IsActive {
			return nil, fmt.Errorf("profile is not active")
		}
		secret.ProfileID = *req.ProfileID
	}

	if req.Username != nil && *req.Username != secret.Username {
		// Check username uniqueness
		existing, err := s.pppoeRepo.GetByUsername(ctx, tenantID, *req.Username)
		if err == nil && existing != nil && existing.ID != secret.ID {
			return nil, fmt.Errorf("username already exists")
		}
		secret.Username = *req.Username
	}

	if req.Password != nil {
		// Encrypt new password
		passwordEnc, err := utils.EncryptStringAESGCM(s.encKey32, *req.Password)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt password: %w", err)
		}
		secret.Password = passwordEnc
	}

	if req.Service != nil {
		secret.Service = *req.Service
	}
	if req.CallerID != nil {
		secret.CallerID = *req.CallerID
	}
	if req.RemoteAddress != nil {
		secret.RemoteAddress = *req.RemoteAddress
	}
	if req.LocalAddress != nil {
		secret.LocalAddress = *req.LocalAddress
	}
	if req.Comment != nil {
		secret.Comment = *req.Comment
	}

	secret.UpdatedAt = time.Now()

	// Update in database
	if err := s.pppoeRepo.Update(ctx, secret); err != nil {
		return nil, fmt.Errorf("failed to update PPPoE secret: %w", err)
	}

	// Get profile for sync
	profile, err := s.profileRepo.GetByID(ctx, secret.ProfileID)
	if err != nil {
		return nil, fmt.Errorf("profile not found: %w", err)
	}

	// Decrypt password for sync
	plainPassword, err := utils.DecryptStringAESGCM(s.encKey32, secret.Password)
	if err != nil {
		log.Warn().
			Str("tenant_id", tenantID.String()).
			Str("secret_id", secret.ID.String()).
			Err(err).
			Msg("PPPoE Service: Failed to decrypt password for sync")
		plainPassword = "" // Will fail sync but secret is updated in DB
	}

	// Sync to router
	if err := s.syncSecretToRouter(ctx, router, profile, secret, plainPassword); err != nil {
		log.Warn().
			Str("tenant_id", tenantID.String()).
			Str("secret_id", secret.ID.String()).
			Str("router_name", router.Name).
			Str("router_host", router.Host).
			Err(err).
			Msg("PPPoE Service: Failed to sync secret to router (non-blocking)")
		// Don't return error - secret is updated in DB, can sync later
	}

	return secret, nil
}

func (s *PPPoEService) DeletePPPoESecret(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) error {
	// Get secret
	secret, err := s.pppoeRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("PPPoE secret not found: %w", err)
	}
	if secret.TenantID != tenantID {
		return fmt.Errorf("PPPoE secret not found")
	}

	// Get router
	router, err := s.routerRepo.GetByID(ctx, secret.RouterID)
	if err != nil {
		return fmt.Errorf("router not found: %w", err)
	}

	// Delete from database first
	if err := s.pppoeRepo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete PPPoE secret: %w", err)
	}

	// Remove from router (non-blocking)
	if router.Type == network.RouterTypeMikroTik {
		if err := s.removeSecretFromRouter(ctx, router, secret.Username); err != nil {
			log.Warn().
				Str("tenant_id", tenantID.String()).
				Str("secret_id", id.String()).
				Str("router_name", router.Name).
				Str("router_host", router.Host).
				Err(err).
				Msg("PPPoE Service: Failed to remove secret from router (non-blocking)")
			// Don't return error - secret is deleted from DB
		}
	}

	return nil
}

func (s *PPPoEService) ToggleStatus(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) (*network.PPPoESecret, error) {
	// Get secret
	secret, err := s.pppoeRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("PPPoE secret not found: %w", err)
	}
	if secret.TenantID != tenantID {
		return nil, fmt.Errorf("PPPoE secret not found")
	}

	// Toggle status
	secret.IsDisabled = !secret.IsDisabled
	secret.UpdatedAt = time.Now()

	// Update in database
	if err := s.pppoeRepo.UpdateStatus(ctx, id, secret.IsDisabled); err != nil {
		return nil, fmt.Errorf("failed to update status: %w", err)
	}

	// Get router and profile
	router, err := s.routerRepo.GetByID(ctx, secret.RouterID)
	if err != nil {
		return nil, fmt.Errorf("router not found: %w", err)
	}

	profile, err := s.profileRepo.GetByID(ctx, secret.ProfileID)
	if err != nil {
		return nil, fmt.Errorf("profile not found: %w", err)
	}

	// Decrypt password for sync
	plainPassword, err := utils.DecryptStringAESGCM(s.encKey32, secret.Password)
	if err != nil {
		log.Warn().
			Str("tenant_id", tenantID.String()).
			Str("secret_id", id.String()).
			Err(err).
			Msg("PPPoE Service: Failed to decrypt password for sync")
		plainPassword = ""
	}

	// Sync to router
	if router.Type == network.RouterTypeMikroTik {
		if err := s.syncSecretToRouter(ctx, router, profile, secret, plainPassword); err != nil {
			log.Warn().
				Str("tenant_id", tenantID.String()).
				Str("secret_id", id.String()).
				Str("router_name", router.Name).
				Str("router_host", router.Host).
				Err(err).
				Msg("PPPoE Service: Failed to sync secret to router (non-blocking)")
		}
	}

	return secret, nil
}

func (s *PPPoEService) SyncToRouter(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) error {
	log.Info().
		Str("tenant_id", tenantID.String()).
		Str("secret_id", id.String()).
		Msg("PPPoE Service: Starting sync to router")

	// Get secret
	secret, err := s.pppoeRepo.GetByID(ctx, id)
	if err != nil {
		log.Warn().
			Str("tenant_id", tenantID.String()).
			Str("secret_id", id.String()).
			Err(err).
			Msg("PPPoE Service: Secret not found")
		return fmt.Errorf("PPPoE secret not found: %w", err)
	}
	if secret.TenantID != tenantID {
		return fmt.Errorf("PPPoE secret not found")
	}

	// Get router
	router, err := s.routerRepo.GetByID(ctx, secret.RouterID)
	if err != nil {
		log.Warn().
			Str("tenant_id", tenantID.String()).
			Str("router_id", secret.RouterID.String()).
			Err(err).
			Msg("PPPoE Service: Router not found")
		return fmt.Errorf("router not found: %w", err)
	}
	if router.Type != network.RouterTypeMikroTik {
		return fmt.Errorf("only MikroTik routers are supported")
	}

	log.Debug().
		Str("tenant_id", tenantID.String()).
		Str("secret_id", id.String()).
		Str("router_name", router.Name).
		Str("router_host", router.Host).
		Int("router_port", router.APIPort).
		Bool("router_tls", router.APIUseTLS).
		Msg("PPPoE Service: Router details retrieved")

	// Get profile
	profile, err := s.profileRepo.GetByID(ctx, secret.ProfileID)
	if err != nil {
		log.Warn().
			Str("tenant_id", tenantID.String()).
			Str("profile_id", secret.ProfileID.String()).
			Err(err).
			Msg("PPPoE Service: Profile not found")
		return fmt.Errorf("profile not found: %w", err)
	}

	// Decrypt password
	plainPassword, err := utils.DecryptStringAESGCM(s.encKey32, secret.Password)
	if err != nil {
		log.Error().
			Str("tenant_id", tenantID.String()).
			Str("secret_id", id.String()).
			Err(err).
			Msg("PPPoE Service: Failed to decrypt password")
		return fmt.Errorf("failed to decrypt password: %w", err)
	}

	// Sync to router
	log.Info().
		Str("tenant_id", tenantID.String()).
		Str("secret_id", id.String()).
		Str("router_name", router.Name).
		Str("router_host", router.Host).
		Str("username", secret.Username).
		Msg("PPPoE Service: Attempting to sync secret to router")

	err = s.syncSecretToRouter(ctx, router, profile, secret, plainPassword)
	if err != nil {
		// Log detailed error information
		errMsg := err.Error()
		log.Error().
			Str("tenant_id", tenantID.String()).
			Str("secret_id", id.String()).
			Str("router_name", router.Name).
			Str("router_host", router.Host).
			Str("router_port", strconv.Itoa(router.APIPort)).
			Bool("router_tls", router.APIUseTLS).
			Str("username", secret.Username).
			Err(err).
			Msg("PPPoE Service: Failed to sync secret to router")

		// Return error with more context
		if strings.Contains(errMsg, "connection timeout") ||
			strings.Contains(errMsg, "unable to reach") ||
			strings.Contains(errMsg, "connection refused") ||
			strings.Contains(errMsg, "no route to host") ||
			strings.Contains(errMsg, "network is unreachable") {
			return fmt.Errorf("router connection failed: router %s (%s:%d) is unreachable - %w", router.Name, router.Host, router.APIPort, err)
		}
		return err
	}

	log.Info().
		Str("tenant_id", tenantID.String()).
		Str("secret_id", id.String()).
		Str("router_name", router.Name).
		Str("username", secret.Username).
		Msg("PPPoE Service: Secret synced to router successfully")

	return nil
}

func (s *PPPoEService) ListPPPoESecrets(ctx context.Context, tenantID uuid.UUID, routerID *uuid.UUID, clientID *uuid.UUID, disabled *bool, limit, offset int) ([]*network.PPPoESecret, int, error) {
	return s.pppoeRepo.ListByTenant(ctx, tenantID, routerID, clientID, disabled, limit, offset)
}

func (s *PPPoEService) GetPPPoESecret(ctx context.Context, tenantID uuid.UUID, id uuid.UUID) (*network.PPPoESecret, error) {
	secret, err := s.pppoeRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if secret.TenantID != tenantID {
		return nil, fmt.Errorf("PPPoE secret not found")
	}
	return secret, nil
}

func (s *PPPoEService) ListActiveConnections(ctx context.Context, tenantID uuid.UUID, routerID uuid.UUID) ([]network.ActiveConnection, error) {
	// Get router
	router, err := s.routerRepo.GetByID(ctx, routerID)
	if err != nil {
		return nil, fmt.Errorf("router not found: %w", err)
	}
	if router.TenantID != tenantID {
		return nil, fmt.Errorf("router not found")
	}
	if router.Type != network.RouterTypeMikroTik {
		return nil, fmt.Errorf("only MikroTik routers are supported")
	}

	// Connect to router and get active connections
	addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
	connections, err := mikrotik.ListPPPoEActive(ctx, addr, router.APIUseTLS, router.Username, router.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to list active connections: %w", err)
	}

	// Convert to domain model
	result := make([]network.ActiveConnection, 0, len(connections))
	for _, conn := range connections {
		// Parse connected_at from uptime (simplified - MikroTik doesn't provide exact timestamp)
		connectedAt := time.Now() // Default to now, could parse uptime if needed

		result = append(result, network.ActiveConnection{
			ID:         conn.ID,
			Username:   conn.Username,
			Service:    conn.Service,
			CallerID:   conn.CallerID,
			Address:    conn.Address,
			Uptime:     conn.Uptime,
			BytesIn:    conn.BytesIn,
			BytesOut:   conn.BytesOut,
			PacketsIn:  conn.PacketsIn,
			PacketsOut: conn.PacketsOut,
			Status:     network.ConnectionStatusConnected,
			ConnectedAt: connectedAt,
		})
	}

	return result, nil
}

func (s *PPPoEService) DisconnectSession(ctx context.Context, tenantID uuid.UUID, routerID uuid.UUID, sessionID string) error {
	// Get router
	router, err := s.routerRepo.GetByID(ctx, routerID)
	if err != nil {
		return fmt.Errorf("router not found: %w", err)
	}
	if router.TenantID != tenantID {
		return fmt.Errorf("router not found")
	}
	if router.Type != network.RouterTypeMikroTik {
		return fmt.Errorf("only MikroTik routers are supported")
	}

	// Disconnect session
	addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
	if err := mikrotik.DisconnectPPPoE(ctx, addr, router.APIUseTLS, router.Username, router.Password, sessionID); err != nil {
		return fmt.Errorf("failed to disconnect session: %w", err)
	}

	return nil
}

// syncSecretToRouter syncs a PPPoE secret to MikroTik router
func (s *PPPoEService) syncSecretToRouter(ctx context.Context, router *network.Router, profile *network.NetworkProfile, secret *network.PPPoESecret, plainPassword string) error {
	if router.Type != network.RouterTypeMikroTik {
		return fmt.Errorf("only MikroTik routers are supported")
	}

	addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))

	log.Debug().
		Str("router_name", router.Name).
		Str("router_host", router.Host).
		Int("router_port", router.APIPort).
		Bool("router_tls", router.APIUseTLS).
		Str("username", secret.Username).
		Str("profile_name", profile.Name).
		Msg("PPPoE Service: Connecting to router")

	// Try to find existing secret on router
	secretID, err := mikrotik.FindPPPoESecretID(ctx, addr, router.APIUseTLS, router.Username, router.Password, secret.Username)
	if err != nil {
		// Check if error is "not found" vs connection error
		errMsg := err.Error()
		if strings.Contains(errMsg, "PPPoE secret not found") {
			// Secret doesn't exist, create it
			log.Debug().
				Str("router_name", router.Name).
				Str("username", secret.Username).
				Msg("PPPoE Service: Secret not found on router, creating new")

			mikrotikSecret := mikrotik.PPPoESecret{
				Username:      secret.Username,
				Password:      plainPassword,
				Profile:       profile.Name,
				Service:       secret.Service,
				CallerID:      secret.CallerID,
				RemoteAddress: secret.RemoteAddress,
				LocalAddress:  secret.LocalAddress,
				Comment:       secret.Comment,
				Disabled:      secret.IsDisabled,
			}

			if err := mikrotik.AddPPPoESecret(ctx, addr, router.APIUseTLS, router.Username, router.Password, mikrotikSecret); err != nil {
				log.Error().
					Str("router_name", router.Name).
					Str("username", secret.Username).
					Err(err).
					Msg("PPPoE Service: Failed to add secret to router")
				return fmt.Errorf("failed to add secret to router: %w", err)
			}

			log.Info().
				Str("router_name", router.Name).
				Str("username", secret.Username).
				Msg("PPPoE Service: Secret added to router successfully")
			return nil
		}

		// Connection error - propagate it
		log.Error().
			Str("router_name", router.Name).
			Str("username", secret.Username).
			Err(err).
			Msg("PPPoE Service: Failed to connect to router or find secret")
		return fmt.Errorf("failed to connect to router: %w", err)
	}

	// Secret exists, update it
	log.Debug().
		Str("router_name", router.Name).
		Str("username", secret.Username).
		Str("secret_id", secretID).
		Msg("PPPoE Service: Secret exists on router, updating")

	mikrotikSecret := mikrotik.PPPoESecret{
		Username:      secret.Username,
		Password:      plainPassword,
		Profile:       profile.Name,
		Service:       secret.Service,
		CallerID:      secret.CallerID,
		RemoteAddress: secret.RemoteAddress,
		LocalAddress:  secret.LocalAddress,
		Comment:       secret.Comment,
		Disabled:      secret.IsDisabled,
	}

	if err := mikrotik.UpdatePPPoESecret(ctx, addr, router.APIUseTLS, router.Username, router.Password, secretID, mikrotikSecret); err != nil {
		log.Error().
			Str("router_name", router.Name).
			Str("username", secret.Username).
			Str("secret_id", secretID).
			Err(err).
			Msg("PPPoE Service: Failed to update secret on router")
		return fmt.Errorf("failed to update secret on router: %w", err)
	}

	log.Info().
		Str("router_name", router.Name).
		Str("username", secret.Username).
		Msg("PPPoE Service: Secret updated on router successfully")
	return nil
}

// removeSecretFromRouter removes a PPPoE secret from MikroTik router
func (s *PPPoEService) removeSecretFromRouter(ctx context.Context, router *network.Router, username string) error {
	if router.Type != network.RouterTypeMikroTik {
		return fmt.Errorf("only MikroTik routers are supported")
	}

	addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
	return mikrotik.RemovePPPoESecret(ctx, addr, router.APIUseTLS, router.Username, router.Password, username)
}

