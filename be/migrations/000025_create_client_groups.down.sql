-- Rollback: Drop clients.group_id and client_groups

ALTER TABLE clients
    DROP COLUMN IF EXISTS group_id;

DROP TABLE IF EXISTS client_groups;


