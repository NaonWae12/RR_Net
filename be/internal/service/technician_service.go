package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/technician"
	"rrnet/internal/repository"
)

type TechnicianService struct {
	taskRepo        *repository.TaskRepository
	activityLogRepo *repository.ActivityLogRepository
}

func NewTechnicianService(
	taskRepo *repository.TaskRepository,
	activityLogRepo *repository.ActivityLogRepository,
) *TechnicianService {
	return &TechnicianService{
		taskRepo:        taskRepo,
		activityLogRepo: activityLogRepo,
	}
}

// ========== Task Operations ==========

type CreateTaskRequest struct {
	TechnicianID   uuid.UUID               `json:"technician_id"`
	TaskType       technician.TaskType     `json:"task_type"`
	Priority       technician.TaskPriority `json:"priority"`
	Title          string                  `json:"title"`
	Description    string                  `json:"description"`
	LocationType   string                  `json:"location_type,omitempty"`
	LocationID     *uuid.UUID              `json:"location_id,omitempty"`
	Address        string                  `json:"address,omitempty"`
	Latitude       *float64                `json:"latitude,omitempty"`
	Longitude      *float64                `json:"longitude,omitempty"`
	ScheduledAt    *time.Time              `json:"scheduled_at,omitempty"`
	EstimatedHours *float64                `json:"estimated_hours,omitempty"`
	Notes          string                  `json:"notes,omitempty"`
}

func (s *TechnicianService) CreateTask(ctx context.Context, tenantID, assignedBy uuid.UUID, req CreateTaskRequest) (*technician.Task, error) {
	now := time.Now()
	task := &technician.Task{
		ID:             uuid.New(),
		TenantID:       tenantID,
		TechnicianID:   req.TechnicianID,
		AssignedBy:     assignedBy,
		TaskType:       req.TaskType,
		Priority:       req.Priority,
		Title:          req.Title,
		Description:    req.Description,
		LocationType:   req.LocationType,
		LocationID:     req.LocationID,
		Address:        req.Address,
		Latitude:       req.Latitude,
		Longitude:      req.Longitude,
		Status:         technician.TaskStatusPending,
		ScheduledAt:    req.ScheduledAt,
		EstimatedHours: req.EstimatedHours,
		Notes:          req.Notes,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if req.Priority == "" {
		task.Priority = technician.TaskPriorityNormal
	}

	if err := s.taskRepo.Create(ctx, task); err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}

	// Log task assignment
	activityLog := &technician.ActivityLog{
		ID:           uuid.New(),
		TenantID:     tenantID,
		TechnicianID: req.TechnicianID,
		TaskID:       &task.ID,
		ActivityType: "task_assigned",
		Description:  fmt.Sprintf("Task '%s' assigned to technician", task.Title),
		CreatedAt:    now,
	}
	_ = s.activityLogRepo.Create(ctx, activityLog)

	return task, nil
}

func (s *TechnicianService) GetTask(ctx context.Context, id uuid.UUID) (*technician.Task, error) {
	return s.taskRepo.GetByID(ctx, id)
}

func (s *TechnicianService) ListTasks(ctx context.Context, tenantID uuid.UUID) ([]*technician.Task, error) {
	return s.taskRepo.ListByTenant(ctx, tenantID)
}

func (s *TechnicianService) ListTasksByTechnician(ctx context.Context, technicianID uuid.UUID) ([]*technician.Task, error) {
	return s.taskRepo.ListByTechnician(ctx, technicianID)
}

type UpdateTaskRequest struct {
	TaskType       *technician.TaskType     `json:"task_type,omitempty"`
	Priority       *technician.TaskPriority `json:"priority,omitempty"`
	Title          *string                  `json:"title,omitempty"`
	Description    *string                  `json:"description,omitempty"`
	LocationType   *string                  `json:"location_type,omitempty"`
	LocationID     *uuid.UUID               `json:"location_id,omitempty"`
	Address        *string                  `json:"address,omitempty"`
	Latitude       *float64                 `json:"latitude,omitempty"`
	Longitude      *float64                 `json:"longitude,omitempty"`
	ScheduledAt    *time.Time               `json:"scheduled_at,omitempty"`
	EstimatedHours *float64                 `json:"estimated_hours,omitempty"`
	Notes          *string                  `json:"notes,omitempty"`
}

func (s *TechnicianService) UpdateTask(ctx context.Context, id uuid.UUID, req UpdateTaskRequest) (*technician.Task, error) {
	task, err := s.taskRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.TaskType != nil {
		task.TaskType = *req.TaskType
	}
	if req.Priority != nil {
		task.Priority = *req.Priority
	}
	if req.Title != nil {
		task.Title = *req.Title
	}
	if req.Description != nil {
		task.Description = *req.Description
	}
	if req.LocationType != nil {
		task.LocationType = *req.LocationType
	}
	if req.LocationID != nil {
		task.LocationID = req.LocationID
	}
	if req.Address != nil {
		task.Address = *req.Address
	}
	if req.Latitude != nil {
		task.Latitude = req.Latitude
	}
	if req.Longitude != nil {
		task.Longitude = req.Longitude
	}
	if req.ScheduledAt != nil {
		task.ScheduledAt = req.ScheduledAt
	}
	if req.EstimatedHours != nil {
		task.EstimatedHours = req.EstimatedHours
	}
	if req.Notes != nil {
		task.Notes = *req.Notes
	}
	task.UpdatedAt = time.Now()

	if err := s.taskRepo.Update(ctx, task); err != nil {
		return nil, fmt.Errorf("failed to update task: %w", err)
	}

	return task, nil
}

