package service

import (
	"context"
	"crypto/rand"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog/log"

	"regexp"
	"rrnet/internal/domain/network"
	"rrnet/internal/domain/radius"
	"rrnet/internal/domain/voucher"
	"rrnet/internal/infra/mikrotik"
	"rrnet/internal/repository"
)

type VoucherService struct {
	voucherRepo    *repository.VoucherRepository
	radiusRepo     *repository.RadiusRepository
	routerRepo     *repository.RouterRepository
	financeService *FinanceService
	limitResolver  *LimitResolver
	redis          *redis.Client
}

func NewVoucherService(
	voucherRepo *repository.VoucherRepository,
	radiusRepo *repository.RadiusRepository,
	routerRepo *repository.RouterRepository,
	financeService *FinanceService,
	limitResolver *LimitResolver,
	redisClient ...*redis.Client,
) *VoucherService {
	svc := &VoucherService{
		voucherRepo:   voucherRepo,
		radiusRepo:    radiusRepo,
		routerRepo:    routerRepo,
		financeService: financeService,
		limitResolver:  limitResolver,
	}
	if len(redisClient) > 0 {
		svc.redis = redisClient[0]
	}
	return svc
}

// VoucherRepo exposes the underlying repository for handler access
func (s *VoucherService) VoucherRepo() *repository.VoucherRepository {
	return s.voucherRepo
}

// ========== Voucher Packages ==========

type CreateVoucherPackageRequest struct {
	Name           string  `json:"name"`
	Description    string  `json:"description,omitempty"`
	DownloadSpeed  int     `json:"download_speed"`
	UploadSpeed    int     `json:"upload_speed"`
	DurationHours  *int    `json:"duration_hours,omitempty"`
	Validity       string  `json:"validity,omitempty"` // Mikhmon format: 1j, 1h, 1d, etc.
	QuotaMB        *int    `json:"quota_mb,omitempty"`
	Price          float64 `json:"price"`
	Currency       string  `json:"currency,omitempty"`
	RateLimitMode  string  `json:"rate_limit_mode,omitempty"`  // full_radius or radius_auth_only
	ExpirationMode string  `json:"expiration_mode,omitempty"` // wall_clock or uptime_limit
}

