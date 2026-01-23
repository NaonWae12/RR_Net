package service

import (
	"context"
	"crypto/rand"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"regexp"
	"rrnet/internal/domain/voucher"
	"rrnet/internal/repository"
)

type VoucherService struct {
	voucherRepo *repository.VoucherRepository
	radiusRepo  *repository.RadiusRepository
}

func NewVoucherService(voucherRepo *repository.VoucherRepository, radiusRepo *repository.RadiusRepository) *VoucherService {
	return &VoucherService{
		voucherRepo: voucherRepo,
		radiusRepo:  radiusRepo,
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
	IsActive      *bool   `json:"is_active,omitempty"`
}

func (s *VoucherService) UpdatePackage(ctx context.Context, id uuid.UUID, req UpdateVoucherPackageRequest) (*voucher.VoucherPackage, error) {
	pkg, err := s.voucherRepo.GetPackageByID(ctx, id)
	if err != nil {
		return nil, err
	}

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
	if req.IsActive != nil {
		pkg.IsActive = *req.IsActive
	}
	pkg.UpdatedAt = time.Now()

	if err := s.voucherRepo.UpdatePackage(ctx, pkg); err != nil {
		return nil, fmt.Errorf("failed to update package: %w", err)
	}

	return pkg, nil
}

func (s *VoucherService) DeletePackage(ctx context.Context, id uuid.UUID) error {
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
	// Validate package exists
	_, err := s.voucherRepo.GetPackageByID(ctx, req.PackageID)
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
