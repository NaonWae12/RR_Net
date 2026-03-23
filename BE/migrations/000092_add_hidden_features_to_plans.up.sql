ALTER TABLE plans ADD COLUMN IF NOT EXISTS hidden_features jsonb DEFAULT '[]'::jsonb;
