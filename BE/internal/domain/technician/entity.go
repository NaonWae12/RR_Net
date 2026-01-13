package technician

import (
	"time"

	"github.com/google/uuid"
)

// TaskStatus defines the status of a technician task
type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusCompleted  TaskStatus = "completed"
	TaskStatusCancelled  TaskStatus = "cancelled"
)

// TaskType defines the type of technician task
type TaskType string

const (
	TaskTypeInstallation TaskType = "installation"
	TaskTypeMaintenance  TaskType = "maintenance"
	TaskTypeRepair       TaskType = "repair"
	TaskTypeInspection   TaskType = "inspection"
	TaskTypeOutage       TaskType = "outage"
	TaskTypeOther        TaskType = "other"
)

// TaskPriority defines task priority levels
type TaskPriority string

const (
	TaskPriorityLow      TaskPriority = "low"
	TaskPriorityNormal   TaskPriority = "normal"
	TaskPriorityHigh     TaskPriority = "high"
	TaskPriorityCritical TaskPriority = "critical"
)

// Task represents a technician field task
type Task struct {
	ID              uuid.UUID     `json:"id"`
	TenantID        uuid.UUID     `json:"tenant_id"`
	TechnicianID    uuid.UUID     `json:"technician_id"`
	AssignedBy      uuid.UUID     `json:"assigned_by"`
	TaskType        TaskType      `json:"task_type"`
	Priority        TaskPriority  `json:"priority"`
	Title           string        `json:"title"`
	Description     string        `json:"description"`
	LocationType    string        `json:"location_type"` // "odc", "odp", "client", "address"
	LocationID      *uuid.UUID    `json:"location_id,omitempty"`
	Address         string        `json:"address,omitempty"`
	Latitude        *float64      `json:"latitude,omitempty"`
	Longitude       *float64      `json:"longitude,omitempty"`
	Status          TaskStatus    `json:"status"`
	ScheduledAt     *time.Time    `json:"scheduled_at,omitempty"`
	StartedAt       *time.Time    `json:"started_at,omitempty"`
	CompletedAt     *time.Time    `json:"completed_at,omitempty"`
	EstimatedHours *float64      `json:"estimated_hours,omitempty"`
	ActualHours     *float64      `json:"actual_hours,omitempty"`
	Notes           string        `json:"notes,omitempty"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

// ActivityLog represents a technician activity log entry
type ActivityLog struct {
	ID            uuid.UUID  `json:"id"`
	TenantID      uuid.UUID  `json:"tenant_id"`
	TechnicianID  uuid.UUID  `json:"technician_id"`
	TaskID        *uuid.UUID `json:"task_id,omitempty"`
	ActivityType  string     `json:"activity_type"` // "check_in", "check_out", "task_start", "task_complete", "photo_upload", "note", "outage_update"
	Description   string     `json:"description"`
	LocationType  string     `json:"location_type,omitempty"` // "odc", "odp", "client"
	LocationID    *uuid.UUID `json:"location_id,omitempty"`
	Latitude      *float64   `json:"latitude,omitempty"`
	Longitude     *float64   `json:"longitude,omitempty"`
	PhotoURLs     []string   `json:"photo_urls,omitempty"`
	Metadata      string     `json:"metadata,omitempty"` // JSON string for additional data
	CreatedAt     time.Time  `json:"created_at"`
}

// TaskAssignment represents assignment of a task to a technician
type TaskAssignment struct {
	ID           uuid.UUID  `json:"id"`
	TenantID     uuid.UUID  `json:"tenant_id"`
	TaskID       uuid.UUID  `json:"task_id"`
	TechnicianID uuid.UUID  `json:"technician_id"`
	AssignedBy   uuid.UUID  `json:"assigned_by"`
	AssignedAt   time.Time  `json:"assigned_at"`
	Notes        string     `json:"notes,omitempty"`
}

// TaskSummary provides summary statistics for technician tasks
type TaskSummary struct {
	TotalTasks      int `json:"total_tasks"`
	PendingTasks    int `json:"pending_tasks"`
	InProgressTasks int `json:"in_progress_tasks"`
	CompletedTasks  int `json:"completed_tasks"`
	OverdueTasks    int `json:"overdue_tasks"`
}

// IsOverdue checks if task is overdue
func (t *Task) IsOverdue() bool {
	if t.ScheduledAt == nil {
		return false
	}
	return time.Now().After(*t.ScheduledAt) && t.Status != TaskStatusCompleted && t.Status != TaskStatusCancelled
}

// CanStart checks if task can be started
func (t *Task) CanStart() bool {
	return t.Status == TaskStatusPending
}

// CanComplete checks if task can be completed
func (t *Task) CanComplete() bool {
	return t.Status == TaskStatusInProgress || t.Status == TaskStatusPending
}

