ALTER TABLE reimbursements 
ADD COLUMN pay_with_payroll BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN paid_with_payroll_id UUID;
