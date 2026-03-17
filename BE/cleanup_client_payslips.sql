-- CLEANUP: Delete ALL existing payslips and runs to start fresh
-- This will remove all payroll data so you can start clean

-- Step 1: Delete all payslip items
DELETE FROM payslip_items;

-- Step 2: Delete all payslips
DELETE FROM payslips;

-- Step 3: Delete all payroll runs
DELETE FROM payroll_runs;

-- Verify: Should return 0 rows
SELECT COUNT(*) as total_payslips FROM payslips;
SELECT COUNT(*) as total_runs FROM payroll_runs;

-- Show all users (for reference - only create payslips for technicians)
SELECT 
    u.id,
    u.name,
    u.email,
    r.code as role,
    u.base_salary
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.code != 'client'
ORDER BY r.code, u.name;
