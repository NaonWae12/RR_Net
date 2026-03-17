ALTER TABLE payroll_runs DROP COLUMN payment_method_id;
ALTER TABLE payroll_runs ADD COLUMN payment_method VARCHAR(100);

ALTER TABLE payslips DROP COLUMN payment_method_id;
ALTER TABLE payslips ADD COLUMN payment_method VARCHAR(100);

ALTER TABLE reimbursements DROP COLUMN payment_method_id;
ALTER TABLE reimbursements ADD COLUMN payment_method VARCHAR(100);

DROP TABLE IF EXISTS payment_methods;
