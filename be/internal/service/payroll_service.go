package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/payroll"
	"rrnet/internal/domain/reimbursement"
	"rrnet/internal/repository"
)

type PayrollService struct {
	payrollRepo       *repository.PayrollRepository
	userRepo          *repository.UserRepository
	reimbursementRepo *repository.ReimbursementRepository
}

func NewPayrollService(
	payrollRepo *repository.PayrollRepository,
	userRepo *repository.UserRepository,
	reimbursementRepo *repository.ReimbursementRepository,
) *PayrollService {
	return &PayrollService{
		payrollRepo:       payrollRepo,
		userRepo:          userRepo,
		reimbursementRepo: reimbursementRepo,
	}
}

func (s *PayrollService) CreatePayrollRun(ctx context.Context, tenantID uuid.UUID, period string) (*payroll.PayrollRun, error) {
	// Check if run already exists
	existing, err := s.payrollRepo.GetRunByPeriod(ctx, tenantID, period)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	// Create the run
	pr := &payroll.PayrollRun{
		ID:          uuid.New(),
		TenantID:    tenantID,
		Period:      period,
		Status:      payroll.StatusDraft,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		TotalAmount: 0,
	}

	if err := s.payrollRepo.CreateRun(ctx, pr); err != nil {
		return nil, fmt.Errorf("failed to create payroll run: %w", err)
	}

	return pr, nil
}

type PayslipPreview struct {
	User           *UserDTO                       `json:"user"`
	BaseSalary     float64                        `json:"base_salary"`
	Reimbursements []*reimbursement.Reimbursement `json:"reimbursements"`
	Existing       *payroll.Payslip               `json:"existing,omitempty"`
}

func (s *PayrollService) GetPayslipPreview(ctx context.Context, tenantID, userID uuid.UUID, period string) (*PayslipPreview, error) {
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Fetch approved reimbursements for user
	statusApproved := "approved"
	reimbursements, err := s.reimbursementRepo.ListByUser(ctx, userID, &statusApproved)
	if err != nil {
		return nil, err
	}

	// Filter only those not yet paid/consolidated
	var eligibleRbs []*reimbursement.Reimbursement
	for _, rb := range reimbursements {
		if rb.PayWithPayroll && rb.PaidWithPayrollID == nil {
			eligibleRbs = append(eligibleRbs, rb)
		}
	}

	// Check existing payslip
	run, _ := s.payrollRepo.GetRunByPeriod(ctx, tenantID, period)
	var existing *payroll.Payslip
	if run != nil {
		existing, _ = s.payrollRepo.GetPayslipByUserAndRun(ctx, userID, run.ID)
		if existing != nil {
			items, _ := s.payrollRepo.ListPayslipItems(ctx, existing.ID)
			existing.Items = items
		}
	}

	return &PayslipPreview{
		User: &UserDTO{
			ID:   u.ID,
			Name: u.Name,
			Role: u.Role.Code,
		},
		BaseSalary:     u.BaseSalary,
		Reimbursements: eligibleRbs,
		Existing:       existing,
	}, nil
}

type UpsertPayslipInput struct {
	UserID           uuid.UUID         `json:"user_id"`
	Period           string            `json:"period"`
	Allowances       []AdjustmentInput `json:"allowances"`
	Deductions       []AdjustmentInput `json:"deductions"`
	ReimbursementIDs []uuid.UUID       `json:"reimbursement_ids"`
}

type AdjustmentInput struct {
	Label  string  `json:"label"`
	Amount float64 `json:"amount"`
}

