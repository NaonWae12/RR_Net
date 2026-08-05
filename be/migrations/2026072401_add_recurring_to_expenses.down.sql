ALTER TABLE expenses
  DROP COLUMN IF EXISTS parent_expense_id,
  DROP COLUMN IF EXISTS recurring_end_at,
  DROP COLUMN IF EXISTS recurring_day,
  DROP COLUMN IF EXISTS is_recurring;