func (s *VoucherService) CreatePackage(ctx context.Context, tenantID uuid.UUID, req CreateVoucherPackageRequest) (*voucher.VoucherPackage, error) {
	now := time.Now()

	// Parse Mikhmon duration if provided
	durationHours := req.DurationHours
	if req.Validity != "" {
		parsed, err := ParseMikhmonDuration(req.Validity)
		if err != nil {
			return nil, fmt.Errorf("format Batas Waktu (validity) tidak valid: %s (contoh: 1h, 1j, 1d, 1w)", req.Validity)
		}
		durationHours = &parsed
	}

	// Set default rate limit mode if not provided
	rateLimitMode := req.RateLimitMode
	if rateLimitMode == "" {
		rateLimitMode = voucher.RateLimitModeAuthOnly // Default to MVP mode
	}
	if rateLimitMode != voucher.RateLimitModeFullRadius && rateLimitMode != voucher.RateLimitModeAuthOnly {
		return nil, fmt.Errorf("invalid rate_limit_mode: %s (must be 'full_radius' or 'radius_auth_only')", rateLimitMode)
	}

	// Set expiration mode (default: wall_clock)
	expirationMode := req.ExpirationMode
	if expirationMode == "" {
		expirationMode = "wall_clock"
	}

	// If uptime_limit mode, MaxUptimeSeconds = DurationHours * 3600
	// ExpiresAt will NOT be set by accounting (timer only counts online time)
	var maxUptimeSeconds *int
	if expirationMode == "uptime_limit" && durationHours != nil {
		m := (*durationHours) * 3600
		maxUptimeSeconds = &m
	}

	pkg := &voucher.VoucherPackage{
		ID:               uuid.New(),
		TenantID:         tenantID,
		Name:             req.Name,
		Description:      req.Description,
		DownloadSpeed:    req.DownloadSpeed,
		UploadSpeed:      req.UploadSpeed,
		DurationHours:    durationHours,
		QuotaMB:          req.QuotaMB,
		Price:            req.Price,
		Currency:         req.Currency,
		RateLimitMode:    rateLimitMode,
		ExpirationMode:   expirationMode,
		MaxUptimeSeconds: maxUptimeSeconds,
		IsActive:         true,
		CreatedAt:        now,
		UpdatedAt:        now,
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
	Name           string  `json:"name,omitempty"`
	Description    string  `json:"description,omitempty"`
	DownloadSpeed  int     `json:"download_speed,omitempty"`
	UploadSpeed    int     `json:"upload_speed,omitempty"`
	DurationHours  *int    `json:"duration_hours,omitempty"`
	Validity       string  `json:"validity,omitempty"`
	QuotaMB        *int    `json:"quota_mb,omitempty"`
	Price          float64 `json:"price,omitempty"`
	Currency       string  `json:"currency,omitempty"`
	RateLimitMode  string  `json:"rate_limit_mode,omitempty"`
	ExpirationMode string  `json:"expiration_mode,omitempty"` // wall_clock or uptime_limit
	IsActive       *bool   `json:"is_active,omitempty"`
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
		if err != nil {
			return nil, fmt.Errorf("format Batas Waktu (validity) tidak valid: %v", err)
		}
		pkg.DurationHours = &parsed
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
	
	if req.ExpirationMode != "" {
		pkg.ExpirationMode = req.ExpirationMode
	}
	
	// Recalculate MaxUptimeSeconds if mode is uptime_limit
	if pkg.ExpirationMode == "uptime_limit" && pkg.DurationHours != nil {
		m := (*pkg.DurationHours) * 3600
		pkg.MaxUptimeSeconds = &m
	} else {
		pkg.MaxUptimeSeconds = nil
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
	PackageID          uuid.UUID  `json:"package_id"`
	RouterID           *uuid.UUID `json:"router_id,omitempty"`
	Quantity           int        `json:"quantity"`
	ExpiresAt          *time.Time `json:"expires_at,omitempty"`
	UserMode           string     `json:"user_mode,omitempty"`      // "up" (User & Pass), "vc" (User=Pass)
	CharacterMode      string     `json:"character_mode,omitempty"` // "abcd", "ABCD", "aBcD", etc.
	CodeLength         int        `json:"code_length,omitempty"`    // total length
	ResellerPurchaseID *uuid.UUID `json:"reseller_purchase_id,omitempty"`
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

type CreateVoucherRequest struct {
	PackageID   uuid.UUID  `json:"package_id"`
	RouterID    *uuid.UUID `json:"router_id,omitempty"`
	Code        string     `json:"code"`
	Password    string     `json:"password"`
	Notes       string     `json:"notes,omitempty"`
	SharedUsers int        `json:"shared_users,omitempty"`
}

func (s *VoucherService) CreateVoucher(ctx context.Context, tenantID uuid.UUID, req CreateVoucherRequest) (*voucher.Voucher, error) {
	// 0. Enforce Limit
	currentCount, err := s.voucherRepo.CountVouchersByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if !s.limitResolver.CanAdd(ctx, tenantID, "max_vouchers", currentCount, 1) {
		return nil, fmt.Errorf("voucher limit reached for this plan")
	}

	// 1. Validate package exists
	pkg, err := s.voucherRepo.GetPackageByID(ctx, req.PackageID)
	if err != nil {
		return nil, fmt.Errorf("package not found: %w", err)
	}

	now := time.Now()
	v := &voucher.Voucher{
		ID:          uuid.New(),
		TenantID:    tenantID,
		PackageID:   req.PackageID,
		RouterID:    req.RouterID,
		Code:        req.Code,
		Password:    req.Password,
		Status:      voucher.VoucherStatusActive,
		Notes:       req.Notes,
		SharedUsers: req.SharedUsers,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.voucherRepo.CreateVoucher(ctx, v); err != nil {
		return nil, fmt.Errorf("failed to create voucher: %w", err)
	}

	// For radius_auth_only mode, create Hotspot user on the router(s)
	if pkg.RateLimitMode == "radius_auth_only" {
		if req.RouterID != nil {
			// Sync to specific router
			router, err := s.routerRepo.GetByID(ctx, *req.RouterID)
			if err == nil && router.Status == network.RouterStatusOnline {
				addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
				hotspotUser := mikrotik.HotspotUser{
					Name:        v.Code,
					Password:    v.Password,
					Profile:     pkg.Name,
					Comment:     fmt.Sprintf("RRNET Voucher - Created %s", now.Format("2006-01-02 15:04:05")),
					SharedUsers: v.SharedUsers,
				}
				userCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
				defer cancel()
				_ = mikrotik.AddHotspotUser(userCtx, addr, router.APIUseTLS, router.Username, router.Password, hotspotUser)
			}
		} else {
			// Sync to all routers for this tenant
			routers, err := s.routerRepo.ListByTenant(ctx, tenantID)
			if err == nil {
				for _, router := range routers {
					if router.Status != network.RouterStatusOnline {
						continue
					}
					addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
					hotspotUser := mikrotik.HotspotUser{
						Name:     v.Code,
						Password: v.Password,
						Profile:  pkg.Name,
						Comment:  fmt.Sprintf("RRNET Voucher - Created %s", now.Format("2006-01-02 15:04:05")),
					}
					userCtx, cancel := context.WithTimeout(ctx, 10*time.Second) // Shorter timeout per router when syncing all
					err := mikrotik.AddHotspotUser(userCtx, addr, router.APIUseTLS, router.Username, router.Password, hotspotUser)
					cancel()
					if err != nil {
						log.Warn().Err(err).Str("router", router.Name).Msg("Failed to sync Hotspot user to router during all-router sync")
					}
				}
			}
		}
	}

	return v, nil
}

// batchInsertChunk inserts a slice of vouchers atomically using a pgx transaction batch.
func (s *VoucherService) batchInsertChunk(ctx context.Context, vouchers []*voucher.Voucher) error {
	if len(vouchers) == 0 {
		return nil
	}
	
	db := s.voucherRepo.DB()
	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	const insertQuery = `
		INSERT INTO vouchers (
			id, tenant_id, package_id, router_id, code, password, status,
			used_at, expires_at, first_session_id, notes, shared_users, reseller_purchase_id, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`

	batch := &pgx.Batch{}
	for _, v := range vouchers {
		batch.Queue(insertQuery,
			v.ID, v.TenantID, v.PackageID, v.RouterID, v.Code, v.Password, v.Status,
			v.UsedAt, v.ExpiresAt, v.FirstSessionID, v.Notes, v.SharedUsers,
			v.ResellerPurchaseID, v.CreatedAt, v.UpdatedAt,
		)
	}

	br := tx.SendBatch(ctx, batch)
	if err := br.Close(); err != nil {
		log.Error().Err(err).Msg("Voucher Service: Batch insert chunk failed")
		return fmt.Errorf("batch insert chunk failed: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error().Err(err).Msg("Voucher Service: Failed to commit voucher chunk transaction")
		return err
	}
	
	return nil
}

func (s *VoucherService) GenerateVouchers(ctx context.Context, tenantID uuid.UUID, req GenerateVouchersRequest) ([]*voucher.Voucher, error) {
	// 0. Enforce Limit
	currentCount, err := s.voucherRepo.CountVouchersByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if !s.limitResolver.CanAdd(ctx, tenantID, "max_vouchers", currentCount, req.Quantity) {
		return nil, fmt.Errorf("voucher limit reached for this plan (cannot add %d more)", req.Quantity)
	}

	// 1. Validate package exists and get package details
	pkg, err := s.voucherRepo.GetPackageByID(ctx, req.PackageID)
	if err != nil {
		return nil, fmt.Errorf("package not found: %w", err)
	}

	// Support up to 10.000 vouchers per request
	if req.Quantity <= 0 || req.Quantity > 10000 {
		return nil, fmt.Errorf("quantity must be between 1 and 10000")
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

	// 2. Generate batch notes (4-character random code)
	batchNotes, err := generateRandomFromCharset("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 4)
	if err != nil {
		return nil, fmt.Errorf("failed to generate batch notes: %w", err)
	}

	userMode := req.UserMode
	if userMode == "" {
		userMode = "up"
	}

	// 3. Generate random vouchers with multi-layer collision detection
	// In-memory map as primary (O(1)), Redis as secondary guard for extra safety
	batchCodes := make(map[string]struct{}, req.Quantity)
	vouchers := make([]*voucher.Voucher, 0, req.Quantity)
	now := time.Now()

	// Redis key untuk deduplikasi intra-batch (opsional, lebih aman)
	redisKey := fmt.Sprintf("vgen:%s:%s", tenantID, batchNotes)
	useRedis := s.redis != nil
	if useRedis {
		s.redis.Expire(ctx, redisKey, 15*time.Minute)
	}

	const maxRetries = 10
	for i := 0; i < req.Quantity; i++ {
		var code, password string
		var genErr error
		var generated bool

		for attempt := 0; attempt < maxRetries; attempt++ {
			code, genErr = generateRandomFromCharset(charset, codeLength)
			if genErr != nil {
				return nil, genErr
			}

			// Layer 1: In-memory check
			if _, exists := batchCodes[code]; exists {
				continue
			}

			// Layer 2: Redis check (for concurrent batches)
			if useRedis {
				added, redisErr := s.redis.SAdd(ctx, redisKey, code).Result()
				if redisErr != nil || added == 0 {
					continue
				}
			}

			// Layer 3: Database check (against ALL existing vouchers)
			existsInDB, err := s.voucherRepo.ExistsByCode(ctx, tenantID, code)
			if err != nil {
				log.Error().Err(err).Str("code", code).Msg("Voucher Service: Failed to check code existence in DB")
				continue
			}
			if existsInDB {
				continue
			}

			// Unique code found!
			if userMode == "up" {
				password, genErr = generateRandomFromCharset("0123456789", codeLength)
				if genErr != nil {
					return nil, genErr
				}
			} else {
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
				Notes:     batchNotes,
				CreatedAt: now,
				UpdatedAt: now,
			}

			vouchers = append(vouchers, v)
			batchCodes[code] = struct{}{}
			generated = true
			break
		}

		if !generated {
			return nil, fmt.Errorf("failed to generate unique code for voucher #%d after %d attempts (charset may be too small)", i+1, maxRetries)
		}
	}

	// Cleanup Redis key in background
	if useRedis {
		go s.redis.Del(context.Background(), redisKey)
	}

	// 4. CHUNKED ATOMIC Batch Insert
	const chunkSize = 500
	for start := 0; start < len(vouchers); start += chunkSize {
		end := start + chunkSize
		if end > len(vouchers) {
			end = len(vouchers)
		}
		chunk := vouchers[start:end]
		if err := s.batchInsertChunk(ctx, chunk); err != nil {
			log.Error().Err(err).Int("start", start).Int("end", end).Msg("Voucher Service: GenerateVouchers failed during chunk insertion")
			return nil, err
		}
	}

	// 5. ASYNCHRONOUS Parallel MikroTik Sync
	// This prevents the main request from timing out while connecting to external hardware
	if pkg.RateLimitMode == "radius_auth_only" {
		go func(vList []*voucher.Voucher, p *voucher.VoucherPackage, tID uuid.UUID, rID *uuid.UUID) {
			// Use background context for long-running task
			bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			log.Info().
				Str("package_id", p.ID.String()).
				Int("count", len(vList)).
				Msg("Voucher Service: Starting background parallel sync to routers")

			var targetRouters []*network.Router
			if rID != nil {
				target, err := s.routerRepo.GetByID(bgCtx, *rID)
				if err == nil {
					targetRouters = []*network.Router{target}
				}
			} else {
				targetRouters, _ = s.routerRepo.ListByTenant(bgCtx, tID)
			}

			for _, router := range targetRouters {
				if router.Status != network.RouterStatusOnline || router.Type != network.RouterTypeMikroTik {
					continue
				}

				addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
				
				// Sync each voucher to this router
				// We can optimize this further with a worker pool if needed, 
				// but backgrounding is already a huge improvement.
				for _, v := range vList {
					hotspotUser := mikrotik.HotspotUser{
						Name:     v.Code,
						Password: v.Password,
						Profile:  p.Name,
						Comment:  fmt.Sprintf("RRNET Voucher - Generated %s", now.Format("2006-01-02 15:04:05")),
					}

					syncCtx, syncCancel := context.WithTimeout(bgCtx, 10*time.Second)
					_ = mikrotik.AddHotspotUser(syncCtx, addr, router.APIUseTLS, router.Username, router.Password, hotspotUser)
					syncCancel()
				}
			}
			log.Info().Str("batch_notes", batchNotes).Msg("Voucher Service: Background parallel sync completed")
		}(vouchers, pkg, tenantID, req.RouterID)
	}

	return vouchers, nil
}

func (s *VoucherService) GetVouchersByPurchase(ctx context.Context, purchaseID uuid.UUID) ([]*voucher.Voucher, error) {
	return s.voucherRepo.ListVouchersByPurchase(ctx, purchaseID)
}

func (s *VoucherService) DeleteVouchersByPurchase(ctx context.Context, tenantID, purchaseID uuid.UUID) error {
	// 1. Get vouchers to clean up from MikroTik if needed
	vouchers, err := s.voucherRepo.ListVouchersByPurchase(ctx, purchaseID)
	if err != nil {
		return err
	}

	if len(vouchers) == 0 {
		return nil
	}

	// 2. Check if we need to cleanup MikroTik (Backgrounding)
	pkg, err := s.voucherRepo.GetPackageByID(ctx, vouchers[0].PackageID)
	if err == nil && pkg.RateLimitMode == "radius_auth_only" {
		go func(vList []*voucher.Voucher, tID uuid.UUID) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			// Group vouchers by RouterID for efficient cleanup
			routerVouchers := make(map[uuid.UUID][]string)
			var routersToCleanup []uuid.UUID

			hasGlobalVouchers := false
			for _, v := range vList {
				if v.RouterID != nil {
					routerVouchers[*v.RouterID] = append(routerVouchers[*v.RouterID], v.Code)
					// Keep track of unique routers
					found := false
					for _, rid := range routersToCleanup {
						if rid == *v.RouterID {
							found = true
							break
						}
					}
					if !found {
						routersToCleanup = append(routersToCleanup, *v.RouterID)
					}
				} else {
					hasGlobalVouchers = true
				}
			}

			// 2a. Cleanup from specific routers
			for _, rid := range routersToCleanup {
				router, err := s.routerRepo.GetByID(bgCtx, rid)
				if err != nil || router.Status != network.RouterStatusOnline || router.Type != network.RouterTypeMikroTik {
					continue
				}
				addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
				for _, code := range routerVouchers[rid] {
					uCtx, cancel := context.WithTimeout(bgCtx, 2*time.Second)
					_ = mikrotik.RemoveHotspotUser(uCtx, addr, router.APIUseTLS, router.Username, router.Password, code)
					cancel()
				}
			}

			// 2b. Cleanup global vouchers
			if hasGlobalVouchers {
				routers, err := s.routerRepo.ListByTenant(bgCtx, tID)
				if err == nil {
					for _, router := range routers {
						// Skip routers we already cleaned specifically
						isSpecific := false
						for _, rid := range routersToCleanup {
							if rid == router.ID {
								isSpecific = true
								break
							}
						}
						if isSpecific || router.Status != network.RouterStatusOnline || router.Type != network.RouterTypeMikroTik {
							continue
						}
						addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
						for _, v := range vList {
							if v.RouterID == nil {
								uCtx, cancel := context.WithTimeout(bgCtx, 2*time.Second)
								_ = mikrotik.RemoveHotspotUser(uCtx, addr, router.APIUseTLS, router.Username, router.Password, v.Code)
								cancel()
							}
						}
					}
				}
			}
		}(vouchers, tenantID)
	}

	// 3. Delete from DB (Immediate)
	return s.voucherRepo.DeleteVouchersByPurchase(ctx, purchaseID)
}

func (s *VoucherService) ListVouchers(ctx context.Context, tenantID uuid.UUID, limit, offset int, status string, search string) ([]*voucher.Voucher, int, error) {
	return s.voucherRepo.ListVouchersByTenant(ctx, tenantID, limit, offset, status, search)
}

func (s *VoucherService) DeleteBatch(ctx context.Context, tenantID uuid.UUID, createdAt time.Time) error {
	// 1. Get vouchers in this batch to clean up from MikroTik if needed
	vouchers, _, err := s.voucherRepo.ListVouchersByTenant(ctx, tenantID, 1000, 0, "", "")
	if err != nil {
		return err
	}

	var batchVouchers []*voucher.Voucher
	for _, v := range vouchers {
		if v.CreatedAt.Equal(createdAt) {
			batchVouchers = append(batchVouchers, v)
		}
	}

	if len(batchVouchers) == 0 {
		return fmt.Errorf("batch not found or already deleted")
	}

	// 2. Cleanup MikroTik if needed (Backgrounding)
	pkg, err := s.voucherRepo.GetPackageByID(ctx, batchVouchers[0].PackageID)
	if err == nil && pkg.RateLimitMode == "radius_auth_only" {
		go func(vList []*voucher.Voucher, tID uuid.UUID) {
			bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			// Group by router for efficiency
			routerVouchers := make(map[uuid.UUID][]string)
			hasGlobal := false
			
			for _, v := range vList {
				if v.RouterID != nil {
					routerVouchers[*v.RouterID] = append(routerVouchers[*v.RouterID], v.Code)
				} else {
					hasGlobal = true
				}
			}

			// Cleanup specific routers
			for rid, codes := range routerVouchers {
				router, err := s.routerRepo.GetByID(bgCtx, rid)
				if err != nil || router.Status != network.RouterStatusOnline {
					continue
				}
				addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
				for _, code := range codes {
					uCtx, cancel := context.WithTimeout(bgCtx, 2*time.Second)
					_ = mikrotik.RemoveHotspotUser(uCtx, addr, router.APIUseTLS, router.Username, router.Password, code)
					cancel()
				}
			}

			// Cleanup global vouchers
			if hasGlobal {
				routers, _ := s.routerRepo.ListByTenant(bgCtx, tID)
				for _, router := range routers {
					if _, ok := routerVouchers[router.ID]; ok || router.Status != network.RouterStatusOnline {
						continue
					}
					addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
					for _, v := range vList {
						if v.RouterID == nil {
							uCtx, cancel := context.WithTimeout(bgCtx, 2*time.Second)
							_ = mikrotik.RemoveHotspotUser(uCtx, addr, router.APIUseTLS, router.Username, router.Password, v.Code)
							cancel()
						}
					}
				}
			}
		}(batchVouchers, tenantID)
	}

	// 3. Delete from DB (Immediate)
	return s.voucherRepo.DeleteVouchersByCreatedAt(ctx, tenantID, createdAt)
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
	// 1. Get voucher info before deletion so we know which user/router to kick
	v, err := s.voucherRepo.GetVoucherByID(ctx, id)
	if err != nil {
		return err // Already gone or error
	}

	// 2. Perform deletion in DB
	if err := s.voucherRepo.DeleteVoucher(ctx, id); err != nil {
		return err
	}

	// 3. Force disconnect from MikroTik (if assigned to a router)
	// This cleans up active sessions AND cookies so they can't auto-login anymore
	if v.RouterID != nil {
		router, err := s.routerRepo.GetByID(ctx, *v.RouterID)
		if err == nil {
			addr := fmt.Sprintf("%s:%d", router.Host, router.APIPort)
			log.Info().
				Str("voucher_code", v.Code).
				Str("router", router.Name).
				Msg("Voucher deleted: Kicking user from MikroTik and clearing cookies")

			// Non-blocking kick (we don't want to fail the whole delete if router is offline)
			go func() {
				_ = mikrotik.DisconnectHotspotUser(context.Background(), addr, router.APIUseTLS, router.Username, router.Password, v.Code)
			}()
		}
	}

	return nil
}

// ValidateVoucherForAuth checks if voucher can be used for authentication
func (s *VoucherService) ValidateVoucherForAuth(ctx context.Context, tenantID uuid.UUID, code string, macAddress string) (*voucher.Voucher, error) {
	code = strings.TrimSpace(code)
	v, err := s.voucherRepo.GetVoucherByCode(ctx, tenantID, code)
	if err != nil {
		return nil, fmt.Errorf("voucher not found: %w", err)
	}

	// Check wall-clock expiration FIRST
	if v.ExpiresAt != nil && time.Now().After(*v.ExpiresAt) {
		// Mark as expired
		v.Status = voucher.VoucherStatusExpired
		v.UpdatedAt = time.Now()
		_ = s.voucherRepo.UpdateVoucher(ctx, v)
		return nil, fmt.Errorf("voucher expired (validity period ended)")
	}

	// Check uptime limit (Play/Pause)
	if pkg, err := s.voucherRepo.GetPackageByID(ctx, v.PackageID); err == nil && pkg.MaxUptimeSeconds != nil {
		if v.TotalUptimeSeconds >= *pkg.MaxUptimeSeconds {
			// Mark as expired if uptime limit reached
			v.Status = voucher.VoucherStatusExpired
			v.UpdatedAt = time.Now()
			_ = s.voucherRepo.UpdateVoucher(ctx, v)
			return nil, fmt.Errorf("voucher expired (uptime limit reached)")
		}
	}

	// Allow reuse if voucher is 'used' but not expired
	if v.Status == voucher.VoucherStatusUsed {
		activeSessions, err := s.radiusRepo.GetActiveSessionsByVoucher(ctx, v.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to check active sessions: %w", err)
		}

		// Filter out stale sessions (no update in last 7 minutes)
		var validActiveSessions []*radius.Session
		staleThreshold := 7 * time.Minute

		for _, sess := range activeSessions {
			if time.Since(sess.UpdatedAt) > staleThreshold {
				// Mark as stopped in DB so it doesn't clutter active sessions
				_ = s.radiusRepo.CloseSession(ctx, sess.AcctSessionID, "Stale-Cleanup")
				log.Info().
					Str("voucher", v.Code).
					Str("session_id", sess.AcctSessionID).
					Time("last_update", sess.UpdatedAt).
					Msg("Voucher Service: Cleaned up stale session during auth validation")
				continue
			}
			validActiveSessions = append(validActiveSessions, sess)
		}

		// 1. Shared Users Check: If we have room, let them in
		sharedLimit := v.SharedUsers
		if sharedLimit < 1 {
			sharedLimit = 1 // Default to 1
		}

		if len(validActiveSessions) < sharedLimit {
			return v, nil
		}

		// 2. Session Reclaim: If limit reached, allow if it's the SAME device (MAC match)
		if macAddress != "" {
			for _, sess := range validActiveSessions {
				if sess.CallingStationID == macAddress {
					// This is a reconnect/reclaim from the same device, allow it
					log.Info().
						Str("voucher", v.Code).
						Str("mac", macAddress).
						Msg("Voucher Service: Allowing session reclaim for same MAC")
					return v, nil
				}
			}
		}

		return nil, fmt.Errorf("voucher is currently in use (shared users limit reached)")
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
		// Allow if already used but not expired (reuse session)
		if v.Status == voucher.VoucherStatusUsed && (v.ExpiresAt == nil || time.Now().Before(*v.ExpiresAt)) {
			// Continue
		} else {
			return nil, fmt.Errorf("voucher is %s", v.Status)
		}
	}

	// Step 2: Calculate expiration if not already set
	now := time.Now()
	var expiresAt *time.Time

	if pkg, err := s.voucherRepo.GetPackageByID(ctx, v.PackageID); err == nil {
		if pkg.DurationHours != nil {
			exp := now.Add(time.Duration(*pkg.DurationHours) * time.Hour)
			expiresAt = &exp
		}
	}

	// Step 3: Check if it's FIRST usage (transitioning from active to used)
	isFirstUse := v.Status == voucher.VoucherStatusActive

	// Step 4: Consume voucher atomically
	updatedV, err := s.voucherRepo.ConsumeVoucherAtomic(
		ctx,
		tenantID,
		code,
		now,
		expiresAt,
	)

	if err != nil {
		return nil, err
	}

	// Step 5: Record revenue if it's the first use AND NOT a reseller voucher
	// Reseller vouchers have revenue recorded upon purchase
	if isFirstUse && updatedV.ResellerPurchaseID == nil {
		if pkg, err := s.voucherRepo.GetPackageByID(ctx, updatedV.PackageID); err == nil {
			// Record revenue asynchronously or just call it (since it's in a DB tx)
			// Note: RecordVoucherRevenue handles its own DB tx, which might be risky
			// if called inside another repo method, but here it's called after the previous DB operation.
			if recErr := s.financeService.RecordVoucherRevenue(ctx, updatedV, pkg); recErr != nil {
				log.Error().Err(recErr).Str("voucher_code", code).Msg("Failed to record voucher revenue")
			}
		}
	}

	return updatedV, nil
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

// ParseMikhmonDuration converts string formats like 1j, 1h, 1jam, 1hari, 1d, 1w to hours
func ParseMikhmonDuration(d string) (int, error) {
	d = strings.TrimSpace(strings.ToLower(d))
	if d == "" {
		return 0, fmt.Errorf("empty duration")
	}

	// Pattern for <number><unit>
	re := regexp.MustCompile(`^(\d+)\s*(.*)$`)
	matches := re.FindStringSubmatch(d)
	if len(matches) != 3 {
		return 0, fmt.Errorf("format durasi tidak dikenali")
	}

	value, _ := strconv.Atoi(matches[1])
	unit := matches[2]

	switch unit {
	case "j", "jam", "hour", "hours":
		return value, nil
	case "h", "hari", "d", "day", "days":
		return value * 24, nil
	case "m", "minggu", "w", "week", "weeks":
		return value * 24 * 7, nil
	case "b", "bulan", "mo", "month", "months":
		return value * 24 * 30, nil
	default:
		return 0, fmt.Errorf("unit durasi tidak dikenal: %s", unit)
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
	// Format rate limit: "1024k/2048k" (Upload/Download)
	rateLimit := fmt.Sprintf("%dk/%dk", pkg.UploadSpeed, pkg.DownloadSpeed)

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
