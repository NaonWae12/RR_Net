package service

import (
	"context"
	"time"

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
		// Skip non-active tenants
		if t.Status != tenant.StatusActive {
			continue
		}

		// Get active clients for this tenant
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
				log.Error().Err(err).Str("tenant_id", t.ID.String()).Msg("Failed to list clients for invoice generation")
				totalErrors++
				break
			}
			if len(clients) == 0 {
				break
			}

			for _, c := range clients {
				totalScanned++
				if !s.isDueTomorrow(tomorrow, c) {
					continue
				}

				// Skip if invoice already exists for this upcoming period
				exists, err := s.invoiceRepo.ExistsForClientPeriod(ctx, t.ID, c.ID, periodStart, periodEnd)
				if err != nil {
					log.Error().
						Err(err).
						Str("tenant_id", t.ID.String()).
						Str("client_id", c.ID.String()).
						Str("client_code", c.ClientCode).
						Msg("Failed to check existing invoice")
					totalErrors++
					continue
				}
				if exists {
					totalSkipped++
					continue
				}

				_, err = s.billingService.GenerateMonthlyInvoice(ctx, t.ID, c.ID)
				if err != nil {
					log.Error().
						Err(err).
						Str("tenant_id", t.ID.String()).
						Str("client_id", c.ID.String()).
						Str("client_code", c.ClientCode).
						Msg("Failed to generate invoice for client")
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

// isDueTomorrow checks if tomorrow matches the client's due day (after clamping for end-of-month)
func (s *InvoiceScheduler) isDueTomorrow(tomorrow time.Time, c *client.Client) bool {
	dueDay := c.PaymentDueDay
	if dueDay < 1 {
		return false // Invalid due day
	}

	// Clamp due day to actual days in tomorrow's month
	lastDayOfMonth := time.Date(tomorrow.Year(), tomorrow.Month()+1, 0, 0, 0, 0, 0, time.Local).Day()
	clampedDay := dueDay
	if clampedDay > lastDayOfMonth {
		clampedDay = lastDayOfMonth
	}

	// Check if tomorrow's day matches the clamped due day
	return tomorrow.Day() == clampedDay
}

