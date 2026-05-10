package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"strings"

	"rrnet/internal/domain/billing"
	"rrnet/internal/repository"
	"github.com/midtrans/midtrans-go"
)

type PortalDashboardDTO struct {
	PackageName   string     `json:"package_name"`
	Status        string     `json:"status"`
	BillAmount    int64      `json:"bill_amount"`
	DueDate       *time.Time `json:"due_date"`
	PaymentDueDay int        `json:"payment_due_day"`
	UnpaidCount   int        `json:"unpaid_count"`
	ClientName    string     `json:"client_name"`
	ClientCode    string     `json:"client_code"`
}

type PortalService struct {
	clientRepo         *repository.ClientRepository
	invoiceRepo        *repository.InvoiceRepository
	servicePackageRepo *repository.ServicePackageRepository
	paymentRepo        *repository.PaymentRepository
	midtransService    *MidtransService
	tenantService      *TenantService
}

func NewPortalService(
	clientRepo *repository.ClientRepository,
	invoiceRepo *repository.InvoiceRepository,
	servicePackageRepo *repository.ServicePackageRepository,
	paymentRepo *repository.PaymentRepository,
	midtransService *MidtransService,
	tenantService *TenantService,
) *PortalService {
	return &PortalService{
		clientRepo:         clientRepo,
		invoiceRepo:        invoiceRepo,
		servicePackageRepo: servicePackageRepo,
		paymentRepo:        paymentRepo,
		midtransService:    midtransService,
		tenantService:      tenantService,
	}
}

func (s *PortalService) GetDashboardData(ctx context.Context, tenantID, userID uuid.UUID) (*PortalDashboardDTO, error) {
	log.Info().Str("userID", userID.String()).Msg("Fetching portal dashboard data")
	// 1. Get client by UserID
	c, err := s.clientRepo.GetByUserID(ctx, tenantID, userID)
	if err != nil {
		log.Error().Err(err).Str("userID", userID.String()).Msg("Failed to find client linked to user")
		return nil, err
	}
	log.Debug().Str("clientCode", c.ClientCode).Str("clientName", c.Name).Msg("Found client for user")

	// 2. Get pending invoices
	invoices, err := s.invoiceRepo.GetClientPendingInvoices(ctx, c.ID)
	if err != nil {
		log.Error().Err(err).Str("clientID", c.ID.String()).Msg("Failed to get pending invoices")
		return nil, err
	}

	var totalAmount int64
	var earliestDueDate *time.Time
	unpaidCount := len(invoices)

	for _, inv := range invoices {
		if inv.Status == billing.InvoiceStatusPending || inv.Status == billing.InvoiceStatusOverdue {
			totalAmount += (inv.TotalAmount - inv.PaidAmount)
			if earliestDueDate == nil || inv.DueDate.Before(*earliestDueDate) {
				dueDate := inv.DueDate
				earliestDueDate = &dueDate
			}
		}
	}

	// Fallback bill amount to monthly fee if no pending invoices
	if totalAmount == 0 {
		totalAmount = int64(c.MonthlyFee)
		log.Debug().Int64("monthlyFee", totalAmount).Msg("No pending invoices, using monthly fee as display bill amount")
	}

	// Fallback to client config if no pending invoices
	if earliestDueDate == nil {
		baseTime := time.Now()

		// Check if we have a paid invoice for this month
		// If the client has already paid for this month, show due date for NEXT month
		lastPaid, err := s.invoiceRepo.GetLatestPaidInvoice(ctx, c.ID)
		if err == nil && lastPaid != nil {
			// If last paid invoice period is current month (or future), presume current month is paid
			if lastPaid.PeriodStart.Month() == baseTime.Month() && lastPaid.PeriodStart.Year() == baseTime.Year() {
				// Move base time to next month so we compute due date for next billing cycle
				baseTime = baseTime.AddDate(0, 1, 0)
			}
		}

		dueDate := ComputeClientDueDate(baseTime, c.CreatedAt, c.PaymentTempoOption, c.PaymentDueDay)
		earliestDueDate = &dueDate
		log.Debug().Time("fallbackDueDate", dueDate).Msg("No pending invoices, using fallback due date from client config")
	}

	// 3. Get package name (Logic matched with admin detail view)
	packageName := "No Package"
	if c.ServicePackageID != nil && *c.ServicePackageID != uuid.Nil {
		pkg, err := s.servicePackageRepo.GetByID(ctx, tenantID, *c.ServicePackageID)
		if err == nil {
			packageName = pkg.Name
		} else {
			log.Warn().Err(err).Str("packageID", c.ServicePackageID.String()).Msg("Failed to fetch service package details")
			// Fallback to service plan if package fetch fails
			if c.ServicePlan != nil && *c.ServicePlan != "" {
				packageName = *c.ServicePlan
			}
		}
	} else if c.ServicePlan != nil && *c.ServicePlan != "" {
		packageName = *c.ServicePlan
	}

	log.Debug().Str("packageName", packageName).Int64("billAmount", totalAmount).Msg("Dashboard data points extracted")

	return &PortalDashboardDTO{
		PackageName:   packageName,
		Status:        string(c.Status),
		BillAmount:    totalAmount,
		DueDate:       earliestDueDate,
		PaymentDueDay: c.PaymentDueDay,
		UnpaidCount:   unpaidCount,
		ClientName:    c.Name,
		ClientCode:    c.ClientCode,
	}, nil
}

