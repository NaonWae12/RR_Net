package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
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
}

func NewVoucherService(voucherRepo *repository.VoucherRepository) *VoucherService {
	return &VoucherService{voucherRepo: voucherRepo}
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
	PackageID  uuid.UUID  `json:"package_id"`
	RouterID   *uuid.UUID `json:"router_id,omitempty"`
	Quantity   int        `json:"quantity"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	CodeLength int        `json:"code_length,omitempty"` // default 8
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
		codeLength = 8
	}

	vouchers := make([]*voucher.Voucher, 0, req.Quantity)
	now := time.Now()

	for i := 0; i < req.Quantity; i++ {
		code, err := generateVoucherCode(codeLength)
		if err != nil {
			return nil, fmt.Errorf("failed to generate voucher code: %w", err)
		}

		v := &voucher.Voucher{
			ID:        uuid.New(),
			TenantID:  tenantID,
			PackageID: req.PackageID,
			RouterID:  req.RouterID,
			Code:      code,
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

// ValidateVoucherForAuth checks if voucher can be used for authentication
func (s *VoucherService) ValidateVoucherForAuth(ctx context.Context, tenantID uuid.UUID, code string) (*voucher.Voucher, error) {
	code = strings.TrimSpace(code)
	v, err := s.voucherRepo.GetVoucherByCode(ctx, tenantID, code)
	if err != nil {
		return nil, fmt.Errorf("voucher not found: %w", err)
	}

	// Check status
	if v.Status != voucher.VoucherStatusActive {
		return nil, fmt.Errorf("voucher is %s", v.Status)
	}

	// Check expiration
	if v.ExpiresAt != nil && time.Now().After(*v.ExpiresAt) {
		// Mark as expired
		v.Status = voucher.VoucherStatusExpired
		v.UpdatedAt = time.Now()
		_ = s.voucherRepo.UpdateVoucher(ctx, v)
		return nil, fmt.Errorf("voucher expired")
	}

	return v, nil
}

// generateVoucherCode creates a random alphanumeric code
func generateVoucherCode(length int) (string, error) {
	bytes := make([]byte, length/2+1)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	code := hex.EncodeToString(bytes)[:length]
	return strings.ToUpper(code), nil
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
