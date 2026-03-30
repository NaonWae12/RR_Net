package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/domain/client"
	"rrnet/internal/domain/tenant"
	"rrnet/internal/repository"
)

// InvoiceScheduler handles automatic invoice generation on a schedule
type InvoiceScheduler struct {
	tenantRepo     *repository.TenantRepository
	clientRepo     *repository.ClientRepository
	invoiceRepo    *repository.InvoiceRepository
	billingService *BillingService
}

// NewInvoiceScheduler creates a new invoice scheduler
func NewInvoiceScheduler(
	tenantRepo *repository.TenantRepository,
	clientRepo *repository.ClientRepository,
	invoiceRepo *repository.InvoiceRepository,
	billingService *BillingService,
) *InvoiceScheduler {
	return &InvoiceScheduler{
		tenantRepo:     tenantRepo,
		clientRepo:     clientRepo,
		invoiceRepo:    invoiceRepo,
		billingService: billingService,
	}
}

// StartDailyScheduler starts a goroutine that runs the invoice generation job daily at 00:05 local time
func (s *InvoiceScheduler) StartDailyScheduler(ctx context.Context) {
	go func() {
		// Run once on startup (helps recovery if server was down at scheduled time).
		s.runScheduledJob(ctx)

		for {
			now := time.Now()
			nextRun := time.Date(now.Year(), now.Month(), now.Day(), 0, 5, 0, 0, time.Local)
			if !nextRun.After(now) {
				nextRun = nextRun.Add(24 * time.Hour)
			}

			timer := time.NewTimer(time.Until(nextRun))
			select {
			case <-ctx.Done():
				timer.Stop()
				log.Info().Msg("Invoice scheduler stopped")
				return
			case <-timer.C:
				s.runScheduledJob(ctx)
			}
		}
	}()
	log.Info().Msg("Invoice scheduler started (runs daily at 00:05 local time)")
}

// runScheduledJob executes the invoice generation for all tenants/clients
func (s *InvoiceScheduler) runScheduledJob(ctx context.Context) {
	log.Info().Msg("Starting scheduled invoice generation job")

	// Mark overdue invoices first
	count, err := s.billingService.MarkOverdueInvoices(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to mark overdue invoices")
	} else if count > 0 {
		log.Info().Int64("count", count).Msg("Marked invoices as overdue")
	}

	// Get all active tenants
	tenants, err := s.tenantRepo.ListAll(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list tenants for invoice generation")
		return
	}

	totalScanned := 0
	totalCreated := 0
	totalSkipped := 0
	totalErrors := 0

	now := time.Now()
	tomorrow := now.AddDate(0, 0, 1)
	periodStart := time.Date(tomorrow.Year(), tomorrow.Month(), 1, 0, 0, 0, 0, time.Local)
	periodEnd := periodStart.AddDate(0, 1, -1)

	for _, t := range tenants {
		if t.Status != tenant.StatusActive {
			continue
		}

		activeStatus := client.StatusActive
		page := 1
		pageSize := 100
		for {
			clients, total, err := s.clientRepo.List(ctx, t.ID, &client.ClientListFilter{
				Status:   &activeStatus,
				Page:     page,
				PageSize: pageSize,
			})
			if err != nil {
				log.Error().Err(err).Str("tenant_id", t.ID.String()).Msg("Failed to list clients")
				totalErrors++
				break
			}
			if len(clients) == 0 {
				break
			}

			for _, c := range clients {
				totalScanned++

				// ROBUST CHECK:
				// We check if an invoice is needed for the "next" relevant period.
				// A client needs an invoice if their due day is coming up (today or soon)
				// AND they don't have one for that target period yet.

				// If not due soon, skip to save DB calls (unless it's already overdue and missing)
				if !s.shouldProcessInvoice(now, c) {
					continue
				}

				// Check if invoice already exists for the upcoming period
				exists, err := s.invoiceRepo.ExistsForClientPeriod(ctx, t.ID, c.ID, periodStart, periodEnd)
				if err != nil {
					log.Error().Err(err).Str("client", c.ClientCode).Msg("Check exists failed")
					totalErrors++
					continue
				}

				if exists {
					totalSkipped++
					continue
				}

				// Check if pricing is configured before attempting generation
				if c.MonthlyFee <= 0 && (c.ServicePackageID == nil || *c.ServicePackageID == uuid.Nil) {
					log.Info().Str("client", c.ClientCode).Msg("Skipping auto-gen: no pricing (monthly fee or service package) configured")
					totalSkipped++
					continue
				}

				_, err = s.billingService.GenerateMonthlyInvoice(ctx, t.ID, c.ID)
				if err != nil {
					log.Error().Err(err).Str("client", c.ClientCode).Msg("Auto-gen failed")
					totalErrors++
				} else {
					totalCreated++
				}
			}

			if page*pageSize >= total {
				break
			}
			page++
		}
	}

	log.Info().
		Int("tenants_processed", len(tenants)).
		Int("clients_scanned", totalScanned).
		Int("invoices_created", totalCreated).
		Int("invoices_skipped", totalSkipped).
		Int("errors", totalErrors).
		Msg("Scheduled invoice generation job completed")
}

// shouldProcessInvoice determines if we should even check the database for this client.
// We check if today is close to or past the due day.
func (s *InvoiceScheduler) shouldProcessInvoice(now time.Time, c *client.Client) bool {
	dueDay := c.PaymentDueDay
	if dueDay < 1 {
		return false
	}

	clampedDay := s.getClampedDueDay(now, dueDay)

	// Process if:
	// 1. It's exactly the due day
	// 2. It's within 3 days before the due day (proactive)
	// 3. It's past the due day (recovery/catch-up)
	return now.Day() >= (clampedDay - 3)
}

func (s *InvoiceScheduler) getClampedDueDay(t time.Time, dueDay int) int {
	lastDayOfMonth := time.Date(t.Year(), t.Month()+1, 0, 0, 0, 0, 0, time.Local).Day()
	if dueDay > lastDayOfMonth {
		return lastDayOfMonth
	}
	return dueDay
}
