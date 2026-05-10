package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/midtrans/midtrans-go"
	"github.com/rs/zerolog/log"

	"rrnet/internal/domain/billing"
	"rrnet/internal/domain/tenant"
	"rrnet/internal/repository"
)

type PlatformBillingService struct {
	repo             *repository.PlatformBillingRepository
	tenantRepo       *repository.TenantRepository
	planRepo         *repository.PlanRepository
	discountRepo     *repository.PlatformDiscountRepository
	addonRepo        *repository.AddonRepository
	affiliateService *AffiliateService
	midtransService  *MidtransService
	siteSettingService SiteSettingService
}

func NewPlatformBillingService(
	repo *repository.PlatformBillingRepository,
	tenantRepo *repository.TenantRepository,
	planRepo *repository.PlanRepository,
	discountRepo *repository.PlatformDiscountRepository,
	addonRepo *repository.AddonRepository,
) *PlatformBillingService {
	return &PlatformBillingService{
		repo:         repo,
		tenantRepo:   tenantRepo,
		planRepo:     planRepo,
		discountRepo:       discountRepo,
		addonRepo:          addonRepo,
		midtransService:     NewMidtransService(),
		siteSettingService: NewSiteSettingService(repository.NewSiteSettingRepository(repo.GetDB())),
	}
}

// SetAffiliateService injects the AffiliateService dynamically to avoid circular issues during router wiring
func (s *PlatformBillingService) SetAffiliateService(as *AffiliateService) {
	s.affiliateService = as
}

func (s *PlatformBillingService) UpdateInvoicePlan(ctx context.Context, invoiceID uuid.UUID, planID uuid.UUID, billingCycle string) error {
	plan, err := s.planRepo.GetByID(ctx, planID)
	if err != nil {
		return err
	}

	inv, err := s.repo.GetInvoiceByID(ctx, invoiceID)
	if err != nil {
		return err
	}

	// Determine period end based on billing cycle
	periodEnd := inv.PeriodStart.AddDate(0, 1, 0)
	if billingCycle == "yearly" {
		periodEnd = inv.PeriodStart.AddDate(1, 0, 0)
	}

	// Determine price based on billing cycle
	price := plan.PriceMonthly
	if billingCycle == "yearly" && plan.PriceYearly != nil {
		price = *plan.PriceYearly
	}

	// For registration invoices, the amount is just the plan price
	return s.repo.UpdateInvoicePlan(ctx, invoiceID, planID, int64(price), int64(price), periodEnd)
}

func (s *PlatformBillingService) GenerateTenantInvoices(ctx context.Context, tenantID *uuid.UUID, targetMonth, customStart, customEnd, customDue *time.Time) error {
	var tenants []*tenant.Tenant
	var err error

	if tenantID != nil {
		t, err := s.tenantRepo.GetByID(ctx, *tenantID)
		if err != nil {
			return err
		}
		tenants = []*tenant.Tenant{t}
	} else {
		tenants, err = s.tenantRepo.ListAll(ctx)
		if err != nil {
			return err
		}
	}

	for _, t := range tenants {
		if t.Status != "active" || t.PlanID == nil || *t.PlanID == uuid.Nil {
			continue
		}

		// Mode 1: Specific Month / Dates (Manual Flexible)
		if targetMonth != nil || customStart != nil {
			pStart := time.Now()
			if customStart != nil {
				pStart = *customStart
			} else if targetMonth != nil {
				pStart = time.Date(targetMonth.Year(), targetMonth.Month(), 1, 0, 0, 0, 0, time.Local)
			}
			
			if err := s.generateSingleInvoice(ctx, t, pStart, customEnd, customDue); err != nil {
				log.Error().Err(err).Str("tenant_id", t.ID.String()).Msg("Failed to generate manual platform invoice")
			}
			continue
		}

		// Mode 2: Auto Catch-up (Same as before)
		latest, err := s.repo.GetLatestInvoiceByTenantID(ctx, t.ID)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", t.ID.String()).Msg("Failed to get latest invoice for auto-gen")
			continue
		}

		var nextPeriodStart time.Time
		if latest == nil {
			now := time.Now()
			nextPeriodStart = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
		} else {
			nextPeriodStart = latest.PeriodEnd.Add(24 * time.Hour)
			nextPeriodStart = time.Date(nextPeriodStart.Year(), nextPeriodStart.Month(), 1, 0, 0, 0, 0, time.Local)
		}

		now := time.Now()
		limitMonth := now.AddDate(0, 1, 0)
		limitDate := time.Date(limitMonth.Year(), limitMonth.Month(), 1, 0, 0, 0, 0, time.Local)

		for !nextPeriodStart.After(limitDate) {
			periodEnd := nextPeriodStart.AddDate(0, 1, -1)
			exists, _ := s.repo.ExistsForTenantPeriod(ctx, t.ID, nextPeriodStart, periodEnd)
			
			if !exists {
				if err := s.generateSingleInvoice(ctx, t, nextPeriodStart, nil, nil); err != nil {
					log.Error().Err(err).Str("tenant_id", t.ID.String()).Msg("Failed auto-gen platform invoice")
					break
				}
				log.Info().Str("tenant", t.Name).Str("period", nextPeriodStart.Format("2006-01")).Msg("Auto-generated catch-up invoice")
			}
			nextPeriodStart = nextPeriodStart.AddDate(0, 1, 0)
		}
	}

	return nil
}

