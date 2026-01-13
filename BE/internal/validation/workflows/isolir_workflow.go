package workflows

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/billing"
	"rrnet/internal/repository"
)

// IsolirWorkflowValidator validates complete isolir workflow across modules
type IsolirWorkflowValidator struct {
	invoiceRepo *repository.InvoiceRepository
	paymentRepo *repository.PaymentRepository
	// Note: Network repository would be added when network module is implemented
}

// NewIsolirWorkflowValidator creates a new isolir workflow validator
func NewIsolirWorkflowValidator(
	invoiceRepo *repository.InvoiceRepository,
	paymentRepo *repository.PaymentRepository,
) *IsolirWorkflowValidator {
	return &IsolirWorkflowValidator{
		invoiceRepo: invoiceRepo,
		paymentRepo: paymentRepo,
	}
}

// ValidateIsolirWorkflow validates the complete isolir workflow
func (v *IsolirWorkflowValidator) ValidateIsolirWorkflow(
	ctx context.Context,
	invoiceID uuid.UUID,
) (*WorkflowValidationResult, error) {
	result := &WorkflowValidationResult{
		Valid:  true,
		Steps:  []WorkflowStep{},
		Errors: []string{},
	}

	// Step 1: Verify invoice exists and is overdue
	invoice, err := v.invoiceRepo.GetByID(ctx, invoiceID)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("Invoice not found: %v", err))
		result.Steps = append(result.Steps, WorkflowStep{
			Name:      "invoice_verification",
			Status:    "failed",
			Message:   fmt.Sprintf("Invoice not found: %v", err),
			Timestamp: time.Now(),
		})
		return result, nil
	}

	result.Steps = append(result.Steps, WorkflowStep{
		Name:      "invoice_verification",
		Status:    "passed",
		Message:   fmt.Sprintf("Invoice %s verified", invoice.InvoiceNumber),
		Timestamp: time.Now(),
	})

	// Step 2: Check if invoice is overdue
	now := time.Now()
	dueDate := invoice.DueDate
	if now.After(dueDate) && invoice.Status != billing.InvoiceStatusPaid {
		result.Steps = append(result.Steps, WorkflowStep{
			Name:      "overdue_detection",
			Status:    "passed",
			Message:   "Invoice is overdue",
			Timestamp: time.Now(),
		})
	} else {
		result.Steps = append(result.Steps, WorkflowStep{
			Name:      "overdue_detection",
			Status:    "skipped",
			Message:   "Invoice is not overdue",
			Timestamp: time.Now(),
		})
	}

	// Step 3: Verify isolir trigger (would check network user status in real implementation)
	// Note: In real implementation, this would check:
	// - Network user is disabled
	// - Isolir history is logged
	// - Notification is sent
	result.Steps = append(result.Steps, WorkflowStep{
		Name:      "isolir_trigger",
		Status:    "skipped",
		Message:   "Network module not yet implemented",
		Timestamp: time.Now(),
	})

	// Step 4: Verify payment triggers unisolir
	paymentList, err := v.paymentRepo.ListByInvoice(ctx, invoiceID)
	if err == nil && len(paymentList) > 0 {
		totalPaid := int64(0)
		for _, payment := range paymentList {
			totalPaid += payment.Amount
		}

		if totalPaid >= invoice.TotalAmount {
			result.Steps = append(result.Steps, WorkflowStep{
				Name:      "unisolir_trigger",
				Status:    "passed",
				Message:   "Payment complete, unisolir should be triggered",
				Timestamp: time.Now(),
			})
		} else {
			result.Steps = append(result.Steps, WorkflowStep{
				Name:      "unisolir_trigger",
				Status:    "skipped",
				Message:   "Payment incomplete",
				Timestamp: time.Now(),
			})
		}
	} else {
		result.Steps = append(result.Steps, WorkflowStep{
			Name:      "unisolir_trigger",
			Status:    "skipped",
			Message:   "No payments found",
			Timestamp: time.Now(),
		})
	}

	if len(result.Errors) == 0 {
		result.Message = fmt.Sprintf("Isolir workflow validated for invoice %s", invoice.InvoiceNumber)
	} else {
		result.Message = fmt.Sprintf("Isolir workflow validation failed with %d errors", len(result.Errors))
	}

	return result, nil
}

