package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/billing"
	"rrnet/internal/repository"
)

type BillingService struct {
	invoiceRepo *repository.InvoiceRepository
	paymentRepo *repository.PaymentRepository
	clientRepo  *repository.ClientRepository
	servicePackageRepo *repository.ServicePackageRepository
}

func NewBillingService(
	invoiceRepo *repository.InvoiceRepository,
	paymentRepo *repository.PaymentRepository,
	clientRepo *repository.ClientRepository,
	servicePackageRepo *repository.ServicePackageRepository,
) *BillingService {
	return &BillingService{
		invoiceRepo: invoiceRepo,
		paymentRepo: paymentRepo,
		clientRepo:  clientRepo,
		servicePackageRepo: servicePackageRepo,
	}
}

// ========== Invoice Operations ==========

type CreateInvoiceRequest struct {
	ClientID       uuid.UUID            `json:"client_id"`
	PeriodStart    time.Time            `json:"period_start"`
	PeriodEnd      time.Time            `json:"period_end"`
	DueDate        time.Time            `json:"due_date"`
	Items          []InvoiceItemRequest `json:"items"`
	TaxPercent     float64              `json:"tax_percent,omitempty"`
	DiscountAmount int64                `json:"discount_amount,omitempty"`
	Notes          string               `json:"notes,omitempty"`
}

type InvoiceItemRequest struct {
	Description string `json:"description"`
	Quantity    int    `json:"quantity"`
	UnitPrice   int64  `json:"unit_price"`
}