// generateSingleInvoice is a helper to create one invoice for a specific period
func (s *PlatformBillingService) generateSingleInvoice(ctx context.Context, t *tenant.Tenant, periodStart time.Time, customEnd, customDue *time.Time) error {
	periodEnd := periodStart.AddDate(0, 1, -1)
	if customEnd != nil {
		periodEnd = *customEnd
	}
	
	// Default due date based on tenant's registration day
	dueDay := t.CreatedAt.Day()
	dueDate := time.Date(periodStart.Year(), periodStart.Month(), dueDay, 0, 0, 0, 0, time.Local)
	
	// Handle cases where dueDay is 31 but month has 30 days
	if dueDate.Month() != periodStart.Month() {
		dueDate = time.Date(periodStart.Year(), periodStart.Month()+1, 0, 0, 0, 0, 0, time.Local)
	}

	if customDue != nil {
		dueDate = *customDue
	}
	
	now := time.Now()

	plan, err := s.planRepo.GetByID(ctx, *t.PlanID)
	if err != nil {
		return err
	}

	invNum, _ := s.repo.GenerateInvoiceNumber(ctx)
	
	// Calculate add-ons
	var addonTotal float64
	var addonNotes string
	
	tenantAddons, err := s.addonRepo.GetTenantAddons(ctx, t.ID)
	if err == nil {
		for _, ta := range tenantAddons {
			if ta.Status == "active" && (ta.CancelledAt == nil || ta.CancelledAt.After(periodStart)) {
				addonData, err := s.addonRepo.GetByID(ctx, ta.AddonID)
				if err == nil {
					price := addonData.Price * float64(ta.Quantity)
					addonTotal += price
					addonNotes += fmt.Sprintf("Add-on: %s (x%d) - %.0f %s\n", addonData.Name, ta.Quantity, price, addonData.Currency)
				}
			}
		}
	}

	totalAmount := int64(plan.PriceMonthly) + int64(addonTotal)
	notes := ""
	if addonNotes != "" {
		notes = "Includes active Add-ons:\n" + addonNotes
	}

	inv := &billing.PlatformInvoice{
		ID:            uuid.New(),
		TenantID:      t.ID,
		PlanID:        *t.PlanID,
		InvoiceNumber: invNum,
		PeriodStart:   periodStart,
		PeriodEnd:     periodEnd,
		DueDate:       dueDate,
		Subtotal:      totalAmount,
		Amount:        totalAmount,
		Currency:      plan.Currency,
		Status:        billing.PlatformInvoiceStatusUnpaid,
		Notes:         notes,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	return s.repo.CreateInvoice(ctx, inv)
}

func (s *PlatformBillingService) CreateInitialInvoice(ctx context.Context, tenantID uuid.UUID, planID uuid.UUID, billingCycle string) (*billing.PlatformInvoice, error) {
	plan, err := s.planRepo.GetByID(ctx, planID)
	if err != nil {
		return nil, err
	}

	log.Info().
		Str("tenant_id", tenantID.String()).
		Str("plan_id", planID.String()).
		Str("plan_code", plan.Code).
		Str("billing_cycle", billingCycle).
		Float64("plan_price_monthly", plan.PriceMonthly).
		Msg("Creating initial invoice for tenant")

	invNum, _ := s.repo.GenerateInvoiceNumber(ctx)
	now := time.Now()

	// Initial period: from now until end of trial (or end of month/year)
	periodStart := now
	periodEnd := now.AddDate(0, 1, 0)
	if billingCycle == "yearly" {
		periodEnd = now.AddDate(1, 0, 0)
	}

	// Determine price based on billing cycle
	price := plan.PriceMonthly
	if billingCycle == "yearly" && plan.PriceYearly != nil {
		price = *plan.PriceYearly
	}

	// Due Date should be the same day as registration, but not 29, 30, or 31
	dueDay := now.Day()
	if dueDay > 28 {
		dueDay = 28
	}
	dueDate := time.Date(now.Year(), now.Month(), dueDay, now.Hour(), now.Minute(), now.Second(), now.Nanosecond(), now.Location())

	inv := &billing.PlatformInvoice{
		ID:            uuid.New(),
		TenantID:      tenantID,
		PlanID:        planID,
		InvoiceNumber: invNum,
		PeriodStart:   periodStart,
		PeriodEnd:     periodEnd,
		DueDate:       dueDate,
		Subtotal:      int64(price),
		Amount:        int64(price),
		Currency:      plan.Currency,
		Status:        billing.PlatformInvoiceStatusUnpaid,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := s.repo.CreateInvoice(ctx, inv); err != nil {
		return nil, err
	}

	return inv, nil
}

func (s *PlatformBillingService) CreateAddonInvoice(ctx context.Context, tenantID uuid.UUID, addonID uuid.UUID, quantity int) (*billing.PlatformInvoice, error) {
	if quantity <= 0 {
		quantity = 1
	}

	tenant, err := s.tenantRepo.GetByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if tenant.PlanID == nil {
		return nil, fmt.Errorf("tenant must have an active plan to purchase an addon")
	}

	// We need the addon price. To avoid circular dependency with addon_service, we fetch it here
	// Or we can just let AddonService handle the price and pass it.
	// But let's assume we can query it directly using pgx since we have repo
	var addonPrice float64
	var addonCurrency string
	err = s.repo.GetDB().QueryRow(ctx, "SELECT price, currency FROM addons WHERE id = $1", addonID).Scan(&addonPrice, &addonCurrency)
	if err != nil {
		return nil, fmt.Errorf("failed to get addon details: %v", err)
	}

	invNum, _ := s.repo.GenerateInvoiceNumber(ctx)
	now := time.Now()

	// Initial period: from now until end of month
	periodStart := now
	periodEnd := now.AddDate(0, 1, 0)

	// Due Date: immediate or 1 day
	dueDate := now.AddDate(0, 0, 1)

	totalPrice := addonPrice * float64(quantity)

	inv := &billing.PlatformInvoice{
		ID:            uuid.New(),
		TenantID:      tenantID,
		PlanID:        *tenant.PlanID, // Associate with current plan
		AddonID:       &addonID,
		AddonQuantity: &quantity,
		InvoiceNumber: invNum,
		PeriodStart:   periodStart,
		PeriodEnd:     periodEnd,
		DueDate:       dueDate,
		Subtotal:      int64(totalPrice),
		Amount:        int64(totalPrice),
		Currency:      addonCurrency,
		Status:        billing.PlatformInvoiceStatusUnpaid,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := s.repo.CreateInvoice(ctx, inv); err != nil {
		return nil, err
	}

	return inv, nil
}

func (s *PlatformBillingService) GetTenantInvoices(ctx context.Context, tenantID uuid.UUID) ([]*billing.PlatformInvoice, error) {
	return s.repo.ListInvoices(ctx, &tenantID)
}

func (s *PlatformBillingService) GetInvoice(ctx context.Context, id uuid.UUID) (*billing.PlatformInvoice, error) {
	return s.repo.GetInvoiceByID(ctx, id)
}

func (s *PlatformBillingService) SubmitPayment(ctx context.Context, tenantID uuid.UUID, invID uuid.UUID, method, reference, proofURL string) (*billing.PlatformPayment, error) {
	inv, err := s.repo.GetInvoiceByID(ctx, invID)
	if err != nil {
		return nil, err
	}
	if inv.TenantID != tenantID {
		return nil, fmt.Errorf("unauthorized access to invoice")
	}

	p := &billing.PlatformPayment{
		ID:                uuid.New(),
		PlatformInvoiceID: invID,
		TenantID:          tenantID,
		Amount:            inv.Amount,
		Currency:          inv.Currency,
		Method:            method,
		Reference:         reference,
		ProofImageURL:     proofURL,
		Status:            billing.PlatformPaymentStatusPending,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := s.repo.CreatePayment(ctx, p); err != nil {
		return nil, err
	}

	// Update invoice status to Pending (Awaiting Verification)
	if err := s.repo.UpdateInvoiceStatus(ctx, invID, billing.PlatformInvoiceStatusPending, 0, nil); err != nil {
		log.Error().Err(err).Str("invoice_id", invID.String()).Msg("Failed to update invoice status to pending after payment submission")
	}

	return p, nil
}

func (s *PlatformBillingService) CancelPaymentSubmission(ctx context.Context, tenantID uuid.UUID, invID uuid.UUID) error {
	inv, err := s.repo.GetInvoiceByID(ctx, invID)
	if err != nil {
		return err
	}
	if inv.TenantID != tenantID {
		return fmt.Errorf("unauthorized access to invoice")
	}

	if inv.Status != billing.PlatformInvoiceStatusPending {
		return fmt.Errorf("only pending invoices can be cancelled")
	}

	// 1. Revert invoice status to Unpaid
	if err := s.repo.UpdateInvoiceStatus(ctx, invID, billing.PlatformInvoiceStatusUnpaid, 0, nil); err != nil {
		return err
	}

	// 2. Delete the payment record
	return s.repo.DeletePaymentByInvoiceID(ctx, invID)
}

func (s *PlatformBillingService) VerifyPayment(ctx context.Context, paymentID uuid.UUID, adminID uuid.UUID, approved bool) error {
	status := billing.PlatformPaymentStatusRejected
	if approved {
		status = billing.PlatformPaymentStatusVerified
	}

	if err := s.repo.UpdatePaymentStatus(ctx, paymentID, status, adminID); err != nil {
		return err
	}

	if approved {
		// Update invoice as paid
		payment, err := s.repo.GetPaymentByID(ctx, paymentID)
		if err != nil {
			log.Error().Err(err).Str("payment_id", paymentID.String()).Msg("Failed to get payment for verification")
			return err
		}

		if payment != nil {
			now := time.Now()
			// For MVP, assume 1 payment pays the full invoice
			if err := s.repo.UpdateInvoiceStatus(ctx, payment.PlatformInvoiceID, billing.PlatformInvoiceStatusPaid, payment.Amount, &now); err != nil {
				return err
			}

			if s.affiliateService != nil {
				// Process the commission based on the final paid amount (which accounts for discounts)
				err := s.affiliateService.ProcessCommission(ctx, payment.TenantID, payment.PlatformInvoiceID, float64(payment.Amount))
				if err != nil {
					log.Error().Err(err).
						Str("tenant_id", payment.TenantID.String()).
						Str("invoice_id", payment.PlatformInvoiceID.String()).
						Msg("Failed to process affiliate commission, continuing anyway")
				}
			}

			inv, err := s.repo.GetInvoiceByID(ctx, payment.PlatformInvoiceID)
			
			if err == nil {
				// If this invoice was for an addon purchase, assign the addon
				if inv.AddonID != nil && inv.AddonQuantity != nil {
					log.Info().
						Str("tenant_id", inv.TenantID.String()).
						Str("addon_id", inv.AddonID.String()).
						Int("quantity", *inv.AddonQuantity).
						Msg("Assigning addon to tenant after verified payment")
					
					var expiresAt *time.Time
					addonData, err := s.addonRepo.GetByID(ctx, *inv.AddonID)
					if err == nil {
						switch addonData.BillingCycle {
						case "monthly":
							t := time.Now().AddDate(0, 1, 0)
							expiresAt = &t
						case "yearly":
							t := time.Now().AddDate(1, 0, 0)
							expiresAt = &t
						}
						s.addonRepo.AssignAddonToTenant(ctx, inv.TenantID, *inv.AddonID, expiresAt, *inv.AddonQuantity)
					}
				} else if inv.PlanID != uuid.Nil {
					// If this invoice was for a plan change (has PlanID), update the tenant's plan
					log.Info().
						Str("tenant_id", inv.TenantID.String()).
						Str("plan_id", inv.PlanID.String()).
						Msg("Updating tenant plan after verified payment")
					
					t, err := s.tenantRepo.GetByID(ctx, inv.TenantID)
					if err == nil {
						t.PlanID = &inv.PlanID
						t.UpdatedAt = now
						s.tenantRepo.Update(ctx, t)
					}
				}
			}
		}
	}

	return nil
}

func (s *PlatformBillingService) ListAllInvoices(ctx context.Context) ([]*billing.PlatformInvoice, error) {
	return s.repo.ListInvoices(ctx, nil)
}

func (s *PlatformBillingService) ListAllPayments(ctx context.Context) ([]*billing.PlatformPayment, error) {
	return s.repo.ListPayments(ctx, nil)
}

func (s *PlatformBillingService) ApplyDiscountToInvoice(ctx context.Context, invoiceID uuid.UUID, code string) error {
	log.Info().Str("invoice_id", invoiceID.String()).Str("code", code).Msg("Applying discount to invoice")

	inv, err := s.repo.GetInvoiceByID(ctx, invoiceID)
	if err != nil {
		log.Error().Err(err).Str("invoice_id", invoiceID.String()).Msg("Failed to get invoice for discount")
		return err
	}

	if inv.Status != billing.PlatformInvoiceStatusPending && inv.Status != billing.PlatformInvoiceStatusUnpaid {
		log.Warn().Str("invoice_id", invoiceID.String()).Str("status", string(inv.Status)).Msg("Discount application failed: invoice not pending or unpaid")
		return fmt.Errorf("discount can only be applied to pending or unpaid invoices")
	}

	if inv.DiscountID != nil {
		log.Warn().Str("invoice_id", invoiceID.String()).Msg("Discount application failed: discount already applied")
		return fmt.Errorf("discount already applied to this invoice")
	}

	discount, err := s.discountRepo.GetByCode(ctx, code)
	if err != nil {
		log.Warn().Err(err).Str("code", code).Msg("Discount application failed: invalid code")
		return fmt.Errorf("invalid discount code")
	}

	if !discount.IsValid(float64(inv.Subtotal)) {
		log.Warn().
			Str("code", code).
			Int64("subtotal", inv.Subtotal).
			Bool("is_active", discount.IsActive).
			Interface("expires_at", discount.ExpiresAt).
			Float64("min_purchase", discount.MinPurchase).
			Int("usage_limit", func() int {
				if discount.UsageLimit == nil {
					return -1
				}
				return *discount.UsageLimit
			}()).
			Int("used_count", discount.UsedCount).
			Msg("Discount application failed: not valid or expired")
		return fmt.Errorf("discount code %s is not applicable or has expired", code)
	}

	discountValue := discount.CalculateDiscount(float64(inv.Subtotal))
	finalAmount := inv.Subtotal - int64(discountValue)

	log.Info().
		Str("discount_code", discount.Code).
		Str("discount_type", string(discount.Type)).
		Float64("discount_raw_value", discount.Value).
		Float64("invoice_subtotal", float64(inv.Subtotal)).
		Float64("calculated_discount_value", discountValue).
		Int64("final_amount", finalAmount).
		Msg("DEBUG DISCOUNT CALCULATION")

	log.Info().
		Str("invoice_id", invoiceID.String()).
		Str("discount_id", discount.ID.String()).
		Int64("subtotal", inv.Subtotal).
		Float64("discount_value", discountValue).
		Int64("final_amount", finalAmount).
		Msg("Applying discount calculation")

	if err := s.repo.ApplyDiscount(ctx, invoiceID, discount.ID, int64(discountValue), finalAmount, inv.Subtotal); err != nil {
		log.Error().Err(err).Str("invoice_id", invoiceID.String()).Msg("Failed to update invoice with discount")
		return err
	}

	if err := s.discountRepo.IncrementUsedCount(ctx, discount.ID); err != nil {
		log.Error().Err(err).Str("discount_id", discount.ID.String()).Msg("Failed to increment discount usage count")
	}

	log.Info().Str("invoice_id", invoiceID.String()).Msg("Discount applied successfully")
	return nil
}

func (s *PlatformBillingService) RemoveDiscountFromInvoice(ctx context.Context, invoiceID uuid.UUID) error {
	inv, err := s.repo.GetInvoiceByID(ctx, invoiceID)
	if err != nil {
		return err
	}

	if inv.Status != billing.PlatformInvoiceStatusPending && inv.Status != billing.PlatformInvoiceStatusUnpaid {
		return fmt.Errorf("discount can only be removed from pending or unpaid invoices")
	}

	if inv.DiscountID != nil {
		if err := s.discountRepo.DecrementUsedCount(ctx, *inv.DiscountID); err != nil {
			log.Error().Err(err).Str("discount_id", inv.DiscountID.String()).Msg("Failed to decrement discount usage count")
		}
	}

	return s.repo.RemoveDiscount(ctx, invoiceID, inv.Subtotal)
}

func (s *PlatformBillingService) DeletePendingInvoice(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteInvoice(ctx, id)
}

func (s *PlatformBillingService) GetSnapToken(ctx context.Context, invoiceID uuid.UUID, category string) (string, error) {
	inv, err := s.repo.GetInvoiceByID(ctx, invoiceID)
	if err != nil {
		return "", err
	}

	config, err := s.siteSettingService.GetMidtransConfig(ctx)
	if err != nil {
		return "", err
	}

	if !config.Enabled {
		return "", fmt.Errorf("automated payment is currently disabled by administrator")
	}

	t, err := s.tenantRepo.GetByID(ctx, inv.TenantID)
	if err != nil {
		return "", err
	}

	customer := &midtrans.CustomerDetails{
		FName: t.Name,
		Email: "billing@" + t.Slug + ".com", // Fallback or get owner email
	}

	// Use a unique order ID for Midtrans to avoid "order_id already taken" error
	// especially in Sandbox where reusing the same ID for multiple attempts is restricted.
	uniqueOrderID := fmt.Sprintf("%s_%d", inv.InvoiceNumber, time.Now().Unix())

	return s.midtransService.CreateSnapToken(ctx, uniqueOrderID, inv.Amount, *config, customer, category)
}

func (s *PlatformBillingService) HandleMidtransPayment(ctx context.Context, orderID string, amount int64) error {
	// Strip the unique suffix if present (e.g., INV-202401-0001_1715151515 -> INV-202401-0001)
	invoiceNumber := orderID
	if idx := strings.Index(orderID, "_"); idx != -1 {
		invoiceNumber = orderID[:idx]
	}

	// 1. Get invoice by number
	inv, err := s.repo.GetInvoiceByNumber(ctx, invoiceNumber)
	if err != nil {
		return err
	}

	if inv.Status == billing.PlatformInvoiceStatusPaid {
		log.Info().Str("invoice_number", invoiceNumber).Msg("Invoice already paid, skipping Midtrans handling")
		return nil
	}

	now := time.Now()

	// 2. Cap payment amount at invoice amount
	paymentAmount := amount
	if paymentAmount > inv.Amount {
		paymentAmount = inv.Amount
	}
	
	// 3. Create payment record
	p := &billing.PlatformPayment{
		ID:                uuid.New(),
		PlatformInvoiceID: inv.ID,
		TenantID:          inv.TenantID,
		Amount:            paymentAmount,
		Currency:          inv.Currency,
		Method:            "midtrans",
		Reference:         "Midtrans: " + invoiceNumber,
		Status:            billing.PlatformPaymentStatusVerified,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if err := s.repo.CreatePayment(ctx, p); err != nil {
		return err
	}

	// 4. Update invoice status to Paid
	if err := s.repo.UpdateInvoiceStatus(ctx, inv.ID, billing.PlatformInvoiceStatusPaid, paymentAmount, &now); err != nil {
		return err
	}

	// 4. Trigger fulfillment logic (Plan activation, Addons, Affiliates)
	// REUSED FROM VerifyPayment logic
	if s.affiliateService != nil {
		_ = s.affiliateService.ProcessCommission(ctx, inv.TenantID, inv.ID, float64(amount))
	}

	// If this invoice was for an addon purchase, assign the addon
	if inv.AddonID != nil && inv.AddonQuantity != nil {
		var expiresAt *time.Time
		addonData, err := s.addonRepo.GetByID(ctx, *inv.AddonID)
		if err == nil {
			switch addonData.BillingCycle {
			case "monthly":
				t := time.Now().AddDate(0, 1, 0)
				expiresAt = &t
			case "yearly":
				t := time.Now().AddDate(1, 0, 0)
				expiresAt = &t
			}
			s.addonRepo.AssignAddonToTenant(ctx, inv.TenantID, *inv.AddonID, expiresAt, *inv.AddonQuantity)
		}
	} else if inv.PlanID != uuid.Nil {
		// Update tenant's plan
		t, err := s.tenantRepo.GetByID(ctx, inv.TenantID)
		if err == nil {
			t.PlanID = &inv.PlanID
			t.UpdatedAt = now
			s.tenantRepo.Update(ctx, t)
		}
	}

	return nil
}
