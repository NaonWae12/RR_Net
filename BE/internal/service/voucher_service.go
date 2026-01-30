package service

import (
	"context"
	"crypto/rand"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"regexp"
	"rrnet/internal/domain/network"
	"rrnet/internal/domain/voucher"
	"rrnet/internal/infra/mikrotik"
	"rrnet/internal/repository"
)

type VoucherService struct {
	voucherRepo *repository.VoucherRepository
	radiusRepo  *repository.RadiusRepository
	routerRepo  *repository.RouterRepository
}

func NewVoucherService(voucherRepo *repository.VoucherRepository, radiusRepo *repository.RadiusRepository, routerRepo *repository.RouterRepository) *VoucherService {
	return &VoucherService{
		voucherRepo: voucherRepo,
		radiusRepo:  radiusRepo,
		routerRepo:  routerRepo,
	}
}

// VoucherRepo exposes the underlying repository for handler access
func (s *VoucherService) VoucherRepo() *repository.VoucherRepository {
	return s.voucherRepo
}

// ========== Voucher Packages ==========

type CreateVoucherPackageRequest struct {
	Name          string  `json:"name"`
	Description   string  `json:"description,omitempty"`
	DownloadSpeed int     `json:"download_speed"`
	UploadSpeed   int     `json:"upload_speed"`
	DurationHours *int    `json:"duration_hours,omitempty"`
	Validity      string  `json:"validity,omitempty"` // Mikhmon format: 2H, 1J, etc.
	QuotaMB       *int    `json:"quota_mb,omitempty"`
	Price         float64 `json:"price"`
	Currency      string  `json:"currency,omitempty"`
	RateLimitMode string  `json:"rate_limit_mode,omitempty"` // full_radius or radius_auth_only
}