// GetClientInvoices retrieves all invoices for the client associated with the given user ID
func (s *PortalService) GetClientInvoices(ctx context.Context, tenantID, userID uuid.UUID) ([]*billing.Invoice, error) {
	log.Info().Str("userID", userID.String()).Str("tenantID", tenantID.String()).Msg("🔍 [Portal] Fetching client invoices for portal")

	// 1. Get client by UserID to ensure we only return invoices for THIS client
	c, err := s.clientRepo.GetByUserID(ctx, tenantID, userID)
	if err != nil {
		log.Error().Err(err).Str("userID", userID.String()).Msg("❌ [Portal] Failed to find client linked to user")
		return nil, err
	}
	log.Info().Str("clientID", c.ID.String()).Str("clientCode", c.ClientCode).Str("clientName", c.Name).Msg("✅ [Portal] Found client for user")

	// 2. Get all invoices for this client (ordered by due date descending)
	log.Info().
		Str("clientID", c.ID.String()).
		Str("tenantID", tenantID.String()).
		Int("page", 1).
		Int("pageSize", 100).
		Msg("🔍 [Portal] Querying invoices with filter")

	invoices, total, err := s.invoiceRepo.List(ctx, repository.InvoiceFilter{
		TenantID: tenantID,
		ClientID: &c.ID,
		Page:     1,
		PageSize: 100, // Get up to 100 most recent invoices
	})
	if err != nil {
		log.Error().Err(err).Str("clientID", c.ID.String()).Msg("❌ [Portal] Failed to get client invoices")
		return nil, err
	}

	log.Info().
		Int("count", len(invoices)).
		Int("total", total).
		Str("clientID", c.ID.String()).
		Str("clientName", c.Name).
		Msg("✅ [Portal] Retrieved invoices for client")

	// Log each invoice for debugging
	for i, inv := range invoices {
		log.Debug().
			Int("index", i).
			Str("invoiceID", inv.ID.String()).
			Str("invoiceNumber", inv.InvoiceNumber).
			Str("status", string(inv.Status)).
			Int64("totalAmount", inv.TotalAmount).
			Msg("📋 [Portal] Invoice detail")
	}

	return invoices, nil
}

