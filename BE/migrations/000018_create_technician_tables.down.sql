DROP INDEX IF EXISTS idx_activity_logs_activity_type;
DROP INDEX IF EXISTS idx_activity_logs_created_at;
DROP INDEX IF EXISTS idx_activity_logs_task_id;
DROP INDEX IF EXISTS idx_activity_logs_technician_id;
DROP INDEX IF EXISTS idx_activity_logs_tenant_id;
DROP TABLE IF EXISTS technician_activity_logs;

DROP INDEX IF EXISTS idx_technician_tasks_location;
DROP INDEX IF EXISTS idx_technician_tasks_scheduled_at;
DROP INDEX IF EXISTS idx_technician_tasks_status;
DROP INDEX IF EXISTS idx_technician_tasks_technician_id;
DROP INDEX IF EXISTS idx_technician_tasks_tenant_id;
DROP TABLE IF EXISTS technician_tasks;

