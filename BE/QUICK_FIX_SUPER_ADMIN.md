# Quick Fix: Super Admin Login 401 Error

## Problem
Super admin login returns 401 "Invalid email or password" even though credentials are correct.

## Root Cause
Most likely the super admin account doesn't exist in the database yet. The database needs to be set up with migrations and seed data.

## Solution

### Step 1: Verify Database Setup

Run the verification script:
```powershell
cd BE
.\scripts\check_super_admin.ps1
```

### Step 2: If Account Doesn't Exist

Run the database setup script:
```powershell
cd BE
.\scripts\setup-database.ps1
```

This will:
1. Run all migrations (create tables)
2. Seed development accounts (create super admin and owner)

### Step 3: Manual Verification

If you have `psql` installed, verify manually:

```sql
-- Connect to database
psql -h localhost -p 15432 -U rrnet -d rrnet_dev

-- Check super admin
SELECT u.id, u.email, u.name, u.status, r.code as role, u.tenant_id
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.email = 'admin@rrnet.test';

-- Expected result:
-- id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- email: admin@rrnet.test
-- name: Super Admin
-- status: active
-- role: super_admin
-- tenant_id: NULL (important!)
```

### Step 4: Manual Fix (if needed)

If the account exists but has wrong data, fix it:

```sql
-- 1. Get role_id for super_admin
SELECT id FROM roles WHERE code = 'super_admin';

-- 2. Update or insert super admin user
-- Replace <role_id> with the ID from step 1
INSERT INTO users (id, tenant_id, role_id, email, password_hash, name, status, email_verified_at, created_at, updated_at)
SELECT 
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID,
    NULL, -- Super admin has no tenant
    r.id,
    'admin@rrnet.test',
    '$2a$12$tCD.zrVK4vSmXAHpjySL1.4cfQ.k4WHohzw2ClYtPIAEZUtVuqqni', -- bcrypt hash of "password"
    'Super Admin',
    'active',
    NOW(),
    NOW(),
    NOW()
FROM roles r
WHERE r.code = 'super_admin'
ON CONFLICT (id) DO UPDATE
SET 
    tenant_id = NULL,
    role_id = (SELECT id FROM roles WHERE code = 'super_admin'),
    password_hash = '$2a$12$tCD.zrVK4vSmXAHpjySL1.4cfQ.k4WHohzw2ClYtPIAEZUtVuqqni',
    status = 'active',
    updated_at = NOW();
```

## Important Notes

1. **Super Admin MUST have `tenant_id = NULL`**
   - If `tenant_id` is not NULL, the backend won't find the user when searching for super admin

2. **Password Hash**
   - The hash `$2a$12$tCD.zrVK4vSmXAHpjySL1.4cfQ.k4WHohzw2ClYtPIAEZUtVuqqni` is the bcrypt hash of "password" with cost 12
   - If you need to regenerate it, run: `go run scripts/seed_dev_accounts.go`

3. **Role Must Be `super_admin`**
   - The role code must be exactly `super_admin` (not `superadmin` or `Super Admin`)

## Testing Login

After setup, test login:

```powershell
# Super Admin (no tenant slug)
$body = @{
    email = "admin@rrnet.test"
    password = "password"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method POST -Body $body -ContentType "application/json"
```

**Expected Response:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 900,
  "user": {
    "id": "...",
    "email": "admin@rrnet.test",
    "name": "Super Admin",
    "role": "super_admin"
  }
}
```

Note: Super admin response should NOT have a `tenant` field.

---

_Last updated: Manual Testing Phase_

