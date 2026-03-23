package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"rrnet/internal/domain/network"
)

type RouterSyncRepository struct {
	db *pgxpool.Pool
}

func NewRouterSyncRepository(db *pgxpool.Pool) *RouterSyncRepository {
	return &RouterSyncRepository{db: db}
}

// CreateTask saves a new decommission task
func (r *RouterSyncRepository) CreateTask(ctx context.Context, task *network.RouterDecommissionTask) error {
	query := `
		INSERT INTO router_decommission_tasks (
			id, router_id, target_router_id, task_type, reference_id, status, 
			error_message, attempt, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.Exec(ctx, query,
		task.ID, task.RouterID, task.TargetRouterID, task.TaskType, task.ReferenceID, task.Status,
		task.ErrorMessage, task.Attempt, task.CreatedAt, task.UpdatedAt,
	)
	return err
}

// BulkCreateTasks creates multiple tasks in one transaction
func (r *RouterSyncRepository) BulkCreateTasks(ctx context.Context, tasks []*network.RouterDecommissionTask) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, task := range tasks {
		query := `
			INSERT INTO router_decommission_tasks (
				id, router_id, target_router_id, task_type, reference_id, status, 
				attempt, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`
		_, err := tx.Exec(ctx, query,
			task.ID, task.RouterID, task.TargetRouterID, task.TaskType, task.ReferenceID,
			task.Status, task.Attempt, task.CreatedAt, task.UpdatedAt,
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// GetPendingTasks gets tasks that need to be processed
func (r *RouterSyncRepository) GetPendingTasks(ctx context.Context, routerID uuid.UUID, limit int) ([]*network.RouterDecommissionTask, error) {
	query := `
		SELECT id, router_id, target_router_id, task_type, reference_id, status, error_message, attempt, created_at, updated_at
		FROM router_decommission_tasks
		WHERE router_id = $1 AND status IN ('pending', 'failed') AND attempt < 5
		ORDER BY created_at ASC
		LIMIT $2
	`
	rows, err := r.db.Query(ctx, query, routerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*network.RouterDecommissionTask
	for rows.Next() {
		var t network.RouterDecommissionTask
		err := rows.Scan(
			&t.ID, &t.RouterID, &t.TargetRouterID, &t.TaskType, &t.ReferenceID, &t.Status,
			&t.ErrorMessage, &t.Attempt, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, &t)
	}
	return tasks, nil
}

// UpdateTaskStatus updates a task progress
func (r *RouterSyncRepository) UpdateTaskStatus(ctx context.Context, id uuid.UUID, status network.RouterDecommissionTaskStatus, errMsg string) error {
	query := `
		UPDATE router_decommission_tasks 
		SET status = $2, error_message = $3, attempt = attempt + 1, updated_at = NOW() 
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id, status, errMsg)
	return err
}

// GetRouterProgress counts total and completed tasks
func (r *RouterSyncRepository) GetRouterProgress(ctx context.Context, routerID uuid.UUID) (completed int, total int, err error) {
	query := `
		SELECT 
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE status = 'completed') as completed
		FROM router_decommission_tasks
		WHERE router_id = $1
	`
	err = r.db.QueryRow(ctx, query, routerID).Scan(&total, &completed)
	return completed, total, err
}

// ClearTasks deletes tasks once decommissioning is 100% done
func (r *RouterSyncRepository) ClearTasks(ctx context.Context, routerID uuid.UUID) error {
	query := `DELETE FROM router_decommission_tasks WHERE router_id = $1`
	_, err := r.db.Exec(ctx, query, routerID)
	return err
}
