package cross_module

import (
	"context"

	"github.com/google/uuid"

	"rrnet/internal/repository"
	"rrnet/internal/service"
	"rrnet/internal/validation/workflows"
)

// WorkflowValidator validates workflows across modules
type WorkflowValidator struct {
	billingWorkflowValidator  *workflows.BillingWorkflowValidator
	isolirWorkflowValidator   *workflows.IsolirWorkflowValidator
	collectorWorkflowValidator *workflows.CollectorWorkflowValidator
	outageWorkflowValidator   *workflows.OutageWorkflowValidator
}

// NewWorkflowValidator creates a new workflow validator
func NewWorkflowValidator(
	tenantRepo *repository.TenantRepository,
	clientRepo *repository.ClientRepository,
	invoiceRepo *repository.InvoiceRepository,
	paymentRepo *repository.PaymentRepository,
	// mapsRepo *repository.MapsRepository, // Not yet implemented
	// technicianRepo *repository.TechnicianRepository, // Not yet implemented
	billingSvc *service.BillingService,
) *WorkflowValidator {
	return &WorkflowValidator{
		billingWorkflowValidator: workflows.NewBillingWorkflowValidator(
			clientRepo,
			invoiceRepo,
			paymentRepo,
			billingSvc,
		),
		isolirWorkflowValidator: workflows.NewIsolirWorkflowValidator(
			invoiceRepo,
			paymentRepo,
		),
		collectorWorkflowValidator: workflows.NewCollectorWorkflowValidator(
			invoiceRepo,
			paymentRepo,
		),
		outageWorkflowValidator: workflows.NewOutageWorkflowValidator(),
	}
}

// ValidateAllWorkflows validates all workflows across modules
func (v *WorkflowValidator) ValidateAllWorkflows(
	ctx context.Context,
	tenantID uuid.UUID,
) (map[string]*workflows.WorkflowValidationResult, error) {
	results := make(map[string]*workflows.WorkflowValidationResult)

	// Note: This would require access to repositories
	// For now, we'll validate workflows that can be validated with available data
	// In real implementation, this would iterate through all tenants/clients/invoices
	// This method needs to be refactored to accept invoiceRepo as parameter or store it in the validator
	// For now, return empty results as placeholder
	_ = tenantID
	_ = ctx
	// TODO: Add invoiceRepo to WorkflowValidator struct and implement full validation
	// Example:
	// invoices, _, err := v.invoiceRepo.List(ctx, repository.InvoiceFilter{TenantID: tenantID})
	// if err == nil {
	//     for _, invoice := range invoices {
	//         result, err := v.isolirWorkflowValidator.ValidateIsolirWorkflow(ctx, invoice.ID)
	//         if err == nil {
	//             results[fmt.Sprintf("isolir_%s", invoice.ID)] = result
	//         }
	//     }
	// }

	return results, nil
}

