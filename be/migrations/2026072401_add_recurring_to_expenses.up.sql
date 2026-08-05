ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS is_recurring      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurring_day     SMALLINT,
  ADD COLUMN IF NOT EXISTS recurring_end_at  DATE,
  ADD COLUMN IF NOT EXISTS parent_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_is_recurring ON expenses(tenant_id, is_recurring) WHERE is_recurring = TRUE;
CREATE INDEX IF NOT EXISTS idx_expenses_parent_expense_id ON expenses(parent_expense_id) WHERE parent_expense_id IS NOT NULL;
