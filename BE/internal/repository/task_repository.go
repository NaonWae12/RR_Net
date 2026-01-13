package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/technician"
)

type TaskRepository struct {
	db *pgxpool.Pool
}

func NewTaskRepository(db *pgxpool.Pool) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) Create(ctx context.Context, task *technician.Task) error {
	query := `
		INSERT INTO technician_tasks (
			id, tenant_id, technician_id, assigned_by, task_type, priority, title, description,
			location_type, location_id, address, latitude, longitude, status,
			scheduled_at, started_at, completed_at, estimated_hours, actual_hours, notes,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
		)
	`
	_, err := r.db.Exec(ctx, query,
		task.ID, task.TenantID, task.TechnicianID, task.AssignedBy, task.TaskType, task.Priority,
		task.Title, task.Description, task.LocationType, task.LocationID, task.Address,
		task.Latitude, task.Longitude, task.Status, task.ScheduledAt, task.StartedAt,
		task.CompletedAt, task.EstimatedHours, task.ActualHours, task.Notes,
		task.CreatedAt, task.UpdatedAt,
	)
	return err
}

func (r *TaskRepository) GetByID(ctx context.Context, id uuid.UUID) (*technician.Task, error) {
	query := `
		SELECT id, tenant_id, technician_id, assigned_by, task_type, priority, title, description,
			location_type, location_id, address, latitude, longitude, status,
			scheduled_at, started_at, completed_at, estimated_hours, actual_hours, notes,
			created_at, updated_at
		FROM technician_tasks
		WHERE id = $1
	`
	var task technician.Task
	err := r.db.QueryRow(ctx, query, id).Scan(
		&task.ID, &task.TenantID, &task.TechnicianID, &task.AssignedBy, &task.TaskType, &task.Priority,
		&task.Title, &task.Description, &task.LocationType, &task.LocationID, &task.Address,
		&task.Latitude, &task.Longitude, &task.Status, &task.ScheduledAt, &task.StartedAt,
		&task.CompletedAt, &task.EstimatedHours, &task.ActualHours, &task.Notes,
		&task.CreatedAt, &task.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("task not found")
	}
	return &task, err
}

func (r *TaskRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*technician.Task, error) {
	query := `
		SELECT id, tenant_id, technician_id, assigned_by, task_type, priority, title, description,
			location_type, location_id, address, latitude, longitude, status,
			scheduled_at, started_at, completed_at, estimated_hours, actual_hours, notes,
			created_at, updated_at
		FROM technician_tasks
		WHERE tenant_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*technician.Task
	for rows.Next() {
		var task technician.Task
		err := rows.Scan(
			&task.ID, &task.TenantID, &task.TechnicianID, &task.AssignedBy, &task.TaskType, &task.Priority,
			&task.Title, &task.Description, &task.LocationType, &task.LocationID, &task.Address,
			&task.Latitude, &task.Longitude, &task.Status, &task.ScheduledAt, &task.StartedAt,
			&task.CompletedAt, &task.EstimatedHours, &task.ActualHours, &task.Notes,
			&task.CreatedAt, &task.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, &task)
	}
	return tasks, nil
}

func (r *TaskRepository) ListByTechnician(ctx context.Context, technicianID uuid.UUID) ([]*technician.Task, error) {
	query := `
		SELECT id, tenant_id, technician_id, assigned_by, task_type, priority, title, description,
			location_type, location_id, address, latitude, longitude, status,
			scheduled_at, started_at, completed_at, estimated_hours, actual_hours, notes,
			created_at, updated_at
		FROM technician_tasks
		WHERE technician_id = $1
		ORDER BY 
			CASE status
				WHEN 'in_progress' THEN 1
				WHEN 'pending' THEN 2
				WHEN 'completed' THEN 3
				ELSE 4
			END,
			scheduled_at ASC NULLS LAST
	`
	rows, err := r.db.Query(ctx, query, technicianID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*technician.Task
	for rows.Next() {
		var task technician.Task
		err := rows.Scan(
			&task.ID, &task.TenantID, &task.TechnicianID, &task.AssignedBy, &task.TaskType, &task.Priority,
			&task.Title, &task.Description, &task.LocationType, &task.LocationID, &task.Address,
			&task.Latitude, &task.Longitude, &task.Status, &task.ScheduledAt, &task.StartedAt,
			&task.CompletedAt, &task.EstimatedHours, &task.ActualHours, &task.Notes,
			&task.CreatedAt, &task.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, &task)
	}
	return tasks, nil
}

func (r *TaskRepository) Update(ctx context.Context, task *technician.Task) error {
	query := `
		UPDATE technician_tasks
		SET task_type = $2, priority = $3, title = $4, description = $5,
			location_type = $6, location_id = $7, address = $8, latitude = $9, longitude = $10,
			status = $11, scheduled_at = $12, started_at = $13, completed_at = $14,
			estimated_hours = $15, actual_hours = $16, notes = $17, updated_at = $18
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query,
		task.ID, task.TaskType, task.Priority, task.Title, task.Description,
		task.LocationType, task.LocationID, task.Address, task.Latitude, task.Longitude,
		task.Status, task.ScheduledAt, task.StartedAt, task.CompletedAt,
		task.EstimatedHours, task.ActualHours, task.Notes, task.UpdatedAt,
	)
	return err
}

func (r *TaskRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status technician.TaskStatus, startedAt, completedAt *time.Time) error {
	query := `
		UPDATE technician_tasks
		SET status = $2, started_at = $3, completed_at = $4, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, status, startedAt, completedAt)
	return err
}

func (r *TaskRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM technician_tasks WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *TaskRepository) GetSummary(ctx context.Context, tenantID uuid.UUID, technicianID *uuid.UUID) (*technician.TaskSummary, error) {
	baseQuery := `FROM technician_tasks WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if technicianID != nil {
		baseQuery += fmt.Sprintf(" AND technician_id = $%d", argIdx)
		args = append(args, *technicianID)
		argIdx++
	}

	query := fmt.Sprintf(`
		SELECT
			COUNT(*) FILTER (WHERE status != 'cancelled') as total_tasks,
			COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
			COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
			COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
			COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress') AND scheduled_at < NOW()) as overdue_tasks
		%s
	`, baseQuery)

	var summary technician.TaskSummary
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&summary.TotalTasks, &summary.PendingTasks, &summary.InProgressTasks,
		&summary.CompletedTasks, &summary.OverdueTasks,
	)
	return &summary, err
}

