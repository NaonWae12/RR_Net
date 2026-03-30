-- Migration: Create router_decommission_tasks table
-- Target: High-scale router removal with client synchronization

CREATE TABLE IF NOT EXISTS router_decommission_tasks (
    id UUID PRIMARY KEY,
    router_id UUID NOT NULL,
    target_router_id UUID,
    task_type VARCHAR(50) NOT NULL,
    reference_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    attempt INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for fast worker retrieval
CREATE INDEX IF NOT EXISTS idx_router_decommission_tasks_router_id ON router_decommission_tasks(router_id);
CREATE INDEX IF NOT EXISTS idx_router_decommission_tasks_status ON router_decommission_tasks(status);
