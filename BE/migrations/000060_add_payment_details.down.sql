-- Remove payment details from reimbursements, payslips and payroll_runs
ALTER TABLE reimbursements DROP COLUMN IF NOT EXISTS payment_method;
ALTER TABLE reimbursements DROP COLUMN IF NOT EXISTS payment_reference;

ALTER TABLE payslips DROP COLUMN IF NOT EXISTS payment_method;
ALTER TABLE payslips DROP COLUMN IF NOT EXISTS payment_reference;

ALTER TABLE payroll_runs DROP COLUMN IF NOT EXISTS payment_method;
ALTER TABLE payroll_runs DROP COLUMN IF NOT EXISTS payment_reference;