// GetInvoiceDetail retrieves a single invoice with items for the client portal
func (s *PortalService) GetInvoiceDetail(ctx context.Context, tenantID, userID, invoiceID uuid.UUID) (*billing.Invoice, error) {
	log.Info().
		Str("userID", userID.String()).
		Str("invoiceID", invoiceID.String()).
		Msg("🔍 [Portal] Fetching invoice detail")

	// 1. Get client by UserID to ensure security
	c, err := s.clientRepo.GetByUserID(ctx, tenantID, userID)
	if err != nil {
		log.Error().Err(err).Str("userID", userID.String()).Msg("❌ [Portal] Failed to find client linked to user")
		return nil, err
	}

	// 2. Get invoice with items
	invoice, err := s.invoiceRepo.GetByID(ctx, invoiceID)
	if err != nil {
		log.Error().Err(err).Str("invoiceID", invoiceID.String()).Msg("❌ [Portal] Failed to get invoice")
		return nil, err
	}

	// 3. Security check: ensure invoice belongs to this client
	if invoice.ClientID != c.ID {
		log.Warn().
			Str("invoiceClientID", invoice.ClientID.String()).
			Str("userClientID", c.ID.String()).
			Msg("⚠️ [Portal] Invoice does not belong to this client")
		return nil, fmt.Errorf("invoice not found")
	}

	log.Info().
		Str("invoiceNumber", invoice.InvoiceNumber).
		Str("status", string(invoice.Status)).
		Int("itemCount", len(invoice.Items)).
		Msg("✅ [Portal] Retrieved invoice detail basic info")

	// 4. Fetch payments for this invoice
	payments, err := s.paymentRepo.ListByInvoice(ctx, invoiceID)
	if err == nil {
		invoice.Payments = make([]billing.Payment, 0, len(payments))
		for _, p := range payments {
			invoice.Payments = append(invoice.Payments, *p)
		}
		log.Debug().Int("paymentCount", len(invoice.Payments)).Msg("✅ [Portal] Attached payments to invoice")
	} else {
		log.Warn().Err(err).Str("invoiceID", invoiceID.String()).Msg("⚠️ [Portal] Failed to fetch payments for invoice detail")
	}

	return invoice, nil
}

// RecordPayment records a payment from the client portal
func (s *PortalService) RecordPayment(ctx context.Context, tenantID, userID, invoiceID uuid.UUID, amount int64, method billing.PaymentMethod, reference, notes *string) (*billing.Payment, error) {
	log.Info().
		Str("userID", userID.String()).
		Str("invoiceID", invoiceID.String()).
		Int64("amount", amount).
		Str("method", string(method)).
		Msg("💰 [Portal] Recording payment from client portal")

	// 1. Get client by UserID
	c, err := s.clientRepo.GetByUserID(ctx, tenantID, userID)
	if err != nil {
		log.Error().Err(err).Str("userID", userID.String()).Msg("❌ [Portal] Failed to find client linked to user")
		return nil, err
	}

	// 2. Get invoice to verify ownership and get details
	invoice, err := s.invoiceRepo.GetByID(ctx, invoiceID)
	if err != nil {
		log.Error().Err(err).Str("invoiceID", invoiceID.String()).Msg("❌ [Portal] Failed to get invoice")
		return nil, err
	}

	// 3. Security check: ensure invoice belongs to this client
	if invoice.ClientID != c.ID {
		log.Warn().
			Str("invoiceClientID", invoice.ClientID.String()).
			Str("userClientID", c.ID.String()).
			Msg("⚠️ [Portal] Invoice does not belong to this client")
		return nil, fmt.Errorf("invoice not found")
	}

	// 4. Validate payment amount
	remainingAmount := invoice.TotalAmount - invoice.PaidAmount
	if amount <= 0 {
		log.Warn().Int64("amount", amount).Msg("⚠️ [Portal] Invalid payment amount")
		return nil, fmt.Errorf("amount must be positive")
	}
	if amount > remainingAmount {
		log.Warn().
			Int64("amount", amount).
			Int64("remainingAmount", remainingAmount).
			Msg("⚠️ [Portal] Payment amount exceeds remaining balance")
		return nil, fmt.Errorf("payment amount exceeds remaining balance")
	}

	// 5. Create payment record
	// Note: For portal payments, we use the userID as the createdBy
	// This is different from admin-created payments
	payment := &billing.Payment{
		ID:              uuid.New(),
		TenantID:        tenantID,
		InvoiceID:       invoiceID,
		ClientID:        c.ID,
		Amount:          amount,
		Currency:        "IDR",
		Method:          method,
		Reference:       reference,
		Notes:           notes,
		ReceivedAt:      time.Now(),
		CreatedAt:       time.Now(),
		CreatedByUserID: userID,
	}

	// 6. Calculate new paid amount and status
	newPaidAmount := invoice.PaidAmount + amount
	newStatus := invoice.Status
	var paidAt *time.Time
	if newPaidAmount >= invoice.TotalAmount {
		newStatus = billing.InvoiceStatusPaid
		now := time.Now()
		paidAt = &now
	}

	// 7. Save payment and update invoice in a single database transaction
	if err := s.paymentRepo.CreateWithInvoiceUpdateV2(ctx, payment, newPaidAmount, newStatus, paidAt); err != nil {
		log.Error().Err(err).Msg("❌ [Portal] Failed to create payment and update invoice in transaction")
		return nil, fmt.Errorf("failed to process payment: %w", err)
	}

	log.Info().
		Str("paymentID", payment.ID.String()).
		Str("invoiceNumber", invoice.InvoiceNumber).
		Int64("amount", amount).
		Str("method", string(method)).
		Str("newStatus", string(newStatus)).
		Msg("✅ [Portal] Payment recorded successfully in transaction")

	return payment, nil
}

