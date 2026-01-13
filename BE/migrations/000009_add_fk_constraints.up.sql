-- Migration: Add foreign key for tenants.plan_id
-- Separated because plans table must exist first

ALTER TABLE tenants
ADD CONSTRAINT fk_tenants_plan_id
FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;

