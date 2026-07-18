-- Migration: Create client_package_change_logs table
-- Tracks upgrade/downgrade history when a client's service package changes

CREATE TYPE package_change_type AS ENUM ('upgrade', 'downgrade', 'change');

CREATE TABLE IF NOT EXISTS client_package_change_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    changed_by_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    change_type         package_change_type NOT NULL DEFAULT 'change',

    old_package_id      UUID,
    old_package_name    TEXT,
    old_monthly_fee     NUMERIC(12, 2) NOT NULL DEFAULT 0,

    new_package_id      UUID,
    new_package_name    TEXT,
    new_monthly_fee     NUMERIC(12, 2) NOT NULL DEFAULT 0,

    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_client_pkg_logs_tenant_client ON client_package_change_logs(tenant_id, client_id);
CREATE INDEX idx_client_pkg_logs_created_at    ON client_package_change_logs(created_at DESC);