func (s *TechnicianService) StartTask(ctx context.Context, id, technicianID uuid.UUID) (*technician.Task, error) {
	task, err := s.taskRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if task.TechnicianID != technicianID {
		return nil, fmt.Errorf("task not assigned to this technician")
	}

	if !task.CanStart() {
		return nil, fmt.Errorf("task cannot be started in current status")
	}

	now := time.Now()
	task.Status = technician.TaskStatusInProgress
	task.StartedAt = &now
	task.UpdatedAt = now

	if err := s.taskRepo.UpdateStatus(ctx, id, task.Status, task.StartedAt, task.CompletedAt); err != nil {
		return nil, fmt.Errorf("failed to start task: %w", err)
	}

	// Log task start
	activityLog := &technician.ActivityLog{
		ID:           uuid.New(),
		TenantID:     task.TenantID,
		TechnicianID: technicianID,
		TaskID:       &task.ID,
		ActivityType: "task_start",
		Description:  fmt.Sprintf("Started task: %s", task.Title),
		CreatedAt:    now,
	}
	_ = s.activityLogRepo.Create(ctx, activityLog)

	return task, nil
}

func (s *TechnicianService) CompleteTask(ctx context.Context, id, technicianID uuid.UUID, actualHours *float64, notes string) (*technician.Task, error) {
	task, err := s.taskRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if task.TechnicianID != technicianID {
		return nil, fmt.Errorf("task not assigned to this technician")
	}

	if !task.CanComplete() {
		return nil, fmt.Errorf("task cannot be completed in current status")
	}

	now := time.Now()
	task.Status = technician.TaskStatusCompleted
	task.CompletedAt = &now
	if actualHours != nil {
		task.ActualHours = actualHours
	}
	if notes != "" {
		if task.Notes != "" {
			task.Notes += "\n\n" + notes
		} else {
			task.Notes = notes
		}
	}
	task.UpdatedAt = now

	if err := s.taskRepo.Update(ctx, task); err != nil {
		return nil, fmt.Errorf("failed to complete task: %w", err)
	}

	// Log task completion
	actualHoursValue := 0.0
	if task.ActualHours != nil {
		actualHoursValue = *task.ActualHours
	}
	activityLog := &technician.ActivityLog{
		ID:           uuid.New(),
		TenantID:     task.TenantID,
		TechnicianID: technicianID,
		TaskID:       &task.ID,
		ActivityType: "task_complete",
		Description:  fmt.Sprintf("Completed task: %s", task.Title),
		Metadata:     fmt.Sprintf(`{"actual_hours": %f}`, actualHoursValue),
		CreatedAt:    now,
	}
	_ = s.activityLogRepo.Create(ctx, activityLog)

	return task, nil
}

func (s *TechnicianService) CancelTask(ctx context.Context, id uuid.UUID) error {
	task, err := s.taskRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	task.Status = technician.TaskStatusCancelled
	task.UpdatedAt = time.Now()

	return s.taskRepo.Update(ctx, task)
}

func (s *TechnicianService) DeleteTask(ctx context.Context, id uuid.UUID) error {
	return s.taskRepo.Delete(ctx, id)
}

func (s *TechnicianService) GetTaskSummary(ctx context.Context, tenantID uuid.UUID, technicianID *uuid.UUID) (*technician.TaskSummary, error) {
	return s.taskRepo.GetSummary(ctx, tenantID, technicianID)
}

// ========== Activity Log Operations ==========

type LogActivityRequest struct {
	TaskID       *uuid.UUID  `json:"task_id,omitempty"`
	ActivityType string      `json:"activity_type"`
	Description  string      `json:"description"`
	LocationType string      `json:"location_type,omitempty"`
	LocationID   *uuid.UUID  `json:"location_id,omitempty"`
	Latitude     *float64    `json:"latitude,omitempty"`
	Longitude    *float64    `json:"longitude,omitempty"`
	PhotoURLs    []string    `json:"photo_urls,omitempty"`
	Metadata     interface{} `json:"metadata,omitempty"`
}

func (s *TechnicianService) LogActivity(ctx context.Context, tenantID, technicianID uuid.UUID, req LogActivityRequest) (*technician.ActivityLog, error) {
	now := time.Now()
	log := &technician.ActivityLog{
		ID:           uuid.New(),
		TenantID:     tenantID,
		TechnicianID: technicianID,
		TaskID:       req.TaskID,
		ActivityType: req.ActivityType,
		Description:  req.Description,
		LocationType: req.LocationType,
		LocationID:   req.LocationID,
		Latitude:     req.Latitude,
		Longitude:    req.Longitude,
		PhotoURLs:    req.PhotoURLs,
		CreatedAt:    now,
	}

	if err := s.activityLogRepo.LogActivity(ctx, log, req.Metadata); err != nil {
		return nil, fmt.Errorf("failed to log activity: %w", err)
	}

	return log, nil
}

func (s *TechnicianService) ListActivityLogs(ctx context.Context, tenantID uuid.UUID, technicianID *uuid.UUID, limit int) ([]*technician.ActivityLog, error) {
	if technicianID != nil {
		return s.activityLogRepo.ListByTechnician(ctx, *technicianID, limit)
	}
	return s.activityLogRepo.ListByTenant(ctx, tenantID, limit)
}

func (s *TechnicianService) ListActivityLogsByTask(ctx context.Context, taskID uuid.UUID) ([]*technician.ActivityLog, error) {
	return s.activityLogRepo.ListByTask(ctx, taskID)
}
