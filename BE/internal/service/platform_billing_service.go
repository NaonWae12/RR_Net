package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/domain/billing"
	"rrnet/internal/repository"
)

type PlatformBillingService struct {
	repo             *repository.PlatformBillingRepository
	tenantRepo       *repository.TenantRepository
	planRepo         *repository.PlanRepository
	discountRepo     *repository.PlatformDiscountRepository
	affiliateService *AffiliateService
}

func NewPlatformBillingService(
	repo *repository.PlatformBillingRepository,
	tenantRepo *repository.TenantRepository,
	planRepo *repository.PlanRepository,
	discountRepo *repository.PlatformDiscountRepository,
) *PlatformBillingService {
	return &PlatformBillingService{
		repo:         repo,
		tenantRepo:   tenantRepo,
		planRepo:     planRepo,
		discountRepo: discountRepo,
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

func (s *PlatformBillingService) GenerateTenantInvoices(ctx context.Context) error {
	tenants, err := s.tenantRepo.ListAll(ctx)
	if err != nil {
		return err
	}

	now := time.Now()
	// Next month's period
	nextMonth := now.AddDate(0, 1, 0)
	periodStart := time.Date(nextMonth.Year(), nextMonth.Month(), 1, 0, 0, 0, 0, time.Local)
	periodEnd := periodStart.AddDate(0, 1, -1)
	dueDate := periodStart.AddDate(0, 0, 5) // Due on the 5th

	for _, t := range tenants {
		if t.PlanID == nil || *t.PlanID == uuid.Nil {
			continue
		}

		// Check if invoice already exists
		exists, err := s.repo.ExistsForTenantPeriod(ctx, t.ID, periodStart, periodEnd)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", t.ID.String()).Msg("Failed to check if platform invoice exists")
			continue
		}
		if exists {
			continue
		}

		plan, err := s.planRepo.GetByID(ctx, *t.PlanID)
		if err != nil {
			log.Error().Err(err).Str("plan_id", t.PlanID.String()).Msg("Failed to get plan for platform invoice")
			continue
		}

		invNum, _ := s.repo.GenerateInvoiceNumber(ctx)
		inv := &billing.PlatformInvoice{
			ID:            uuid.New(),
			TenantID:      t.ID,
			PlanID:        *t.PlanID,
			InvoiceNumber: invNum,
			PeriodStart:   periodStart,
			PeriodEnd:     periodEnd,
			DueDate:       dueDate,
			Subtotal:      int64(plan.PriceMonthly),
			Amount:        int64(plan.PriceMonthly), // Assuming PriceMonthly is in cents or similar fixed unit
			Currency:      plan.Currency,
			Status:        billing.PlatformInvoiceStatusPending,
			CreatedAt:     now,
			UpdatedAt:     now,
		}

		if err := s.repo.CreateInvoice(ctx, inv); err != nil {
			log.Error().Err(err).Str("tenant_id", t.ID.String()).Msg("Failed to create platform invoice")
		}
	}
	return nil
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
		Status:        billing.PlatformInvoiceStatusPending,
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
	return p, nil
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

			// If this invoice was for a plan change (has PlanID), update the tenant's plan
			inv, err := s.repo.GetInvoiceByID(ctx, payment.PlatformInvoiceID)
			if err == nil && inv.PlanID != uuid.Nil {
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

	if inv.Status != billing.PlatformInvoiceStatusPending {
		log.Warn().Str("invoice_id", invoiceID.String()).Str("status", string(inv.Status)).Msg("Discount application failed: invoice not pending")
		return fmt.Errorf("discount can only be applied to pending invoices")
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

	if inv.Status != billing.PlatformInvoiceStatusPending {
		return fmt.Errorf("discount can only be removed from pending invoices")
	}

	return s.repo.RemoveDiscount(ctx, invoiceID, inv.Subtotal)
}

func (s *PlatformBillingService) DeletePendingInvoice(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteInvoice(ctx, id)
}