func (s *BillingService) CreateInvoice(ctx context.Context, tenantID uuid.UUID, req CreateInvoiceRequest) (*billing.Invoice, error) {
	// Generate invoice number
	invoiceNumber, err := s.invoiceRepo.GenerateInvoiceNumber(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate invoice number: %w", err)
	}

	now := time.Now()
	invoice := &billing.Invoice{
		ID:             uuid.New(),
		TenantID:       tenantID,
		ClientID:       req.ClientID,
		InvoiceNumber:  invoiceNumber,
		PeriodStart:    req.PeriodStart,
		PeriodEnd:      req.PeriodEnd,
		DueDate:        req.DueDate,
		DiscountAmount: req.DiscountAmount,
		Currency:       "IDR",
		Status:         billing.InvoiceStatusPending,
		Notes:          req.Notes,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	// Process items
	var subtotal int64
	for _, itemReq := range req.Items {
		qty := itemReq.Quantity
		if qty <= 0 {
			qty = 1
		}
		amount := itemReq.UnitPrice * int64(qty)
		item := billing.InvoiceItem{
			ID:          uuid.New(),
			InvoiceID:   invoice.ID,
			Description: itemReq.Description,
			Quantity:    qty,
			UnitPrice:   itemReq.UnitPrice,
			Amount:      amount,
			CreatedAt:   now,
		}
		invoice.Items = append(invoice.Items, item)
		subtotal += amount
	}

	invoice.Subtotal = subtotal
	invoice.TaxAmount = int64(float64(subtotal) * req.TaxPercent / 100)
	invoice.TotalAmount = subtotal + invoice.TaxAmount - invoice.DiscountAmount

	if err := s.invoiceRepo.Create(ctx, invoice); err != nil {
		return nil, fmt.Errorf("failed to create invoice: %w", err)
	}

	return invoice, nil
}

func (s *BillingService) GetInvoice(ctx context.Context, id uuid.UUID) (*billing.Invoice, error) {
	return s.invoiceRepo.GetByID(ctx, id)
}

func (s *BillingService) ListInvoices(ctx context.Context, filter repository.InvoiceFilter) ([]*billing.Invoice, int, error) {
	return s.invoiceRepo.List(ctx, filter)
}

func (s *BillingService) GetClientPendingInvoices(ctx context.Context, clientID uuid.UUID) ([]*billing.Invoice, error) {
	return s.invoiceRepo.GetClientPendingInvoices(ctx, clientID)
}

func (s *BillingService) GetOverdueInvoices(ctx context.Context, tenantID uuid.UUID) ([]*billing.Invoice, error) {
	return s.invoiceRepo.GetOverdueInvoices(ctx, tenantID)
}

func (s *BillingService) MarkInvoiceAsOverdue(ctx context.Context, id uuid.UUID) error {
	return s.invoiceRepo.UpdateStatus(ctx, id, billing.InvoiceStatusOverdue)
}

func (s *BillingService) CancelInvoice(ctx context.Context, id uuid.UUID) error {
	return s.invoiceRepo.UpdateStatus(ctx, id, billing.InvoiceStatusCancelled)
}

// ========== Payment Operations ==========

type RecordPaymentRequest struct {
	InvoiceID   uuid.UUID             `json:"invoice_id"`
	Amount      int64                 `json:"amount"`
	Method      billing.PaymentMethod `json:"method"`
	Reference   *string               `json:"reference,omitempty"`
	CollectorID *uuid.UUID            `json:"collector_id,omitempty"`
	Notes       *string               `json:"notes,omitempty"`
	ReceivedAt  *time.Time            `json:"received_at,omitempty"`
}

func (s *BillingService) RecordPayment(ctx context.Context, tenantID, userID uuid.UUID, req RecordPaymentRequest) (*billing.Payment, error) {
	// Get invoice
	invoice, err := s.invoiceRepo.GetByID(ctx, req.InvoiceID)
	if err != nil {
		return nil, fmt.Errorf("invoice not found: %w", err)
	}

	if invoice.Status == billing.InvoiceStatusPaid {
		return nil, fmt.Errorf("invoice is already paid")
	}
	if invoice.Status == billing.InvoiceStatusCancelled {
		return nil, fmt.Errorf("cannot pay cancelled invoice")
	}

	now := time.Now()
	receivedAt := now
	if req.ReceivedAt != nil {
		receivedAt = *req.ReceivedAt
	}

	payment := &billing.Payment{
		ID:              uuid.New(),
		TenantID:        tenantID,
		InvoiceID:       req.InvoiceID,
		ClientID:        invoice.ClientID,
		Amount:          req.Amount,
		Currency:        "IDR",
		Method:          req.Method,
		Reference:       req.Reference,
		CollectorID:     req.CollectorID,
		Notes:           req.Notes,
		ReceivedAt:      receivedAt,
		CreatedAt:       now,
		CreatedByUserID: userID,
	}

	if payment.Method == "" {
		payment.Method = billing.PaymentMethodCash
	}

	if err := s.paymentRepo.Create(ctx, payment); err != nil {
		return nil, fmt.Errorf("failed to record payment: %w", err)
	}

	// Update invoice paid amount
	totalPaid, err := s.paymentRepo.GetTotalByInvoice(ctx, req.InvoiceID)
	if err != nil {
		return nil, err
	}

	var paidAt *time.Time
	if totalPaid >= invoice.TotalAmount {
		paidAt = &now
		if err := s.invoiceRepo.UpdateStatus(ctx, req.InvoiceID, billing.InvoiceStatusPaid); err != nil {
			return nil, err
		}
	}

	if err := s.invoiceRepo.UpdatePaidAmount(ctx, req.InvoiceID, totalPaid, paidAt); err != nil {
		return nil, err
	}

	return payment, nil
}

func (s *BillingService) GetPayment(ctx context.Context, id uuid.UUID) (*billing.Payment, error) {
	return s.paymentRepo.GetByID(ctx, id)
}

func (s *BillingService) ListPayments(ctx context.Context, filter repository.PaymentFilter) ([]*billing.Payment, int, error) {
	return s.paymentRepo.List(ctx, filter)
}

func (s *BillingService) GetInvoicePayments(ctx context.Context, invoiceID uuid.UUID) ([]*billing.Payment, error) {
	return s.paymentRepo.ListByInvoice(ctx, invoiceID)
}

// ========== Summary Operations ==========

func (s *BillingService) GetBillingSummary(ctx context.Context, tenantID uuid.UUID) (*billing.BillingSummary, error) {
	// Get summary for current year
	now := time.Now()
	startDate := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.Local)
	endDate := time.Date(now.Year()+1, 1, 1, 0, 0, 0, 0, time.Local)
	
	return s.paymentRepo.GetSummary(ctx, tenantID, startDate, endDate)
}

func (s *BillingService) GetInvoiceYears(ctx context.Context, tenantID uuid.UUID) ([]int, error) {
	return s.invoiceRepo.GetInvoiceYears(ctx, tenantID)
}

// ========== Auto-generate monthly invoice for client ==========

