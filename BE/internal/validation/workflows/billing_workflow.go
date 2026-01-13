package workflows

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/billing"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

// BillingWorkflowValidator validates complete billing workflow across modules
type BillingWorkflowValidator struct {
	clientRepo  *repository.ClientRepository
	invoiceRepo *repository.InvoiceRepository
	paymentRepo *repository.PaymentRepository
	billingSvc  *service.BillingService
}

// NewBillingWorkflowValidator creates a new billing workflow validator
func NewBillingWorkflowValidator(
	clientRepo *repository.ClientRepository,
	invoiceRepo *repository.InvoiceRepository,
	paymentRepo *repository.PaymentRepository,
	billingSvc *service.BillingService,
) *BillingWorkflowValidator {
	return &BillingWorkflowValidator{
		clientRepo:  clientRepo,
		invoiceRepo: invoiceRepo,
		paymentRepo: paymentRepo,
		billingSvc:  billingSvc,
	}
}

// WorkflowValidationResult represents the result of a workflow validation
type WorkflowValidationResult struct {
	Valid       bool
	Message     string
	Steps       []WorkflowStep
	Errors      []string
}

// WorkflowStep represents a step in the workflow
type WorkflowStep struct {
	Name      string
	Status    string // "passed", "failed", "skipped"
	Message   string
	Timestamp time.Time
}

// ValidateCompleteBillingCycle validates the complete billing cycle workflow
func (v *BillingWorkflowValidator) ValidateCompleteBillingCycle(
	ctx context.Context,
	tenantID uuid.UUID,
	clientID uuid.UUID,
) (*WorkflowValidationResult, error) {
	result := &WorkflowValidationResult{
		Valid:  true,
		Steps:  []WorkflowStep{},
		Errors: []string{},
	}

	// Step 1: Verify client exists
	client, err := v.clientRepo.GetByID(ctx, tenantID, clientID)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("Client not found: %v", err))
		result.Steps = append(result.Steps, WorkflowStep{
			Name:      "client_verification",
			Status:    "failed",
			Message:   fmt.Sprintf("Client not found: %v", err),
			Timestamp: time.Now(),
		})
		return result, nil
	}
	result.Steps = append(result.Steps, WorkflowStep{
		Name:      "client_verification",
		Status:    "passed",
		Message:   fmt.Sprintf("Client %s verified", client.Name),
		Timestamp: time.Now(),
	})

	// Step 2: Verify invoice creation
	invoices, _, err := v.invoiceRepo.List(ctx, repository.InvoiceFilter{
		ClientID: &clientID,
	})
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("Failed to list invoices: %v", err))
		result.Steps = append(result.Steps, WorkflowStep{
			Name:      "invoice_creation",
			Status:    "failed",
			Message:   fmt.Sprintf("Failed to list invoices: %v", err),
			Timestamp: time.Now(),
		})
		return result, nil
	}

	if len(invoices) == 0 {
		result.Steps = append(result.Steps, WorkflowStep{
			Name:      "invoice_creation",
			Status:    "skipped",
			Message:   "No invoices found for client",
			Timestamp: time.Now(),
		})
	} else {
		result.Steps = append(result.Steps, WorkflowStep{
			Name:      "invoice_creation",
			Status:    "passed",
			Message:   fmt.Sprintf("Found %d invoices", len(invoices)),
			Timestamp: time.Now(),
		})
	}

	// Step 3: Verify payment processing
	for _, invoice := range invoices {
		paymentList, err := v.paymentRepo.ListByInvoice(ctx, invoice.ID)
		if err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("Failed to get payments for invoice %s: %v", invoice.ID, err))
			continue
		}

		totalPaid := int64(0)
		for _, payment := range paymentList {
			totalPaid += payment.Amount
		}

		// Validate payment consistency
		if totalPaid > invoice.TotalAmount {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("Invoice %s: payments exceed invoice amount", invoice.InvoiceNumber))
		}

		// Validate invoice status
		if totalPaid >= invoice.TotalAmount && invoice.Status != billing.InvoiceStatusPaid {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("Invoice %s: should be marked as paid", invoice.InvoiceNumber))
		}
	}

	if len(result.Errors) == 0 {
		result.Message = fmt.Sprintf("Billing cycle validated successfully for client %s", client.Name)
		result.Steps = append(result.Steps, WorkflowStep{
			Name:      "payment_processing",
			Status:    "passed",
			Message:   "All payments validated",
			Timestamp: time.Now(),
		})
	} else {
		result.Message = fmt.Sprintf("Billing cycle validation failed with %d errors", len(result.Errors))
		result.Steps = append(result.Steps, WorkflowStep{
			Name:      "payment_processing",
			Status:    "failed",
			Message:   fmt.Sprintf("Found %d errors", len(result.Errors)),
			Timestamp: time.Now(),
		})
	}

	return result, nil
}

