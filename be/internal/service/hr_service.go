package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/reimbursement"
	timeoff "rrnet/internal/domain/time_off"
	"rrnet/internal/repository"
)

type HRService struct {
	reimbursementRepo *repository.ReimbursementRepository
	timeOffRepo       *repository.TimeOffRepository
	userRepo          *repository.UserRepository
}

func NewHRService(reimbursementRepo *repository.ReimbursementRepository, timeOffRepo *repository.TimeOffRepository, userRepo *repository.UserRepository) *HRService {
	return &HRService{
		reimbursementRepo: reimbursementRepo,
		timeOffRepo:       timeOffRepo,
		userRepo:          userRepo,
	}
}

type CreateReimbursementRequest struct {
	Amount        float64   `json:"amount"`
	Category      string    `json:"category"`
	Date          time.Time `json:"date"`
	Description   string    `json:"description"`
	AttachmentURL *string   `json:"attachment_url,omitempty"`
}

func (s *HRService) CreateReimbursement(ctx context.Context, tenantID, userID uuid.UUID, req CreateReimbursementRequest) (*reimbursement.Reimbursement, error) {
	rb := &reimbursement.Reimbursement{
		ID:            uuid.New(),
		TenantID:      tenantID,
		UserID:        userID,
		Amount:        req.Amount,
		Category:      req.Category,
		Date:          req.Date,
		Description:   req.Description,
		Status:        reimbursement.StatusSubmitted,
		AttachmentURL: req.AttachmentURL,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := s.reimbursementRepo.Create(ctx, rb); err != nil {
		return nil, fmt.Errorf("failed to create reimbursement: %w", err)
	}

	return rb, nil
}

func (s *HRService) GetReimbursement(ctx context.Context, id uuid.UUID) (*reimbursement.Reimbursement, error) {
	return s.reimbursementRepo.GetByID(ctx, id)
}

func (s *HRService) ListReimbursementsByTenant(ctx context.Context, tenantID uuid.UUID, status *string) ([]*reimbursement.Reimbursement, error) {
	return s.reimbursementRepo.ListByTenant(ctx, tenantID, status)
}

func (s *HRService) ListReimbursementsByUser(ctx context.Context, userID uuid.UUID, status *string) ([]*reimbursement.Reimbursement, error) {
	return s.reimbursementRepo.ListByUser(ctx, userID, status)
}

func (s *HRService) ApproveReimbursement(ctx context.Context, id, approvedBy uuid.UUID) (*reimbursement.Reimbursement, error) {
	rb, err := s.reimbursementRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if rb.Status != reimbursement.StatusSubmitted {
		return nil, fmt.Errorf("only submitted reimbursements can be approved")
	}

	now := time.Now()
	rb.Status = reimbursement.StatusApproved
	rb.ApprovedBy = &approvedBy
	rb.ApprovedAt = &now
	rb.UpdatedAt = now

	if err := s.reimbursementRepo.Update(ctx, rb); err != nil {
		return nil, fmt.Errorf("failed to approve reimbursement: %w", err)
	}

	return rb, nil
}

func (s *HRService) RejectReimbursement(ctx context.Context, id, rejectedBy uuid.UUID, reason string) (*reimbursement.Reimbursement, error) {
	rb, err := s.reimbursementRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if rb.Status != reimbursement.StatusSubmitted {
		return nil, fmt.Errorf("only submitted reimbursements can be rejected")
	}

	now := time.Now()
	rb.Status = reimbursement.StatusRejected
	rb.ApprovedBy = &rejectedBy // Using ApprovedBy field for who handled it
	rb.RejectionReason = &reason
	rb.UpdatedAt = now

	if err := s.reimbursementRepo.Update(ctx, rb); err != nil {
		return nil, fmt.Errorf("failed to reject reimbursement: %w", err)
	}

	return rb, nil
}

func (s *HRService) MarkAsPaid(ctx context.Context, id uuid.UUID, paymentMethodID *uuid.UUID, paymentRef *string) (*reimbursement.Reimbursement, error) {
	rb, err := s.reimbursementRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if rb.Status != reimbursement.StatusApproved {
		return nil, fmt.Errorf("only approved reimbursements can be marked as paid")
	}

	now := time.Now()
	rb.Status = reimbursement.StatusPaid
	rb.PaidAt = &now
	rb.PaymentMethodID = paymentMethodID
	rb.PaymentReference = paymentRef
	rb.UpdatedAt = now

	if err := s.reimbursementRepo.Update(ctx, rb); err != nil {
		return nil, fmt.Errorf("failed to mark reimbursement as paid: %w", err)
	}

	return rb, nil
}

func (s *HRService) SetPayWithPayroll(ctx context.Context, id uuid.UUID, enabled bool) (*reimbursement.Reimbursement, error) {
	rb, err := s.reimbursementRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if rb.Status != reimbursement.StatusApproved {
		return nil, fmt.Errorf("only approved reimbursements can be set to pay with payroll")
	}

	if rb.PaidWithPayrollID != nil {
		return nil, fmt.Errorf("reimbursement is already included in a payroll run and cannot be modified")
	}

	rb.PayWithPayroll = enabled
	rb.UpdatedAt = time.Now()

	if err := s.reimbursementRepo.Update(ctx, rb); err != nil {
		return nil, fmt.Errorf("failed to update payroll payment preference: %w", err)
	}

	return rb, nil
}

func (s *HRService) UpdateReimbursement(ctx context.Context, id, userID uuid.UUID, req CreateReimbursementRequest) (*reimbursement.Reimbursement, error) {
	rb, err := s.reimbursementRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Security: Ensure user owns this reimbursement
	if rb.UserID != userID {
		return nil, fmt.Errorf("unauthorized: you do not own this reimbursement request")
	}

	// Logic: Only allow editing if status is 'submitted'
	if rb.Status != reimbursement.StatusSubmitted {
		return nil, fmt.Errorf("cannot edit reimbursement: current status is %s (only submitted requests can be edited)", rb.Status)
	}

	// Update fields
	rb.Amount = req.Amount
	rb.Category = req.Category
	rb.Date = req.Date
	rb.Description = req.Description
	if req.AttachmentURL != nil {
		rb.AttachmentURL = req.AttachmentURL
	}
	rb.UpdatedAt = time.Now()

	if err := s.reimbursementRepo.Update(ctx, rb); err != nil {
		return nil, fmt.Errorf("failed to update reimbursement: %w", err)
	}

	return rb, nil
}

// ========== Time Off Methods ==========

type CreateTimeOffRequest struct {
	Type          timeoff.Type `json:"type"`
	StartDate     time.Time    `json:"start_date"`
	EndDate       time.Time    `json:"end_date"`
	Reason        string       `json:"reason"`
	AttachmentURL *string      `json:"attachment_url,omitempty"`
}

func (s *HRService) CreateTimeOff(ctx context.Context, tenantID, userID uuid.UUID, req CreateTimeOffRequest) (*timeoff.TimeOff, error) {
	to := &timeoff.TimeOff{
		ID:            uuid.New(),
		TenantID:      tenantID,
		UserID:        userID,
		Type:          req.Type,
		StartDate:     req.StartDate,
		EndDate:       req.EndDate,
		Reason:        req.Reason,
		Status:        timeoff.StatusPending,
		AttachmentURL: req.AttachmentURL,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := s.timeOffRepo.Create(ctx, to); err != nil {
		return nil, fmt.Errorf("failed to create time off request: %w", err)
	}

	return to, nil
}

func (s *HRService) GetTimeOff(ctx context.Context, id uuid.UUID) (*timeoff.TimeOff, error) {
	return s.timeOffRepo.GetByID(ctx, id)
}

func (s *HRService) ListTimeOffsByTenant(ctx context.Context, tenantID uuid.UUID, status *string) ([]*timeoff.TimeOff, error) {
	return s.timeOffRepo.ListByTenant(ctx, tenantID, status)
}

func (s *HRService) ListTimeOffsByUser(ctx context.Context, userID uuid.UUID, status *string) ([]*timeoff.TimeOff, error) {
	return s.timeOffRepo.ListByUser(ctx, userID, status)
}

func (s *HRService) ApproveTimeOff(ctx context.Context, id, approvedBy uuid.UUID) (*timeoff.TimeOff, error) {
	to, err := s.timeOffRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if to.Status != timeoff.StatusPending {
		return nil, fmt.Errorf("only pending requests can be approved")
	}

	now := time.Now()
	to.Status = timeoff.StatusApproved
	to.ApprovedBy = &approvedBy
	to.ApprovedAt = &now
	to.UpdatedAt = now

	if err := s.timeOffRepo.Update(ctx, to); err != nil {
		return nil, fmt.Errorf("failed to approve time off: %w", err)
	}

	return to, nil
}

func (s *HRService) RejectTimeOff(ctx context.Context, id, rejectedBy uuid.UUID, reason string) (*timeoff.TimeOff, error) {
	to, err := s.timeOffRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if to.Status != timeoff.StatusPending {
		return nil, fmt.Errorf("only pending requests can be rejected")
	}

	now := time.Now()
	to.Status = timeoff.StatusRejected
	to.ApprovedBy = &rejectedBy
	to.RejectionReason = &reason
	to.UpdatedAt = now

	if err := s.timeOffRepo.Update(ctx, to); err != nil {
		return nil, fmt.Errorf("failed to reject time off: %w", err)
	}

	return to, nil
}

func (s *HRService) UpdateTimeOff(ctx context.Context, id, userID uuid.UUID, req CreateTimeOffRequest) (*timeoff.TimeOff, error) {
	to, err := s.timeOffRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if to.UserID != userID {
		return nil, fmt.Errorf("unauthorized")
	}

	if to.Status != timeoff.StatusPending {
		return nil, fmt.Errorf("cannot edit request: current status is %s", to.Status)
	}

	to.Type = req.Type
	to.StartDate = req.StartDate
	to.EndDate = req.EndDate
	to.Reason = req.Reason
	if req.AttachmentURL != nil {
		to.AttachmentURL = req.AttachmentURL
	}
	to.UpdatedAt = time.Now()

	if err := s.timeOffRepo.Update(ctx, to); err != nil {
		return nil, fmt.Errorf("failed to update time off: %w", err)
	}

	return to, nil
}

func (s *HRService) DeleteTimeOff(ctx context.Context, id, userID uuid.UUID) error {
	to, err := s.timeOffRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if to.UserID != userID {
		return fmt.Errorf("unauthorized")
	}

	if to.Status != timeoff.StatusPending {
		return fmt.Errorf("cannot delete request: current status is %s", to.Status)
	}

	return s.timeOffRepo.Delete(ctx, id)
}

// EmployeeStats represents employee statistics
type EmployeeStats struct {
	TotalEmployees  int `json:"total_employees"`
	ActiveEmployees int `json:"active_employees"`
}

func (s *HRService) GetEmployeeStats(ctx context.Context, tenantID uuid.UUID) (*EmployeeStats, error) {
	users, err := s.userRepo.ListByTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get users: %w", err)
	}

	stats := &EmployeeStats{
		TotalEmployees:  len(users),
		ActiveEmployees: 0,
	}

	for _, user := range users {
		if user.IsActive() {
			stats.ActiveEmployees++
		}
	}

	return stats, nil
}
