package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/client"
	"rrnet/internal/domain/finance"
	"rrnet/internal/domain/reseller"
	"rrnet/internal/repository"
	"github.com/midtrans/midtrans-go"
	"github.com/rs/zerolog/log"
)

var (
	ErrResellerNotFound        = errors.New("reseller not found")
	ErrResellerAlreadyExists   = errors.New("client is already a reseller")
	ErrInvalidDiscount         = errors.New("invalid discount code")
	ErrResellerDiscountExpired = errors.New("discount code has expired")
	ErrDiscountInactive        = errors.New("discount code is inactive")
	ErrInsufficientBalance     = errors.New("insufficient balance")
)

// ResellerService handles reseller business logic
type ResellerService struct {
	resellerRepo   *repository.ResellerRepository
	clientRepo     *repository.ClientRepository
	discountRepo   *repository.DiscountRepository
	voucherService *VoucherService
	financeService *FinanceService
	midtransService *MidtransService
	tenantService   *TenantService
}

// NewResellerService creates a new reseller service
func NewResellerService(
	resellerRepo *repository.ResellerRepository,
	clientRepo *repository.ClientRepository,
	discountRepo *repository.DiscountRepository,
	voucherService *VoucherService,
	financeService *FinanceService,
	midtransService *MidtransService,
	tenantService *TenantService,
) *ResellerService {
	return &ResellerService{
		resellerRepo:   resellerRepo,
		clientRepo:     clientRepo,
		discountRepo:   discountRepo,
		voucherService: voucherService,
		financeService: financeService,
		midtransService: midtransService,
		tenantService:   tenantService,
	}
}

// GetClientByUserID retrieves a client by their linked UserID
func (s *ResellerService) GetClientByUserID(ctx context.Context, tenantID, userID uuid.UUID) (*client.Client, error) {
	return s.clientRepo.GetByUserID(ctx, tenantID, userID)
}