func (s *PortalService) GetSnapToken(ctx context.Context, tenantID, userID, invoiceID uuid.UUID, category string) (string, error) {
	// 1. Get client to verify ownership
	c, err := s.clientRepo.GetByUserID(ctx, tenantID, userID)
	if err != nil {
		return "", err
	}

	// 2. Get invoice
	inv, err := s.invoiceRepo.GetByID(ctx, invoiceID)
	if err != nil {
		return "", err
	}

	// 3. Verify invoice belongs to the client
	if inv.ClientID != c.ID {
		return "", fmt.Errorf("unauthorized")
	}

	// 3. Get tenant's Midtrans config
	config, err := s.tenantService.GetMidtransConfig(ctx, tenantID)
	if err != nil {
		return "", err
	}

	if !config.Enabled {
		return "", fmt.Errorf("pembayaran otomatis sedang tidak aktif untuk ISP ini")
	}

	// 4. Prepare customer details
	fname := ""
	if inv.ClientName != nil {
		fname = *inv.ClientName
	}
	customer := &midtrans.CustomerDetails{
		FName: fname,
		// Email: inv.ClientEmail, // If available in invoice or client
	}

	// 5. Generate unique Order ID for Midtrans
	// Format: PT_[invoiceID]_[timestamp]
	uniqueOrderID := fmt.Sprintf("PT_%s_%d", inv.ID.String(), time.Now().Unix())

	// 6. Create Snap Token
	amount := inv.TotalAmount - inv.PaidAmount
	return s.midtransService.CreateSnapToken(ctx, uniqueOrderID, amount, *config, customer, category)
}

func (s *PortalService) HandleMidtransPayment(ctx context.Context, tenantID uuid.UUID, orderID string, amount int64) error {
	// OrderID format: PT_[invoiceID]_[timestamp]
	parts := strings.Split(orderID, "_")
	if len(parts) < 2 || parts[0] != "PT" {
		return fmt.Errorf("invalid order id format for portal payment")
	}

	invoiceID, err := uuid.Parse(parts[1])
	if err != nil {
		return fmt.Errorf("failed to parse invoice id from order id: %w", err)
	}

	// Get invoice
	inv, err := s.invoiceRepo.GetByID(ctx, invoiceID)
	if err != nil {
		return err
	}

	// Verify tenant
	if inv.TenantID != tenantID {
		return fmt.Errorf("invoice tenant mismatch")
	}

	// 3. Check if already paid
	if inv.Status == billing.InvoiceStatusPaid {
		log.Info().Str("invoiceID", invoiceID.String()).Msg("Invoice already paid, skipping Midtrans handling")
		return nil
	}

	// 4. Cap payment amount at remaining balance
	// The extra amount from Midtrans is the surcharge/fee we added, which shouldn't be recorded as debt payment
	remainingAmount := inv.TotalAmount - inv.PaidAmount
	paymentAmount := amount
	if paymentAmount > remainingAmount {
		paymentAmount = remainingAmount
	}

	// Use systematic RecordPayment logic
	_, err = s.RecordPayment(ctx, tenantID, uuid.Nil, invoiceID, paymentAmount, "midtrans", &orderID, nil)
	return err
}

func (s *PortalService) GetInvoiceByIDRaw(ctx context.Context, id uuid.UUID) (*billing.Invoice, error) {
	return s.invoiceRepo.GetByID(ctx, id)
}

func (s *PortalService) GetMidtransConfig(ctx context.Context, tenantIDStr string) (map[string]interface{}, error) {
	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant id: %w", err)
	}

	config, err := s.tenantService.GetMidtransConfig(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	if !config.Enabled {
		return map[string]interface{}{"enabled": false}, nil
	}

	return map[string]interface{}{
		"enabled":       true,
		"client_key":    config.ClientKey,
		"is_production": config.IsProduction,
	}, nil
}