func (s *BillingService) GenerateMonthlyInvoice(ctx context.Context, tenantID, clientID uuid.UUID) (*billing.Invoice, error) {
	client, err := s.clientRepo.GetByID(ctx, tenantID, clientID)
	if err != nil {
		return nil, fmt.Errorf("client not found: %w", err)
	}

	// Determine unit price from service package (preferred) or legacy MonthlyFee.
	var unitPrice int64
	var itemDesc string
	if client.ServicePackageID != nil && *client.ServicePackageID != uuid.Nil {
		pkg, err := s.servicePackageRepo.GetByID(ctx, tenantID, *client.ServicePackageID)
		if err != nil {
			return nil, fmt.Errorf("service package not found: %w", err)
		}
		itemDesc = fmt.Sprintf("Layanan Internet - %s", pkg.Name)
		switch pkg.PricingModel {
		case "per_device":
			devCount := 1
			if client.DeviceCount != nil && *client.DeviceCount > 0 {
				devCount = *client.DeviceCount
			}
			unitPrice = int64(pkg.PricePerDevice * float64(devCount))
		default:
			unitPrice = int64(pkg.PriceMonthly)
		}
	} else {
		if client.MonthlyFee == 0 {
			return nil, fmt.Errorf("client has no service package or monthly fee configured")
		}
		itemDesc = "Layanan Internet"
		unitPrice = int64(client.MonthlyFee * 100) // legacy cents
	}

	now := time.Now()

	// Compute due date from client tempo fields.
	dueDate := computeClientDueDate(now, client.CreatedAt, client.PaymentTempoOption, client.PaymentDueDay)
	// Special rule: if option=template and first invoice, due date is client created date.
	if client.PaymentTempoOption == "template" {
		hasAny, err := s.invoiceRepo.HasAnyInvoiceForClient(ctx, tenantID, clientID)
		if err != nil {
			return nil, err
		}
		if !hasAny {
			dueDate = time.Date(client.CreatedAt.Year(), client.CreatedAt.Month(), client.CreatedAt.Day(), 23, 59, 59, 0, time.Local)
		}
	}

	// Period should follow the month of due_date, not the current month
	periodStart := time.Date(dueDate.Year(), dueDate.Month(), 1, 0, 0, 0, 0, time.Local)
	periodEnd := periodStart.AddDate(0, 1, -1) // Last day of the month

	// Check if invoice already exists for this client+period to prevent duplicates
	exists, err := s.invoiceRepo.ExistsForClientPeriod(ctx, tenantID, clientID, periodStart, periodEnd)
	if err != nil {
		return nil, fmt.Errorf("failed to check for existing invoice: %w", err)
	}
	if exists {
		// Return existing invoice
		invoices, _, err := s.invoiceRepo.List(ctx, repository.InvoiceFilter{
			TenantID:   tenantID,
			ClientID:   &clientID,
			StartDate:  &periodStart,
			EndDate:    &periodEnd,
			Page:       1,
			PageSize:   1,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to get existing invoice: %w", err)
		}
		if len(invoices) > 0 {
			return invoices[0], nil
		}
		// Should not happen if ExistsForClientPeriod returned true, but handle gracefully
		return nil, fmt.Errorf("invoice exists but could not be retrieved")
	}

	req := CreateInvoiceRequest{
		ClientID:    clientID,
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
		DueDate:     dueDate,
		Items: []InvoiceItemRequest{
			{
				Description: itemDesc,
				Quantity:    1,
				UnitPrice:   unitPrice,
			},
		},
	}

	return s.CreateInvoice(ctx, tenantID, req)
}

func nowMonthYear() string {
	now := time.Now()
	return fmt.Sprintf("%s %d", now.Month().String(), now.Year())
}

func computeClientDueDate(now time.Time, clientCreatedAt time.Time, option string, dueDay int) time.Time {
	if dueDay < 1 {
		dueDay = now.Day()
	}
	if dueDay > 31 {
		dueDay = 31
	}
	loc := time.Local
	year := now.Year()
	month := now.Month()
	lastDay := time.Date(year, month+1, 0, 0, 0, 0, 0, loc).Day()
	day := dueDay
	if day > lastDay {
		day = lastDay
	}
	d := time.Date(year, month, day, 23, 59, 59, 0, loc)
	if d.Before(now) {
		// next month, re-clamp
		next := now.AddDate(0, 1, 0)
		ny, nm := next.Year(), next.Month()
		nLast := time.Date(ny, nm+1, 0, 0, 0, 0, 0, loc).Day()
		nd := dueDay
		if nd > nLast {
			nd = nLast
		}
		d = time.Date(ny, nm, nd, 23, 59, 59, 0, loc)
	}
	_ = option // reserved for future per-option tweaks
	_ = clientCreatedAt
	return d
}

