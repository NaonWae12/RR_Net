-- Rollback: billing tempo templates + client payment tempo fields

-- Drop client columns first (remove dependent FK)
ALTER TABLE clients
    DROP COLUMN IF EXISTS payment_tempo_template_id,
    DROP COLUMN IF EXISTS payment_due_day,
    DROP COLUMN IF EXISTS payment_tempo_option;

DROP TABLE IF EXISTS billing_tempo_templates;