func (s *PayrollService) UpsertPayslip(ctx context.Context, tenantID uuid.UUID, input UpsertPayslipInput) (*payroll.Payslip, error) {
	// 1. Ensure run exists
	run, err := s.CreatePayrollRun(ctx, tenantID, input.Period)
	if err != nil {
		return nil, err
	}

	u, err := s.userRepo.GetByID(ctx, input.UserID)
	if err != nil {
		return nil, err
	}

	// Validate: Don't allow payslip for clients
	if u.Role != nil && u.Role.Code == "client" {
		return nil, fmt.Errorf("cannot create payslip for client users")
	}

	// 2. Calculate totals
	var totalAllowances, totalDeductions, totalReimbursements float64
	var items []*payroll.PayslipItem

	for _, a := range input.Allowances {
		totalAllowances += a.Amount
		items = append(items, &payroll.PayslipItem{
			ID:          uuid.New(),
			Description: a.Label,
			Type:        payroll.ItemTypeAllowance,
			Amount:      a.Amount,
		})
	}

	for _, d := range input.Deductions {
		totalDeductions += d.Amount
		items = append(items, &payroll.PayslipItem{
			ID:          uuid.New(),
			Description: d.Label,
			Type:        payroll.ItemTypeDeduction,
			Amount:      d.Amount,
		})
	}

	// Handle reimbursements
	for _, rbID := range input.ReimbursementIDs {
		rb, err := s.reimbursementRepo.GetByID(ctx, rbID)
		if err != nil || rb.UserID != input.UserID {
			continue // Skip invalid
		}
		totalReimbursements += rb.Amount
		items = append(items, &payroll.PayslipItem{
			ID:          uuid.New(),
			Description: fmt.Sprintf("Reimbursement: %s", rb.Category),
			Type:        payroll.ItemTypeReimbursement,
			Amount:      rb.Amount,
			ReferenceID: &rb.ID,
		})
	}

	netSalary := u.BaseSalary + totalAllowances + totalReimbursements - totalDeductions

	// 3. Create or update payslip
	existing, err := s.payrollRepo.GetPayslipByUserAndRun(ctx, input.UserID, run.ID)
	if err != nil {
		return nil, err
	}

	ps := &payroll.Payslip{
		PayrollRunID:        run.ID,
		UserID:              u.ID,
		BaseSalary:          u.BaseSalary,
		TotalAllowances:     totalAllowances,
		TotalDeductions:     totalDeductions,
		TotalReimbursements: totalReimbursements,
		NetSalary:           netSalary,
		Status:              payroll.PayslipStatusPending,
		UpdatedAt:           time.Now(),
	}

	if existing != nil {
		ps.ID = existing.ID
		ps.CreatedAt = existing.CreatedAt
		if err := s.payrollRepo.UpdatePayslip(ctx, ps); err != nil {
			return nil, err
		}
		// Clear old items and links
		s.payrollRepo.DeletePayslipItems(ctx, ps.ID)
		s.reimbursementRepo.ClearPaidWithPayroll(ctx, ps.ID)
	} else {
		ps.ID = uuid.New()
		ps.CreatedAt = time.Now()
		if err := s.payrollRepo.CreatePayslip(ctx, ps); err != nil {
			return nil, err
		}
	}

	// 4. Save items and update links
	for _, item := range items {
		item.PayslipID = ps.ID
		s.payrollRepo.CreatePayslipItem(ctx, item)
		if item.Type == payroll.ItemTypeReimbursement && item.ReferenceID != nil {
			s.reimbursementRepo.SetPaidWithPayroll(ctx, *item.ReferenceID, ps.ID)
		}
	}

	// 5. Update run total (naive: re-sum all payslips in run)
	payslips, _ := s.payrollRepo.ListPayslipsByRun(ctx, run.ID)
	var newTotal float64
	for _, p := range payslips {
		newTotal += p.NetSalary
	}
	run.TotalAmount = newTotal
	run.UpdatedAt = time.Now()
	s.payrollRepo.UpdateRun(ctx, run)

	return ps, nil
}

func (s *PayrollService) ListPayrollRuns(ctx context.Context, tenantID uuid.UUID) ([]*payroll.PayrollRun, error) {
	runs, err := s.payrollRepo.ListRunsByTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	// Load payslips for each run
	for _, run := range runs {
		payslips, err := s.payrollRepo.ListPayslipsByRun(ctx, run.ID)
		if err != nil {
			continue // Skip if error, don't fail entire list
		}
		run.Payslips = payslips
	}

	return runs, nil
}

func (s *PayrollService) GetPayrollRun(ctx context.Context, id uuid.UUID) (*payroll.PayrollRun, error) {
	pr, err := s.payrollRepo.GetRunByID(ctx, id)
	if err != nil {
		return nil, err
	}

	payslips, err := s.payrollRepo.ListPayslipsByRun(ctx, id)
	if err != nil {
		return nil, err
	}

	for _, ps := range payslips {
		items, err := s.payrollRepo.ListPayslipItems(ctx, ps.ID)
		if err != nil {
			return nil, err
		}
		ps.Items = items
	}

	pr.Payslips = payslips
	return pr, nil
}

