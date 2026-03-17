-- Add payment details to reimbursements, payslips and payroll_runs
ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);