// UpgradeClientToReseller upgrades an existing client to reseller status
func (s *ResellerService) UpgradeClientToReseller(ctx context.Context, tenantID, clientID uuid.UUID, notes *string) (*reseller.Reseller, error) {
	// Check if client exists
	_, err := s.clientRepo.GetByID(ctx, tenantID, clientID)
	if err != nil {
		return nil, fmt.Errorf("client not found")
	}

	// Check if already a reseller
	existing, err := s.resellerRepo.GetByClientID(ctx, tenantID, clientID)
	if err == nil && existing != nil {
		return nil, ErrResellerAlreadyExists
	}

	// Create reseller
	newReseller := &reseller.Reseller{
		ID:        uuid.New(),
		TenantID:  tenantID,
		ClientID:  clientID,
		Status:    reseller.StatusActive,
		JoinDate:  time.Now(),
		Notes:     notes,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.resellerRepo.Create(ctx, newReseller); err != nil {
		return nil, fmt.Errorf("failed to create reseller: %w", err)
	}

	// Fetch hydrated reseller with client names
	return s.resellerRepo.GetByID(ctx, tenantID, newReseller.ID)
}

// RegisterClientAsReseller registers a client as a reseller with pending status
func (s *ResellerService) RegisterClientAsReseller(ctx context.Context, tenantID, clientID uuid.UUID) (*reseller.Reseller, error) {
	// Check if already a reseller
	existing, err := s.resellerRepo.GetByClientID(ctx, tenantID, clientID)
	if err == nil && existing != nil {
		if existing.Status == reseller.StatusRejected {
			// If rejected, allow re-applying (update status to pending)
			existing.Status = reseller.StatusPending
			existing.UpdatedAt = time.Now()
			if err := s.resellerRepo.Update(ctx, existing); err != nil {
				return nil, fmt.Errorf("failed to re-apply reseller: %w", err)
			}
			return existing, nil
		}
		return existing, ErrResellerAlreadyExists
	}

	// Create reseller with PENDING status
	newReseller := &reseller.Reseller{
		ID:        uuid.New(),
		TenantID:  tenantID,
		ClientID:  clientID,
		Status:    reseller.StatusPending,
		JoinDate:  time.Now(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.resellerRepo.Create(ctx, newReseller); err != nil {
		return nil, fmt.Errorf("failed to register reseller: %w", err)
	}

	return s.resellerRepo.GetByID(ctx, tenantID, newReseller.ID)
}

func (s *ResellerService) GetReseller(ctx context.Context, tenantID, id uuid.UUID) (*reseller.Reseller, error) {
	return s.resellerRepo.GetByID(ctx, tenantID, id)
}

func (s *ResellerService) GetResellerByClientID(ctx context.Context, tenantID, clientID uuid.UUID) (*reseller.Reseller, error) {
	return s.resellerRepo.GetByClientID(ctx, tenantID, clientID)
}

func (s *ResellerService) ListResellers(ctx context.Context, tenantID uuid.UUID, filter reseller.ResellerListFilter) ([]*reseller.Reseller, int64, error) {
	return s.resellerRepo.List(ctx, tenantID, filter)
}

func (s *ResellerService) UpdateResellerStatus(ctx context.Context, tenantID, id uuid.UUID, status reseller.Status) error {
	res, err := s.resellerRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		return ErrResellerNotFound
	}

	res.Status = status
	res.UpdatedAt = time.Now()

	return s.resellerRepo.Update(ctx, res)
}

// SetResellerPrice sets custom pricing for a reseller on a specific package
func (s *ResellerService) SetResellerPrice(ctx context.Context, tenantID, resellerID, packageID uuid.UUID, resellerPrice, retailPrice float64) (*reseller.ResellerPrice, error) {
	// Validate reseller exists
	_, err := s.resellerRepo.GetByID(ctx, tenantID, resellerID)
	if err != nil {
		return nil, ErrResellerNotFound
	}

	// Check if price already exists for THIS specific reseller
	existing, err := s.resellerRepo.GetPrice(ctx, tenantID, resellerID, packageID)
	if err == nil && existing != nil && existing.ResellerID != nil && *existing.ResellerID == resellerID {
		// Update existing specific price
		existing.ResellerPrice = resellerPrice
		existing.RetailPrice = retailPrice
		existing.UpdatedAt = time.Now()
		if err := s.resellerRepo.UpdatePrice(ctx, existing); err != nil {
			return nil, fmt.Errorf("failed to update price: %w", err)
		}
		return existing, nil
	}

	// Create new price
	newPrice := &reseller.ResellerPrice{
		ID:               uuid.New(),
		TenantID:         tenantID,
		ResellerID:       &resellerID,
		VoucherPackageID: packageID,
		ResellerPrice:    resellerPrice,
		RetailPrice:      retailPrice,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := s.resellerRepo.CreatePrice(ctx, newPrice); err != nil {
		return nil, fmt.Errorf("failed to create price: %w", err)
	}

	return newPrice, nil
}

// SetGlobalPrice sets default pricing for all resellers
func (s *ResellerService) SetGlobalPrice(ctx context.Context, tenantID, packageID uuid.UUID, resellerPrice, retailPrice float64) (*reseller.ResellerPrice, error) {
	// Check if already exists
	existing, err := s.resellerRepo.GetGlobalPrice(ctx, tenantID, packageID)
	if err == nil && existing != nil {
		// Update existing
		existing.ResellerPrice = resellerPrice
		existing.RetailPrice = retailPrice
		existing.UpdatedAt = time.Now()
		if err := s.resellerRepo.UpdatePrice(ctx, existing); err != nil {
			return nil, fmt.Errorf("failed to update global price: %w", err)
		}
		return existing, nil
	}

	// Create new price (ResellerID is nil for global)
	newPrice := &reseller.ResellerPrice{
		ID:               uuid.New(),
		TenantID:         tenantID,
		ResellerID:       nil,
		VoucherPackageID: packageID,
		ResellerPrice:    resellerPrice,
		RetailPrice:      retailPrice,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := s.resellerRepo.CreatePrice(ctx, newPrice); err != nil {
		return nil, fmt.Errorf("failed to create global price: %w", err)
	}

	return newPrice, nil
}

func (s *ResellerService) GetGlobalPrices(ctx context.Context, tenantID uuid.UUID) ([]*reseller.ResellerPrice, error) {
	return s.resellerRepo.ListGlobalPrices(ctx, tenantID)
}

func (s *ResellerService) GetResellerPrices(ctx context.Context, tenantID, resellerID uuid.UUID) ([]*reseller.ResellerPrice, error) {
	return s.resellerRepo.ListPrices(ctx, tenantID, resellerID)
}

func (s *ResellerService) DeleteResellerPrice(ctx context.Context, tenantID, priceID uuid.UUID) error {
	return s.resellerRepo.DeletePrice(ctx, tenantID, priceID)
}

// CreatePromoCode creates a new promo code for reseller discounts
func (s *ResellerService) CreatePromoCode(ctx context.Context, tenantID uuid.UUID, code, ruleName string, discountType reseller.DiscountType, value float64, expiresAt *time.Time, discountID *uuid.UUID) (*reseller.ResellerDiscount, error) {
	// If discountID is provided, sync with the base discount rule
	if discountID != nil {
		baseRule, err := s.discountRepo.GetByID(ctx, *discountID, tenantID)
		if err != nil {
			return nil, fmt.Errorf("base discount rule not found: %w", err)
		}

		// Always override with base rule info
		ruleName = baseRule.Name
		if baseRule.Type == "percent" {
			discountType = reseller.DiscountTypePercentage
		} else {
			discountType = reseller.DiscountTypeFixed
		}
		value = baseRule.Value
		expiresAt = baseRule.ExpiresAt
	}

	newDiscount := &reseller.ResellerDiscount{
		ID:            uuid.New(),
		TenantID:      tenantID,
		Code:          code,
		DiscountID:    discountID,
		RuleName:      ruleName,
		DiscountType:  discountType,
		DiscountValue: value,
		Status:        reseller.DiscountStatusActive,
		ExpiresAt:     expiresAt,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := s.resellerRepo.CreateDiscount(ctx, newDiscount); err != nil {
		return nil, fmt.Errorf("failed to create promo code: %w", err)
	}

	return newDiscount, nil
}

func (s *ResellerService) GetPromoCode(ctx context.Context, tenantID uuid.UUID, code string) (*reseller.ResellerDiscount, error) {
	return s.resellerRepo.GetDiscountByCode(ctx, tenantID, code)
}

func (s *ResellerService) ListPromoCodes(ctx context.Context, tenantID uuid.UUID) ([]*reseller.ResellerDiscount, error) {
	return s.resellerRepo.ListDiscounts(ctx, tenantID)
}

func (s *ResellerService) TogglePromoCodeStatus(ctx context.Context, tenantID, discountID uuid.UUID) error {
	target, err := s.resellerRepo.GetDiscountByID(ctx, tenantID, discountID)
	if err != nil {
		return err
	}

	if target.Status == reseller.DiscountStatusActive {
		target.Status = reseller.DiscountStatusInactive
	} else {
		target.Status = reseller.DiscountStatusActive
	}
	target.UpdatedAt = time.Now()

	return s.resellerRepo.UpdateDiscount(ctx, target)
}

func (s *ResellerService) DeletePromoCode(ctx context.Context, tenantID, discountID uuid.UUID) error {
	return s.resellerRepo.DeleteDiscount(ctx, tenantID, discountID)
}

// ProcessPurchase processes a voucher purchase by a reseller
func (s *ResellerService) ProcessPurchase(ctx context.Context, tenantID, resellerID, packageID uuid.UUID, routerID *uuid.UUID, quantity int, paymentMethod string, promoCode *string) (*reseller.ResellerPurchase, error) {
	// Validate reseller
	_, err := s.resellerRepo.GetByID(ctx, tenantID, resellerID)
	if err != nil {
		return nil, ErrResellerNotFound
	}

	// Get reseller price
	price, err := s.resellerRepo.GetPrice(ctx, tenantID, resellerID, packageID)
	if err != nil {
		if errors.Is(err, repository.ErrResellerPriceNotFound) {
			// Fallback to default package price
			pkg, errPkg := s.voucherService.VoucherRepo().GetPackageByID(ctx, packageID)
			if errPkg != nil {
				return nil, fmt.Errorf("package not found: %w", errPkg)
			}
			// Use default price (assume 20% reseller discount if not specified)
			price = &reseller.ResellerPrice{
				VoucherPackageID: pkg.ID,
				RetailPrice:      pkg.Price,
				ResellerPrice:    pkg.Price * 0.8,
			}
		} else {
			return nil, fmt.Errorf("failed to get pricing: %w", err)
		}
	}

	// Calculate subtotal
	subtotal := price.ResellerPrice * float64(quantity)

	// Calculate estimated retail total for margin calculation
	retailTotal := price.RetailPrice * float64(quantity)

	// Apply discount if promo code provided
	var discountAmount float64
	var discountID *uuid.UUID

	if promoCode != nil && *promoCode != "" {
		discount, err := s.resellerRepo.GetDiscountByCode(ctx, tenantID, *promoCode)
		if err != nil {
			return nil, ErrInvalidDiscount
		}

		// Validate discount
		if discount.Status != reseller.DiscountStatusActive {
			return nil, ErrDiscountInactive
		}

		if discount.ExpiresAt != nil {
			// Make expiration inclusive of the entire day (until 23:59:59)
			// Using UTC comparison for consistency if database storage is ambiguous
			now := time.Now().UTC()
			expiryDate := time.Date(discount.ExpiresAt.Year(), discount.ExpiresAt.Month(), discount.ExpiresAt.Day(), 23, 59, 59, 0, time.UTC)

			if now.After(expiryDate) {
				return nil, ErrResellerDiscountExpired
			}
		}

		// Calculate discount
		if discount.DiscountType == reseller.DiscountTypeFixed {
			discountAmount = discount.DiscountValue
		} else {
			discountAmount = subtotal * (discount.DiscountValue / 100)
		}

		discountID = &discount.ID
	}

	// Calculate total
	totalAmount := subtotal - discountAmount
	if totalAmount < 0 {
		totalAmount = 0
	}

	// Calculate margin (Estimated Profit: RetailTotal - TotalAmountPaid)
	margin := retailTotal - totalAmount

	// Determine initial status and deduct amount based on payment method
	status := reseller.PurchaseStatusPending
	var deductAmount float64

	if paymentMethod == "balance" {
		// Verify reseller balance
		r, err := s.resellerRepo.GetByID(ctx, tenantID, resellerID)
		if err != nil {
			return nil, fmt.Errorf("failed to verify reseller: %w", err)
		}
		if r.Balance < totalAmount {
			return nil, ErrInsufficientBalance
		}

		deductAmount = totalAmount
		status = reseller.PurchaseStatusSuccess
	}

	// Create purchase record
	purchase := &reseller.ResellerPurchase{
		ID:               uuid.New(),
		TenantID:         tenantID,
		ResellerID:       resellerID,
		VoucherPackageID: packageID,
		RouterID:         routerID,
		Quantity:         quantity,
		UnitPrice:        price.ResellerPrice,
		Subtotal:         subtotal,
		DiscountID:       discountID,
		DiscountAmount:   discountAmount,
		TotalAmount:      totalAmount,
		Margin:           margin,
		PaymentMethod:    paymentMethod,
		Status:           status,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	// Use the transactional method to create purchase and deduct balance together
	if err := s.resellerRepo.CreatePurchaseWithBalanceUpdate(ctx, purchase, deductAmount); err != nil {
		return nil, fmt.Errorf("failed to process purchase transaction: %w", err)
	}

	// Generate Midtrans Snap Token if method is midtrans
	if paymentMethod == "midtrans" {
		config, err := s.tenantService.GetMidtransConfig(ctx, tenantID)
		if err == nil && config.Enabled {
			// Get Reseller info for customer details
			resellerInfo, _ := s.resellerRepo.GetByID(ctx, tenantID, resellerID)
			customer := &midtrans.CustomerDetails{
				FName: resellerInfo.ClientName,
				Email: resellerInfo.ClientEmail,
				Phone: resellerInfo.ClientPhone,
			}

			midtransOrderID := fmt.Sprintf("RS_%s_%d", purchase.ID.String(), time.Now().Unix())
			token, err := s.midtransService.CreateSnapToken(ctx, midtransOrderID, int64(totalAmount), *config, customer, "reseller_purchase")
			if err == nil {
				purchase.SnapToken = token
			} else {
				log.Error().Err(err).Msg("Failed to create Midtrans Snap token for reseller purchase")
			}
		}
	}

	// Only Generate Vouchers if status is Success (e.g. balance payment)
	if status == reseller.PurchaseStatusSuccess {
		_, err = s.voucherService.GenerateVouchers(ctx, tenantID, GenerateVouchersRequest{
			PackageID:          packageID,
			RouterID:           routerID,
			Quantity:           quantity,
			UserMode:           "up",
			CharacterMode:      "abcd",
			CodeLength:         4,
			ResellerPurchaseID: &purchase.ID,
		})
		
		if err != nil {
			// MANUAL COMPENSATION (SAGA ROLLBACK)
			// Delete the partially generated vouchers
			_ = s.voucherService.DeleteVouchersByPurchase(ctx, tenantID, purchase.ID)
			// Delete the purchase record
			_ = s.resellerRepo.DeletePurchase(ctx, tenantID, purchase.ID)
			// Refund the balance back to the reseller
			if deductAmount > 0 {
				_ = s.resellerRepo.UpdateBalance(ctx, tenantID, resellerID, deductAmount)
			}
			return nil, fmt.Errorf("payment successful but voucher generation failed, transaction rolled back: %w", err)
		}

		// Record revenue for the tenant
		if recErr := s.financeService.RecordResellerPurchaseRevenue(ctx, purchase); recErr != nil {
			fmt.Printf("Failed to record reseller purchase revenue: %v\n", recErr)
		}
	}

	// Fetch hydrated purchase with client names and vouchers
	p, err := s.resellerRepo.GetPurchaseByID(ctx, tenantID, purchase.ID)
	if err != nil {
		return nil, err
	}

	// Preserve the snap_token (in-memory only, not in DB)
	p.SnapToken = purchase.SnapToken

	// Load generated vouchers if any
	if status == reseller.PurchaseStatusSuccess {
		vouchers, err := s.voucherService.GetVouchersByPurchase(ctx, purchase.ID)
		if err == nil {
			p.Vouchers = vouchers
		}
	}

	return p, nil
}

// ConfirmPurchase manually confirms a pending reseller purchase
func (s *ResellerService) ConfirmPurchase(ctx context.Context, tenantID, purchaseID uuid.UUID) (*reseller.ResellerPurchase, error) {
	p, err := s.resellerRepo.GetPurchaseByID(ctx, tenantID, purchaseID)
	if err != nil {
		return nil, err
	}

	isPayLater := strings.Contains(strings.ToLower(p.PaymentMethod), "paylater")

	switch p.Status {
	case reseller.PurchaseStatusPending:
		// Gate 1: Approval (For PayLater) or Full Payment (For Others)
		if isPayLater {
			p.Status = reseller.PurchaseStatusPayLater
		} else {
			p.Status = reseller.PurchaseStatusSuccess
		}
		p.UpdatedAt = time.Now()

		// Update in DB
		if err := s.resellerRepo.UpdatePurchaseStatus(ctx, tenantID, p.ID, p.Status); err != nil {
			return nil, fmt.Errorf("failed to update purchase status: %w", err)
		}

		// Generate vouchers for both (PayLater approved, or Other paid)
		_, err = s.voucherService.GenerateVouchers(ctx, tenantID, GenerateVouchersRequest{
			PackageID:          p.VoucherPackageID,
			RouterID:           p.RouterID,
			Quantity:           p.Quantity,
			UserMode:           "up",
			CharacterMode:      "abcd",
			CodeLength:         4,
			ResellerPurchaseID: &p.ID,
		})
		if err != nil {
			// MANUAL COMPENSATION (SAGA ROLLBACK)
			// Delete any partially generated vouchers
			_ = s.voucherService.DeleteVouchersByPurchase(ctx, tenantID, p.ID)
			// Revert the purchase status back to Pending
			_ = s.resellerRepo.UpdatePurchaseStatus(ctx, tenantID, p.ID, reseller.PurchaseStatusPending)
			return nil, fmt.Errorf("failed to generate vouchers, transaction rolled back: %w", err)
		}

		// Record revenue immediately ONLY for non-paylater
		if !isPayLater {
			if recErr := s.financeService.RecordResellerPurchaseRevenue(ctx, p); recErr != nil {
				fmt.Printf("Failed to record reseller purchase revenue: %v\n", recErr)
			}
		}
	case reseller.PurchaseStatusVerifying:
		// Gate 2: Settle Payment for PayLater (triggered after client notifies payment)
		p.Status = reseller.PurchaseStatusSuccess
		p.UpdatedAt = time.Now()

		// Update in DB
		if err := s.resellerRepo.UpdatePurchaseStatus(ctx, tenantID, p.ID, p.Status); err != nil {
			return nil, fmt.Errorf("failed to finalise purchase status: %w", err)
		}

		// Record revenue now that money is received
		if recErr := s.financeService.RecordResellerPurchaseRevenue(ctx, p); recErr != nil {
			fmt.Printf("Failed to record reseller purchase revenue: %v\n", recErr)
		}
	default:
		return nil, errors.New("purchase is already completed or cannot be confirmed")
	}

	return p, nil
}

func (s *ResellerService) SubmitPayment(ctx context.Context, tenantID, purchaseID uuid.UUID) (*reseller.ResellerPurchase, error) {
	p, err := s.resellerRepo.GetPurchaseByID(ctx, tenantID, purchaseID)
	if err != nil {
		return nil, err
	}

	if p.Status != reseller.PurchaseStatusPayLater {
		return nil, errors.New("only paylater purchases can submit payment notification")
	}

	p.Status = reseller.PurchaseStatusVerifying
	p.UpdatedAt = time.Now()

	if err := s.resellerRepo.UpdatePurchaseStatus(ctx, tenantID, p.ID, p.Status); err != nil {
		return nil, fmt.Errorf("failed to notify payment: %w", err)
	}

	return p, nil
}

func (s *ResellerService) GetPurchaseByID(ctx context.Context, tenantID, id uuid.UUID) (*reseller.ResellerPurchase, error) {
	p, err := s.resellerRepo.GetPurchaseByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	vouchers, err := s.voucherService.GetVouchersByPurchase(ctx, id)
	if err == nil {
		p.Vouchers = vouchers
	}

	return p, nil
}

func (s *ResellerService) GetPurchaseHistory(ctx context.Context, tenantID uuid.UUID, filter reseller.PurchaseListFilter) ([]*reseller.ResellerPurchase, int64, error) {
	return s.resellerRepo.ListPurchases(ctx, tenantID, filter)
}

func (s *ResellerService) DeletePurchase(ctx context.Context, tenantID, id uuid.UUID) error {
	// 1. Get associated vouchers to clean up their usage transactions if any
	vouchers, _ := s.voucherService.GetVouchersByPurchase(ctx, id)
	if len(vouchers) > 0 {
		vIDs := make([]uuid.UUID, 0, len(vouchers))
		for _, v := range vouchers {
			vIDs = append(vIDs, v.ID)
		}
		_ = s.financeService.DeleteTransactionsBySourceIDs(ctx, tenantID, string(finance.TransactionSourceVoucherUsage), vIDs)
	}

	// 2. Delete financial transaction recorded for this reseller purchase
	if err := s.financeService.DeleteTransactionBySource(ctx, tenantID, string(finance.TransactionSourceResellerPurchase), id); err != nil {
		log.Warn().Err(err).Str("purchase_id", id.String()).Msg("Failed to delete finance transaction for reseller purchase")
	}

	// 3. Delete associated vouchers
	if err := s.voucherService.DeleteVouchersByPurchase(ctx, tenantID, id); err != nil {
		return fmt.Errorf("failed to delete associated vouchers: %w", err)
	}

	// 4. Delete purchase history record
	return s.resellerRepo.DeletePurchase(ctx, tenantID, id)
}

// CountActiveVouchers counts number of non-expired/non-revoked vouchers for a reseller
func (s *ResellerService) CountActiveVouchers(ctx context.Context, tenantID, resellerID uuid.UUID) (int, error) {
	purchases, _, err := s.resellerRepo.ListPurchases(ctx, tenantID, reseller.PurchaseListFilter{
		ResellerID: &resellerID,
	})
	if err != nil {
		return 0, err
	}

	totalActive := 0
	for _, p := range purchases {
		vouchers, err := s.voucherService.GetVouchersByPurchase(ctx, p.ID)
		if err != nil {
			continue
		}
		for _, v := range vouchers {
			if v.Status == "active" {
				totalActive++
			}
		}
	}

	return totalActive, nil
}

// DeleteReseller deletes a reseller and all related data
func (s *ResellerService) DeleteReseller(ctx context.Context, tenantID, resellerID uuid.UUID) error {
	// 1. Get all purchases to clean up vouchers
	purchases, _, err := s.resellerRepo.ListPurchases(ctx, tenantID, reseller.PurchaseListFilter{
		ResellerID: &resellerID,
	})
	if err != nil {
		return err
	}

	// 2. Delete each purchase and its vouchers
	for _, p := range purchases {
		if err := s.DeletePurchase(ctx, tenantID, p.ID); err != nil {
			return err
		}
	}

	// 3. Delete custom prices
	prices, err := s.resellerRepo.ListPrices(ctx, tenantID, resellerID)
	if err == nil {
		for _, p := range prices {
			_ = s.resellerRepo.DeletePrice(ctx, tenantID, p.ID)
		}
	}

	// 4. Delete the reseller record
	return s.resellerRepo.Delete(ctx, tenantID, resellerID)
}

func (s *ResellerService) GetSnapToken(ctx context.Context, tenantID, resellerID, purchaseID uuid.UUID, category string) (string, error) {
	// 1. Get purchase
	p, err := s.resellerRepo.GetPurchaseByID(ctx, tenantID, purchaseID)
	if err != nil {
		return "", err
	}

	// Verify reseller ID
	if p.ResellerID != resellerID {
		return "", fmt.Errorf("unauthorized")
	}

	// 2. Get tenant's Midtrans config
	config, err := s.tenantService.GetMidtransConfig(ctx, tenantID)
	if err != nil {
		return "", err
	}

	if !config.Enabled {
		return "", fmt.Errorf("pembayaran otomatis sedang tidak aktif untuk ISP ini")
	}

	// 3. Prepare customer details
	customer := &midtrans.CustomerDetails{
		FName: p.ResellerName,
	}

	// 4. Generate unique Order ID for Midtrans
	// Format: RS_[purchaseID]_[timestamp]
	uniqueOrderID := fmt.Sprintf("RS_%s_%d", p.ID.String(), time.Now().Unix())

	// 5. Create Snap Token
	return s.midtransService.CreateSnapToken(ctx, uniqueOrderID, int64(p.TotalAmount), *config, customer, category)
}

func (s *ResellerService) HandleMidtransPayment(ctx context.Context, tenantID uuid.UUID, orderID string, amount int64) error {
	// OrderID format: RS_[purchaseID]_[timestamp]
	parts := strings.Split(orderID, "_")
	if len(parts) < 2 || parts[0] != "RS" {
		return fmt.Errorf("invalid order id format for reseller payment")
	}

	purchaseID, err := uuid.Parse(parts[1])
	if err != nil {
		return fmt.Errorf("failed to parse purchase id from order id: %w", err)
	}

	// Get purchase
	p, err := s.resellerRepo.GetPurchaseByID(ctx, tenantID, purchaseID)
	if err != nil {
		return err
	}

	// Check if already processed
	if p.Status == reseller.PurchaseStatusSuccess {
		log.Info().Str("purchaseID", purchaseID.String()).Msg("Purchase already successful, skipping Midtrans handling")
		return nil
	}

	// Confirm the purchase (which generates vouchers and records revenue)
	_, err = s.ConfirmPurchase(ctx, tenantID, purchaseID)
	return err
}

func (s *ResellerService) GetPurchaseByIDRaw(ctx context.Context, id uuid.UUID) (*reseller.ResellerPurchase, error) {
	// We need a repository method that doesn't require tenantID for initial lookup
	// Or we can just use uuid.Nil for tenantID if the repo allows it, but it's better to be explicit.
	return s.resellerRepo.GetPurchaseByIDRaw(ctx, id)
}