func (s *PayrollService) PayPayslip(ctx context.Context, payslipID uuid.UUID, paymentMethodID *uuid.UUID, paymentRef *string) error {
	// 1. Get payslip with items
	ps, err := s.payrollRepo.GetPayslipByID(ctx, payslipID)
	if err != nil {
		return err
	}
	items, err := s.payrollRepo.ListPayslipItems(ctx, payslipID)
	if err == nil {
		ps.Items = items
	}

	// 2. Mark payslip as paid
	if err := s.payrollRepo.UpdatePayslipStatus(ctx, payslipID, payroll.PayslipStatusPaid, paymentMethodID, paymentRef); err != nil {
		return err
	}

	// 3. Mark linked reimbursements as paid
	for _, item := range ps.Items {
		if item.Type == payroll.ItemTypeReimbursement && item.ReferenceID != nil {
			rb, err := s.reimbursementRepo.GetByID(ctx, *item.ReferenceID)
			if err == nil && rb.Status != reimbursement.StatusPaid {
				now := time.Now()
				rb.Status = reimbursement.StatusPaid
				rb.PaidAt = &now
				rb.PaymentMethodID = paymentMethodID
				rb.PaymentReference = paymentRef
				rb.UpdatedAt = now
				s.reimbursementRepo.Update(ctx, rb)
			}
		}
	}

	return nil
}

func (s *PayrollService) ListMyPayslips(ctx context.Context, userID uuid.UUID) ([]*payroll.Payslip, error) {
	payslips, err := s.payrollRepo.ListPayslipsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	for _, ps := range payslips {
		items, err := s.payrollRepo.ListPayslipItems(ctx, ps.ID)
		if err != nil {
			continue // Skip items if error, don't fail entire list
		}
		ps.Items = items
	}

	return payslips, nil
}

func (s *PayrollService) GetPayslipDetails(ctx context.Context, id uuid.UUID) (*payroll.Payslip, error) {
	ps, err := s.payrollRepo.GetPayslipByID(ctx, id)
	if err != nil {
		return nil, err
	}

	items, err := s.payrollRepo.ListPayslipItems(ctx, id)
	if err != nil {
		return nil, err
	}
	ps.Items = items

	return ps, nil
}

func (s *PayrollService) PayRun(ctx context.Context, id uuid.UUID, paymentMethodID *uuid.UUID, paymentRef *string) error {
	// 1. Load all payslips for this run
	payslips, err := s.payrollRepo.ListPayslipsByRun(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to list payslips for run: %w", err)
	}

	for _, ps := range payslips {
		// 2. Mark each payslip as paid
		if ps.Status != payroll.PayslipStatusPaid {
			if err := s.payrollRepo.UpdatePayslipStatus(ctx, ps.ID, payroll.PayslipStatusPaid, paymentMethodID, paymentRef); err != nil {
				return fmt.Errorf("failed to update payslip %s status: %w", ps.ID, err)
			}
		}

		// 3. Mark any linked reimbursements as paid
		for _, item := range ps.Items {
			if item.Type == payroll.ItemTypeReimbursement && item.ReferenceID != nil {
				// Mark reimbursement as paid
				rb, err := s.reimbursementRepo.GetByID(ctx, *item.ReferenceID)
				if err == nil && rb.Status != reimbursement.StatusPaid {
					now := time.Now()
					rb.Status = reimbursement.StatusPaid
					rb.PaidAt = &now
					rb.PaymentMethodID = paymentMethodID
					rb.PaymentReference = paymentRef
					rb.UpdatedAt = now
					s.reimbursementRepo.Update(ctx, rb)
				}
			}
		}
	}

	// 4. Finally update run status to Paid
	if err := s.payrollRepo.UpdateRunStatus(ctx, id, payroll.StatusPaid, paymentMethodID, paymentRef); err != nil {
		return fmt.Errorf("failed to update run status: %w", err)
	}

	return nil
}