func (s *VoucherService) CreatePackage(ctx context.Context, tenantID uuid.UUID, req CreateVoucherPackageRequest) (*voucher.VoucherPackage, error) {
	now := time.Now()

	// Parse Mikhmon duration if provided
	durationHours := req.DurationHours
	if req.Validity != "" {
		parsed, err := ParseMikhmonDuration(req.Validity)
		if err == nil {
			durationHours = &parsed
		}
	}

	// Set default rate limit mode if not provided
	rateLimitMode := req.RateLimitMode
	if rateLimitMode == "" {
		rateLimitMode = voucher.RateLimitModeAuthOnly // Default to MVP mode
	}
	if rateLimitMode != voucher.RateLimitModeFullRadius && rateLimitMode != voucher.RateLimitModeAuthOnly {
		return nil, fmt.Errorf("invalid rate_limit_mode: %s (must be 'full_radius' or 'radius_auth_only')", rateLimitMode)
	}

	pkg := &voucher.VoucherPackage{
		ID:            uuid.New(),
		TenantID:      tenantID,
		Name:          req.Name,
		Description:   req.Description,
		DownloadSpeed: req.DownloadSpeed,
		UploadSpeed:   req.UploadSpeed,
		DurationHours: durationHours,
		QuotaMB:       req.QuotaMB,
		Price:         req.Price,
		Currency:      req.Currency,
		RateLimitMode: rateLimitMode,
		IsActive:      true,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if pkg.Currency == "" {
		pkg.Currency = "IDR"
	}

	if err := s.voucherRepo.CreatePackage(ctx, pkg); err != nil {
		return nil, fmt.Errorf("failed to create package: %w", err)
	}

	// If mode is radius_auth_only, sync Hotspot profile to all active routers
	if pkg.RateLimitMode == voucher.RateLimitModeAuthOnly {
		if err := s.syncPackageToAllRouters(ctx, tenantID, pkg); err != nil {
			// Log error but don't fail package creation
			log.Warn().
				Str("package_id", pkg.ID.String()).
				Str("package_name", pkg.Name).
				Err(err).
				Msg("Voucher Service: Failed to sync package to routers, but package created successfully")
		}
	}

	return pkg, nil
}

func (s *VoucherService) GetPackage(ctx context.Context, id uuid.UUID) (*voucher.VoucherPackage, error) {
	return s.voucherRepo.GetPackageByID(ctx, id)
}

func (s *VoucherService) ListPackages(ctx context.Context, tenantID uuid.UUID, activeOnly bool) ([]*voucher.VoucherPackage, error) {
	return s.voucherRepo.ListPackagesByTenant(ctx, tenantID, activeOnly)
}

type UpdateVoucherPackageRequest struct {
	Name          string  `json:"name,omitempty"`
	Description   string  `json:"description,omitempty"`
	DownloadSpeed int     `json:"download_speed,omitempty"`
	UploadSpeed   int     `json:"upload_speed,omitempty"`
	DurationHours *int    `json:"duration_hours,omitempty"`
	Validity      string  `json:"validity,omitempty"`
	QuotaMB       *int    `json:"quota_mb,omitempty"`
	Price         float64 `json:"price,omitempty"`
	Currency      string  `json:"currency,omitempty"`
	RateLimitMode string  `json:"rate_limit_mode,omitempty"`
	IsActive      *bool   `json:"is_active,omitempty"`
}

func (s *VoucherService) UpdatePackage(ctx context.Context, id uuid.UUID, req UpdateVoucherPackageRequest) (*voucher.VoucherPackage, error) {
	pkg, err := s.voucherRepo.GetPackageByID(ctx, id)
	if err != nil {
		return nil, err
	}

	oldDownloadSpeed := pkg.DownloadSpeed
	oldUploadSpeed := pkg.UploadSpeed
	oldMode := pkg.RateLimitMode

	if req.Name != "" {
		pkg.Name = req.Name
	}
	if req.Description != "" {
		pkg.Description = req.Description
	}
	if req.DownloadSpeed > 0 {
		pkg.DownloadSpeed = req.DownloadSpeed
	}
	if req.UploadSpeed > 0 {
		pkg.UploadSpeed = req.UploadSpeed
	}

	if req.Validity != "" {
		parsed, err := ParseMikhmonDuration(req.Validity)
		if err == nil {
			pkg.DurationHours = &parsed
		}
	} else if req.DurationHours != nil {
		pkg.DurationHours = req.DurationHours
	}
	if req.QuotaMB != nil {
		pkg.QuotaMB = req.QuotaMB
	}
	if req.Price > 0 {
		pkg.Price = req.Price
	}
	if req.Currency != "" {
		pkg.Currency = req.Currency
	}
	if req.RateLimitMode != "" {
		if req.RateLimitMode != voucher.RateLimitModeFullRadius && req.RateLimitMode != voucher.RateLimitModeAuthOnly {
			return nil, fmt.Errorf("invalid rate_limit_mode: %s (must be 'full_radius' or 'radius_auth_only')", req.RateLimitMode)
		}
		pkg.RateLimitMode = req.RateLimitMode
	}
	if req.IsActive != nil {
		pkg.IsActive = *req.IsActive
	}
	pkg.UpdatedAt = time.Now()

	if err := s.voucherRepo.UpdatePackage(ctx, pkg); err != nil {
		return nil, fmt.Errorf("failed to update package: %w", err)
	}

	// Sync to routers if:
	// 1. Mode is radius_auth_only AND (speed changed OR mode changed)
	// 2. Mode changed from full_radius to radius_auth_only (need to create profiles)
	// 3. Mode changed from radius_auth_only to full_radius (need to remove profiles)
	speedChanged := oldDownloadSpeed != pkg.DownloadSpeed || oldUploadSpeed != pkg.UploadSpeed
	modeChanged := oldMode != pkg.RateLimitMode

	if pkg.RateLimitMode == voucher.RateLimitModeAuthOnly && (speedChanged || modeChanged) {
		if err := s.syncPackageToAllRouters(ctx, pkg.TenantID, pkg); err != nil {
			log.Warn().
				Str("package_id", pkg.ID.String()).
				Str("package_name", pkg.Name).
				Err(err).
				Msg("Voucher Service: Failed to sync package to routers after update")
		}
	} else if modeChanged && oldMode == voucher.RateLimitModeAuthOnly && pkg.RateLimitMode == voucher.RateLimitModeFullRadius {
		// Mode changed from radius_auth_only to full_radius, remove profiles from routers
		if err := s.removePackageFromAllRouters(ctx, pkg.TenantID, pkg); err != nil {
			log.Warn().
				Str("package_id", pkg.ID.String()).
				Str("package_name", pkg.Name).
				Err(err).
				Msg("Voucher Service: Failed to remove package profiles from routers")
		}
	}

	return pkg, nil
}

func (s *VoucherService) DeletePackage(ctx context.Context, id uuid.UUID) error {
	// Get package before deletion to check mode
	pkg, err := s.voucherRepo.GetPackageByID(ctx, id)
	if err != nil {
		return err
	}

	// Check if there are any vouchers using this package
	voucherCount, err := s.voucherRepo.CountVouchersByPackage(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to check voucher count: %w", err)
	}
	if voucherCount > 0 {
		return fmt.Errorf("cannot delete package: %d voucher(s) are still using this package. Please delete the vouchers first", voucherCount)
	}

	// If mode is radius_auth_only, remove Hotspot profiles from routers before deleting
	if pkg.RateLimitMode == voucher.RateLimitModeAuthOnly {
		if err := s.removePackageFromAllRouters(ctx, pkg.TenantID, pkg); err != nil {
			log.Warn().
				Str("package_id", pkg.ID.String()).
				Str("package_name", pkg.Name).
				Err(err).
				Msg("Voucher Service: Failed to remove package profiles from routers, but continuing with deletion")
		}
	}

	return s.voucherRepo.DeletePackage(ctx, id)
}

// ========== Vouchers ==========

type GenerateVouchersRequest struct {
	PackageID     uuid.UUID  `json:"package_id"`
	RouterID      *uuid.UUID `json:"router_id,omitempty"`
	Quantity      int        `json:"quantity"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	UserMode      string     `json:"user_mode,omitempty"`      // "up" (User & Pass), "vc" (User=Pass)
	CharacterMode string     `json:"character_mode,omitempty"` // "abcd", "ABCD", "aBcD", etc.
	CodeLength    int        `json:"code_length,omitempty"`    // total length
}

// buildCharsetFromMode deterministically builds a charset based on character_mode pattern.
// It analyzes the pattern to detect which character classes are present:
//   - Lowercase letters (a-z) → include lowercase charset
//   - Uppercase letters (A-Z) → include uppercase charset
//   - Digits (0-9) → include numbers charset (2-9, excluding 0,1,I,O)
//
// Examples:
//   - "abcd" → lowercase only
//   - "ABCD" → uppercase only
//   - "aBcD" → lowercase + uppercase
//   - "5ab2" → numbers + lowercase
//   - "5AB2" → numbers + uppercase
//   - "5aB2" → numbers + lowercase + uppercase
//   - "5ab2c34d" → numbers + lowercase (handles complex patterns)
//
// Returns an error if the mode is empty or contains invalid characters.
func buildCharsetFromMode(mode string) (string, error) {
	if mode == "" {
		// Default to uppercase alphanumeric if not specified
		return "23456789ABCDEFGHJKLMNPQRSTUVWXYZ", nil
	}

	// Character sets (excluding ambiguous characters: 0, 1, I, O, l)
	const (
		lowercaseChars = "abcdefghijkmnpqrstuvwxyz"
		uppercaseChars = "ABCDEFGHJKLMNPQRSTUVWXYZ"
		numberChars    = "23456789"
	)

	// Detect which character classes are present in the mode
	hasLowercase := false
	hasUppercase := false
	hasNumbers := false

	for _, char := range mode {
		switch {
		case char >= 'a' && char <= 'z':
			hasLowercase = true
		case char >= 'A' && char <= 'Z':
			hasUppercase = true
		case char >= '0' && char <= '9':
			hasNumbers = true
		default:
			// Invalid character in mode
			return "", fmt.Errorf("contains invalid character %q (only letters and digits allowed)", char)
		}
	}

	// Build charset based on detected character classes
	var charset strings.Builder
	if hasLowercase {
		charset.WriteString(lowercaseChars)
	}
	if hasUppercase {
		charset.WriteString(uppercaseChars)
	}
	if hasNumbers {
		charset.WriteString(numberChars)
	}

	// If no valid character classes detected, return error
	if charset.Len() == 0 {
		return "", fmt.Errorf("must contain at least one letter or digit")
	}

	return charset.String(), nil
}

func (s *VoucherService) GenerateVouchers(ctx context.Context, tenantID uuid.UUID, req GenerateVouchersRequest) ([]*voucher.Voucher, error) {
	// Validate package exists and get package details
	pkg, err := s.voucherRepo.GetPackageByID(ctx, req.PackageID)
	if err != nil {
		return nil, fmt.Errorf("package not found: %w", err)
	}

	if req.Quantity <= 0 || req.Quantity > 1000 {
		return nil, fmt.Errorf("quantity must be between 1 and 1000")
	}

	codeLength := req.CodeLength
	if codeLength == 0 {
		codeLength = 6
	}

	// Build charset deterministically from character_mode pattern
	charset, err := buildCharsetFromMode(req.CharacterMode)
	if err != nil {
		return nil, fmt.Errorf("invalid character_mode %q: %w", req.CharacterMode, err)
	}

	vouchers := make([]*voucher.Voucher, 0, req.Quantity)
	now := time.Now()

	userMode := req.UserMode
	if userMode == "" {
		userMode = "up" // Default is Username & Password
	}

	for i := 0; i < req.Quantity; i++ {
		var code, password string
		var err error

		// Username is always from selected charset
		code, err = generateRandomFromCharset(charset, codeLength)
		if err != nil {
			return nil, err
		}

		if userMode == "up" {
			// Password is random digits, same length as username
			password, err = generateRandomFromCharset("0123456789", codeLength)
			if err != nil {
				return nil, err
			}
		} else {
			// User = Password
			password = code
		}

		v := &voucher.Voucher{
			ID:        uuid.New(),
			TenantID:  tenantID,
			PackageID: req.PackageID,
			RouterID:  req.RouterID,
			Code:      code,
			Password:  password,
			Status:    voucher.VoucherStatusActive,
			ExpiresAt: req.ExpiresAt,
			CreatedAt: now,
			UpdatedAt: now,
		}

		if err := s.voucherRepo.CreateVoucher(ctx, v); err != nil {
			return nil, fmt.Errorf("failed to create voucher: %w", err)
		}

		vouchers = append(vouchers, v)
	}

	// For radius_auth_only mode, create Hotspot users on MikroTik routers
	// This is required because MikroTik Hotspot doesn't support dynamic profile assignment via RADIUS
	if pkg.RateLimitMode == "radius_auth_only" {
		log.Info().
			Str("package_id", pkg.ID.String()).
			Str("package_name", pkg.Name).
			Str("mode", pkg.RateLimitMode).
			Int("voucher_count", len(vouchers)).
			Msg("Creating Hotspot users on routers for radius_auth_only mode")

		// Get all active routers for this tenant
		routers, err := s.routerRepo.ListByTenant(ctx, tenantID)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to get routers for Hotspot user creation, vouchers created but users not synced to routers")
		} else {
			// Create Hotspot users on each router
			for _, router := range routers {
				if router.Status != network.RouterStatusOnline {
					continue
				}

				addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))

				for _, v := range vouchers {
					hotspotUser := mikrotik.HotspotUser{
						Name:     v.Code,
						Password: v.Password,
						Profile:  pkg.Name, // Package name must match MikroTik profile name
						Comment:  fmt.Sprintf("RRNET Voucher - Generated %s", now.Format("2006-01-02 15:04:05")),
					}

					// Create timeout context for each user creation
					userCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
					err := mikrotik.AddHotspotUser(userCtx, addr, router.APIUseTLS, router.Username, router.Password, hotspotUser)
					cancel()

					if err != nil {
						log.Warn().
							Err(err).
							Str("router_id", router.ID.String()).
							Str("router_name", router.Name).
							Str("voucher_code", v.Code).
							Msg("Failed to create Hotspot user on router (voucher still valid, user can be created manually)")
					} else {
						log.Info().
							Str("router_id", router.ID.String()).
							Str("router_name", router.Name).
							Str("voucher_code", v.Code).
							Str("profile", pkg.Name).
							Msg("Successfully created Hotspot user on router")
					}
				}
			}
		}
	}

	return vouchers, nil
}

func (s *VoucherService) ListVouchers(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]*voucher.Voucher, int, error) {
	vouchers, err := s.voucherRepo.ListVouchersByTenant(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	total, err := s.voucherRepo.CountVouchersByTenant(ctx, tenantID)
	if err != nil {
		return nil, 0, err
	}

	return vouchers, total, nil
}

func (s *VoucherService) GetVoucherByCode(ctx context.Context, tenantID uuid.UUID, code string) (*voucher.Voucher, error) {
	return s.voucherRepo.GetVoucherByCode(ctx, tenantID, strings.TrimSpace(code))
}

func (s *VoucherService) ToggleVoucherStatus(ctx context.Context, id uuid.UUID) (*voucher.Voucher, error) {
	// Get current voucher
	v, err := s.voucherRepo.GetVoucherByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Only allow toggle between active and revoked
	// Cannot toggle used or expired vouchers
	if v.Status != voucher.VoucherStatusActive && v.Status != voucher.VoucherStatusRevoked {
		return nil, fmt.Errorf("cannot toggle status for voucher with status: %s", v.Status)
	}

	// Toggle status: active <-> revoked
	newStatus := voucher.VoucherStatusRevoked
	if v.Status == voucher.VoucherStatusRevoked {
		newStatus = voucher.VoucherStatusActive
	}

	// Update status
	if err := s.voucherRepo.UpdateVoucherStatus(ctx, id, newStatus); err != nil {
		return nil, err
	}

	// Return updated voucher
	v.Status = newStatus
	return v, nil
}

func (s *VoucherService) ToggleIsolate(ctx context.Context, id uuid.UUID) (*voucher.Voucher, error) {
	// Toggle isolated status in database
	v, err := s.voucherRepo.ToggleIsolate(ctx, id)
	if err != nil {
		return nil, err
	}

	// MikroTik integration
	var targetRouters []*network.Router

	if v.RouterID != nil {
		// Specific router
		router, err := s.routerRepo.GetByID(ctx, *v.RouterID)
		if err != nil {
			log.Warn().
				Err(err).
				Str("voucher_id", v.ID.String()).
				Str("router_id", v.RouterID.String()).
				Msg("Failed to get router for isolir, skipping MikroTik integration")
		} else {
			targetRouters = []*network.Router{router}
		}
	} else {
		// "All Routers" - scan all tenant routers to find active session
		log.Info().
			Str("voucher_code", v.Code).
			Msg("Voucher has no specific router, scanning all tenant routers")

		routers, err := s.routerRepo.ListByTenant(ctx, v.TenantID)
		if err != nil {
			log.Error().
				Err(err).
				Str("voucher_code", v.Code).
				Msg("Failed to get tenant routers for isolir")
		} else {
			targetRouters = routers
		}
	}

	// Process each router
	for _, router := range targetRouters {
		addr := fmt.Sprintf("%s:%d", router.Host, router.APIPort)

		if v.Isolated {
			// ISOLATE: Add to address-list and disconnect session
			log.Info().
				Str("voucher_code", v.Code).
				Str("router", router.Name).
				Msg("Attempting to isolate user on MikroTik")

			// Get user's IP address from active Hotspot session
			userIP, err := mikrotik.GetHotspotUserIP(
				ctx,
				addr,
				router.APIUseTLS,
				router.Username,
				router.Password,
				v.Code, // Hotspot username = voucher code
			)
			if err != nil {
				log.Debug().
					Err(err).
					Str("voucher_code", v.Code).
					Str("router", router.Name).
					Msg("User not active on this router, skipping")
				continue // Try next router
			}

			// Add IP to isolated address-list
			comment := fmt.Sprintf("voucher:%s", v.Code)
			err = mikrotik.AddToIsolatedList(
				ctx,
				addr,
				router.APIUseTLS,
				router.Username,
				router.Password,
				userIP,
				comment,
			)
			if err != nil {
				log.Error().
					Err(err).
					Str("voucher_code", v.Code).
					Str("router", router.Name).
					Str("user_ip", userIP).
					Msg("Failed to add user to isolated list")
			} else {
				log.Info().
					Str("voucher_code", v.Code).
					Str("router", router.Name).
					Str("user_ip", userIP).
					Msg("User added to isolated address-list")
			}

			// Disconnect active Hotspot session to force re-auth
			err = mikrotik.DisconnectHotspotUser(
				ctx,
				addr,
				router.APIUseTLS,
				router.Username,
				router.Password,
				v.Code,
			)
			if err != nil {
				log.Warn().
					Err(err).
					Str("voucher_code", v.Code).
					Str("router", router.Name).
					Msg("Failed to disconnect Hotspot session")
			} else {
				log.Info().
					Str("voucher_code", v.Code).
					Str("router", router.Name).
					Msg("Hotspot session disconnected")
			}

		} else {
			// UN-ISOLATE: Remove from address-list using comment (no need for IP)
			log.Info().
				Str("voucher_code", v.Code).
				Str("router", router.Name).
				Msg("Un-isolating user on MikroTik")

			// Remove from isolated address-list by comment (voucher:CODE)
			comment := fmt.Sprintf("voucher:%s", v.Code)
			err := mikrotik.RemoveFromIsolatedList(
				ctx,
				addr,
				router.APIUseTLS,
				router.Username,
				router.Password,
				comment,
			)
			if err != nil {
				log.Warn().
					Err(err).
					Str("voucher_code", v.Code).
					Str("router", router.Name).
					Msg("Failed to remove user from isolated list on this router")
			} else {
				log.Info().
					Str("voucher_code", v.Code).
					Str("router", router.Name).
					Msg("User removed from isolated address-list")
			}
		}
	}

	log.Info().
		Str("voucher_id", v.ID.String()).
		Str("code", v.Code).
		Bool("isolated", v.Isolated).
		Msg("Voucher isolation status toggled")

	return v, nil
}

func (s *VoucherService) DeleteVoucher(ctx context.Context, id uuid.UUID) error {
	return s.voucherRepo.DeleteVoucher(ctx, id)
}

// ValidateVoucherForAuth checks if voucher can be used for authentication
func (s *VoucherService) ValidateVoucherForAuth(ctx context.Context, tenantID uuid.UUID, code string) (*voucher.Voucher, error) {
	code = strings.TrimSpace(code)
	v, err := s.voucherRepo.GetVoucherByCode(ctx, tenantID, code)
	if err != nil {
		return nil, fmt.Errorf("voucher not found: %w", err)
	}

	// Check isolation FIRST - isolated users cannot login
	if v.Isolated {
		log.Warn().
			Str("voucher_code", v.Code).
			Msg("Login attempt blocked: voucher is isolated")
		return nil, fmt.Errorf("access denied: account suspended")
	}

	// Check expiration FIRST (before status check)
	if v.ExpiresAt != nil && time.Now().After(*v.ExpiresAt) {
		// Mark as expired
		v.Status = voucher.VoucherStatusExpired
		v.UpdatedAt = time.Now()
		_ = s.voucherRepo.UpdateVoucher(ctx, v)
		return nil, fmt.Errorf("voucher expired")
	}

	// Allow reuse if voucher is 'used' but not expired and no active session
	if v.Status == voucher.VoucherStatusUsed {
		hasActive, err := s.radiusRepo.HasActiveSession(ctx, v.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to check active session: %w", err)
		}
		if hasActive {
			return nil, fmt.Errorf("voucher is currently in use")
		}
		// No active session → Allow reuse
		return v, nil
	}

	// Normal flow: Check status for 'active'
	if v.Status != voucher.VoucherStatusActive {
		return nil, fmt.Errorf("voucher is %s", v.Status)
	}

	return v, nil
}

// ConsumeVoucherForAuth validates and atomically marks voucher as used
// This should be called AFTER password validation to prevent burning voucher on wrong password
// Returns the consumed voucher or error if validation fails or voucher already used
func (s *VoucherService) ConsumeVoucherForAuth(
	ctx context.Context,
	tenantID uuid.UUID,
	code string,
) (*voucher.Voucher, error) {
	v, err := s.voucherRepo.GetVoucherByCode(ctx, tenantID, code)
	if err != nil {
		return nil, err
	}

	if v.Status != voucher.VoucherStatusActive {
		return nil, fmt.Errorf("voucher already %s", v.Status)
	}

	now := time.Now()
	var expiresAt *time.Time

	if pkg, err := s.voucherRepo.GetPackageByID(ctx, v.PackageID); err == nil {
		if pkg.DurationHours != nil {
			exp := now.Add(time.Duration(*pkg.DurationHours) * time.Hour)
			expiresAt = &exp
		}
	}

	return s.voucherRepo.ConsumeVoucherAtomic(
		ctx,
		tenantID,
		code,
		now,
		expiresAt,
	)
}

// generateRandomFromCharset creates a random string using the provided charset and length
func generateRandomFromCharset(charset string, length int) (string, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}

	for i := 0; i < length; i++ {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b), nil
}

// ParseMikhmonDuration converts string formats like 2h, 2H, 2j, 2M, 2B to hours
func ParseMikhmonDuration(d string) (int, error) {
	d = strings.TrimSpace(strings.ToUpper(d))
	if d == "" {
		return 0, fmt.Errorf("empty duration")
	}

	re := regexp.MustCompile(`^(\d+)([HJMB])$`)
	matches := re.FindStringSubmatch(d)
	if len(matches) != 3 {
		return 0, fmt.Errorf("invalid duration format")
	}

	value, _ := strconv.Atoi(matches[1])
	unit := matches[2]

	switch unit {
	case "J": // Jam (Hour)
		return value, nil
	case "H": // Hari (Day)
		return value * 24, nil
	case "M": // Minggu (Week)
		return value * 24 * 7, nil
	case "B": // Bulan (Month)
		return value * 24 * 30, nil
	default:
		return value, nil
	}
}

// ========== MikroTik Hotspot Profile Sync ==========

// syncPackageToAllRouters syncs a package to all active MikroTik routers for the tenant
func (s *VoucherService) syncPackageToAllRouters(ctx context.Context, tenantID uuid.UUID, pkg *voucher.VoucherPackage) error {
	// Get all routers for tenant
	routers, err := s.routerRepo.ListByTenant(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("failed to list routers: %w", err)
	}

	var syncErrors []string
	for _, router := range routers {
		// Only sync to active MikroTik routers
		if router.Type != network.RouterTypeMikroTik {
			continue
		}
		if router.Status != network.RouterStatusOnline {
			log.Debug().
				Str("router_id", router.ID.String()).
				Str("router_name", router.Name).
				Str("router_status", string(router.Status)).
				Msg("Voucher Service: Skipping router (not online)")
			continue
		}

		if err := s.syncPackageToRouter(ctx, router, pkg); err != nil {
			syncErrors = append(syncErrors, fmt.Sprintf("router %s (%s): %v", router.Name, router.Host, err))
			log.Warn().
				Str("package_id", pkg.ID.String()).
				Str("package_name", pkg.Name).
				Str("router_id", router.ID.String()).
				Str("router_name", router.Name).
				Err(err).
				Msg("Voucher Service: Failed to sync package to router")
		}
	}

	if len(syncErrors) > 0 {
		return fmt.Errorf("sync failed for some routers: %s", strings.Join(syncErrors, "; "))
	}

	return nil
}

// syncPackageToRouter syncs a package to a specific router
func (s *VoucherService) syncPackageToRouter(ctx context.Context, router *network.Router, pkg *voucher.VoucherPackage) error {
	addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))

	// Convert package to Hotspot profile
	hotspotProfile := convertToHotspotProfile(pkg)

	log.Info().
		Str("package_id", pkg.ID.String()).
		Str("package_name", pkg.Name).
		Str("router_id", router.ID.String()).
		Str("router_name", router.Name).
		Str("router_address", addr).
		Str("hotspot_profile_name", hotspotProfile.Name).
		Str("hotspot_rate_limit", hotspotProfile.RateLimit).
		Msg("Voucher Service: Syncing package to router")

	// Create a timeout context to prevent hanging on unreachable routers
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Check if profile exists
	profileID, err := mikrotik.FindHotspotUserProfileID(timeoutCtx, addr, router.APIUseTLS, router.Username, router.Password, hotspotProfile.Name)
	if err != nil {
		// Profile doesn't exist, create it
		log.Info().
			Str("package_id", pkg.ID.String()).
			Str("package_name", pkg.Name).
			Str("router_id", router.ID.String()).
			Str("router_name", router.Name).
			Msg("Voucher Service: Creating new Hotspot profile on router")

		if err := mikrotik.AddHotspotUserProfile(timeoutCtx, addr, router.APIUseTLS, router.Username, router.Password, hotspotProfile); err != nil {
			return fmt.Errorf("failed to create Hotspot profile: %w", err)
		}
	} else {
		// Profile exists, update it
		log.Info().
			Str("package_id", pkg.ID.String()).
			Str("package_name", pkg.Name).
			Str("router_id", router.ID.String()).
			Str("router_name", router.Name).
			Str("profile_id", profileID).
			Msg("Voucher Service: Updating existing Hotspot profile on router")

		if err := mikrotik.UpdateHotspotUserProfile(timeoutCtx, addr, router.APIUseTLS, router.Username, router.Password, profileID, hotspotProfile); err != nil {
			return fmt.Errorf("failed to update Hotspot profile: %w", err)
		}
	}

	log.Info().
		Str("package_id", pkg.ID.String()).
		Str("package_name", pkg.Name).
		Str("router_id", router.ID.String()).
		Str("router_name", router.Name).
		Msg("Voucher Service: Successfully synced package to router")

	return nil
}

// removePackageFromAllRouters removes Hotspot profiles from all routers
func (s *VoucherService) removePackageFromAllRouters(ctx context.Context, tenantID uuid.UUID, pkg *voucher.VoucherPackage) error {
	routers, err := s.routerRepo.ListByTenant(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("failed to list routers: %w", err)
	}

	var removeErrors []string
	for _, router := range routers {
		if router.Type != network.RouterTypeMikroTik {
			continue
		}

		if err := s.removePackageFromRouter(ctx, router, pkg); err != nil {
			removeErrors = append(removeErrors, fmt.Sprintf("router %s (%s): %v", router.Name, router.Host, err))
			log.Warn().
				Str("package_id", pkg.ID.String()).
				Str("package_name", pkg.Name).
				Str("router_id", router.ID.String()).
				Str("router_name", router.Name).
				Err(err).
				Msg("Voucher Service: Failed to remove package profile from router")
		}
	}

	if len(removeErrors) > 0 {
		return fmt.Errorf("removal failed for some routers: %s", strings.Join(removeErrors, "; "))
	}

	return nil
}

// removePackageFromRouter removes Hotspot profile from a specific router
func (s *VoucherService) removePackageFromRouter(ctx context.Context, router *network.Router, pkg *voucher.VoucherPackage) error {
	addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))

	log.Info().
		Str("package_id", pkg.ID.String()).
		Str("package_name", pkg.Name).
		Str("router_id", router.ID.String()).
		Str("router_name", router.Name).
		Msg("Voucher Service: Removing Hotspot profile from router")

	// Create a timeout context to prevent hanging on unreachable routers
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := mikrotik.RemoveHotspotUserProfile(timeoutCtx, addr, router.APIUseTLS, router.Username, router.Password, pkg.Name); err != nil {
		// If profile doesn't exist, that's okay (might have been deleted manually)
		if strings.Contains(err.Error(), "not found") {
			log.Debug().
				Str("package_id", pkg.ID.String()).
				Str("package_name", pkg.Name).
				Str("router_id", router.ID.String()).
				Msg("Voucher Service: Hotspot profile not found on router (already removed)")
			return nil
		}
		// If timeout or connection error, log but don't fail the deletion
		if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "connection") || strings.Contains(err.Error(), "context") {
			log.Warn().
				Str("package_id", pkg.ID.String()).
				Str("package_name", pkg.Name).
				Str("router_id", router.ID.String()).
				Err(err).
				Msg("Voucher Service: Router unreachable, skipping profile removal")
			return nil // Don't fail deletion if router is unreachable
		}
		return fmt.Errorf("failed to remove Hotspot profile: %w", err)
	}

	return nil
}

// convertToHotspotProfile converts VoucherPackage to MikroTik HotspotUserProfile
func convertToHotspotProfile(pkg *voucher.VoucherPackage) mikrotik.HotspotUserProfile {
	// Format rate limit: "2048k/1024k" (Kbps with 'k' suffix)
	rateLimit := fmt.Sprintf("%dk/%dk", pkg.DownloadSpeed, pkg.UploadSpeed)

	profile := mikrotik.HotspotUserProfile{
		Name:        pkg.Name,
		RateLimit:   rateLimit,
		SharedUsers: 1, // Default to 1 user per profile
		Comment:     fmt.Sprintf("RRNET Package: %s", pkg.Name),
	}

	if pkg.Description != "" {
		profile.Comment = pkg.Description
	}

	return profile
}

// SyncPackageToRouters syncs a package to specific routers (for manual sync)
func (s *VoucherService) SyncPackageToRouters(ctx context.Context, packageID uuid.UUID, routerIDs []uuid.UUID) error {
	pkg, err := s.voucherRepo.GetPackageByID(ctx, packageID)
	if err != nil {
		return fmt.Errorf("package not found: %w", err)
	}

	if pkg.RateLimitMode != voucher.RateLimitModeAuthOnly {
		return fmt.Errorf("sync only supported for radius_auth_only mode")
	}

	var syncErrors []string
	for _, routerID := range routerIDs {
		router, err := s.routerRepo.GetByID(ctx, routerID)
		if err != nil {
			syncErrors = append(syncErrors, fmt.Sprintf("router %s: not found", routerID.String()))
			continue
		}

		if router.Type != network.RouterTypeMikroTik {
			syncErrors = append(syncErrors, fmt.Sprintf("router %s: not MikroTik", router.Name))
			continue
		}

		if err := s.syncPackageToRouter(ctx, router, pkg); err != nil {
			syncErrors = append(syncErrors, fmt.Sprintf("router %s: %v", router.Name, err))
		}
	}

	if len(syncErrors) > 0 {
		return fmt.Errorf("sync failed for some routers: %s", strings.Join(syncErrors, "; "))
	}

	return nil
}
