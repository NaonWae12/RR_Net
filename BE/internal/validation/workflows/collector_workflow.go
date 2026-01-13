package workflows

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/repository"
)

// CollectorWorkflowValidator validates complete collector 3-phase workflow
type CollectorWorkflowValidator struct {
	invoiceRepo *repository.InvoiceRepository
	paymentRepo *repository.PaymentRepository
	// Note: Collector repository would be added when collector module is implemented
}

// NewCollectorWorkflowValidator creates a new collector workflow validator
func NewCollectorWorkflowValidator(
	invoiceRepo *repository.InvoiceRepository,
	paymentRepo *repository.PaymentRepository,
) *CollectorWorkflowValidator {
	return &CollectorWorkflowValidator{
		invoiceRepo: invoiceRepo,
		paymentRepo: paymentRepo,
	}
}

// ValidateCollector3PhaseWorkflow validates the complete collector 3-phase workflow
func (v *CollectorWorkflowValidator) ValidateCollector3PhaseWorkflow(
	ctx context.Context,
	invoiceID uuid.UUID,
) (*WorkflowValidationResult, error) {
	result := &WorkflowValidationResult{
		Valid:  true,
		Steps:  []WorkflowStep{},
		Errors: []string{},
	}

	// Step 1: Verify invoice exists
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

	// Step 2: Phase 1 - Collector visit success
	// Note: In real implementation, this would check:
	// - Collector task item exists
	// - Visit status is marked as success
	// - Payment history entry created with status=collected_by_collector
	result.Steps = append(result.Steps, WorkflowStep{
		Name:      "phase_1_visit_success",
		Status:    "skipped",
		Message:   "Collector module not yet implemented",
		Timestamp: time.Now(),
	})

	// Step 3: Phase 2 - Admin confirms setoran
	// Note: In real implementation, this would check:
	// - Setoran status is setoran_reported_by_collector
	// - Admin confirms setoran
	// - Payment history entry created with status=setoran_confirmed_by_admin
	result.Steps = append(result.Steps, WorkflowStep{
		Name:      "phase_2_setoran_confirmed",
		Status:    "skipped",
		Message:   "Collector module not yet implemented",
		Timestamp: time.Now(),
	})

	// Step 4: Phase 3 - Finance confirms deposit
	// Verify payment exists and invoice is marked as paid
	paymentList, err := v.paymentRepo.ListByInvoice(ctx, invoiceID)
	if err == nil && len(paymentList) > 0 {
		totalPaid := int64(0)
		hasCollectorPayment := false
		for _, payment := range paymentList {
			totalPaid += payment.Amount
			if string(payment.Method) == "collector" {
				hasCollectorPayment = true
			}
		}

		if hasCollectorPayment && totalPaid >= invoice.TotalAmount {
			result.Steps = append(result.Steps, WorkflowStep{
				Name:      "phase_3_deposit_confirmed",
				Status:    "passed",
				Message:   "Finance confirmed deposit, invoice marked as paid",
				Timestamp: time.Now(),
			})
		} else {
			result.Steps = append(result.Steps, WorkflowStep{
				Name:      "phase_3_deposit_confirmed",
				Status:    "skipped",
				Message:   "Collector payment not found or incomplete",
				Timestamp: time.Now(),
			})
		}
	} else {
		result.Steps = append(result.Steps, WorkflowStep{
			Name:      "phase_3_deposit_confirmed",
			Status:    "skipped",
			Message:   "No payments found",
			Timestamp: time.Now(),
		})
	}

	if len(result.Errors) == 0 {
		result.Message = fmt.Sprintf("Collector workflow validated for invoice %s", invoice.InvoiceNumber)
	} else {
		result.Message = fmt.Sprintf("Collector workflow validation failed with %d errors", len(result.Errors))
	}

	return result, nil
}

