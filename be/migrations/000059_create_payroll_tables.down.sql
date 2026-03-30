-- Migration: Drop payroll tables and remove base_salary from users

DROP TABLE IF EXISTS payslip_items;
DROP TABLE IF EXISTS payslips;
DROP TABLE IF EXISTS payroll_runs;

ALTER TABLE users DROP COLUMN IF EXISTS base_salary;
