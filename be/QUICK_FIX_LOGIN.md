# Quick Fix: Login 401 Error

## Step 1: Verify Database Setup

Jalankan query berikut untuk cek apakah data sudah ada:

```sql
-- Connect ke database
psql -h localhost -p 15432 -U rrnet -d rrnet_dev

-- 1. Cek tenant
SELECT id, name, slug, status FROM tenants WHERE slug = 'acme';

-- 2. Cek owner user
SELECT u.id, u.email, u.name, u.status, r.code as role, u.tenant_id
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.email = 'owner@acme.test';

-- 3. Cek password hash
SELECT email, LEFT(password_hash, 20) as hash_preview FROM users WHERE email = 'owner@acme.test';
```

## Step 2: Jika Data Tidak Ada

Jalankan setup script:

```powershell
cd BE
.\scripts\setup-database.ps1
```

Atau manual:

```powershell
# 1. Run migrations
migrate -path ./migrations -database "postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable" up

# 2. Seed data
$env:PGPASSWORD = "rrnet_secret"
psql -h localhost -p 15432 -U rrnet -d rrnet_dev -f migrations/seed/001_dev_accounts.sql
```

## Step 3: Test Login dengan cURL

### Test Owner Login (dengan X-Tenant-Slug):

```powershell
$body = @{
    email = "owner@acme.test"
    password = "password"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "X-Tenant-Slug" = "acme"
}

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method POST -Body $body -Headers $headers
```

**Expected Response:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 900,
  "user": {
    "id": "...",
    "email": "owner@acme.test",
    "name": "Owner Acme",
    "role": "owner"
  },
  "tenant": {
    "id": "...",
    "name": "Acme Networks",
    "slug": "acme",
    "status": "active"
  }
}
```

## Step 4: Debug Backend Logs

Cek backend logs saat login untuk melihat error detail:

1. Buka terminal backend
2. Coba login dari frontend
3. Lihat log output di backend terminal

**Kemungkinan error di log:**
- `[tenant_ctx] slug not found slug=acme` → Tenant tidak ada
- `[tenant_ctx] tenant not active` → Tenant status bukan active
- `invalid email or password` → User tidak ditemukan atau password salah

## Step 5: Fix Common Issues

### Issue 1: Tenant tidak ditemukan
```sql
-- Cek tenant
SELECT * FROM tenants WHERE slug = 'acme';

-- Jika tidak ada, insert manual:
INSERT INTO tenants (id, name, slug, status, billing_status, created_at, updated_at)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID,
    'Acme Networks',
    'acme',
    'active',
    'active',
    NOW(),
    NOW()
);
```

### Issue 2: User tidak ditemukan
```sql
-- Cek user
SELECT * FROM users WHERE email = 'owner@acme.test';

-- Jika tidak ada, insert manual (perlu role_id dan tenant_id):
-- 1. Get role_id untuk 'owner'
SELECT id FROM roles WHERE code = 'owner';

-- 2. Get tenant_id
SELECT id FROM tenants WHERE slug = 'acme';

-- 3. Insert user (ganti role_id dan tenant_id dengan hasil query di atas)
INSERT INTO users (id, tenant_id, role_id, email, password_hash, name, status, email_verified_at, created_at, updated_at)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::UUID, -- tenant_id
    '<role_id_dari_query_1>', -- role_id untuk owner
    'owner@acme.test',
    '$2a$12$tCD.zrVK4vSmXAHpjySL1.4cfQ.k4WHohzw2ClYtPIAEZUtVuqqni', -- bcrypt hash of "password"
    'Owner Acme',
    'active',
    NOW(),
    NOW(),
    NOW()
);
```

### Issue 3: Password hash salah
```sql
-- Generate hash baru dengan Go:
cd BE
go run scripts/seed_dev_accounts.go

-- Copy hash yang dihasilkan, lalu update:
UPDATE users 
SET password_hash = '<hash_dari_go_script>'
WHERE email = 'owner@acme.test';
```

### Issue 4: User status tidak active
```sql
UPDATE users SET status = 'active' WHERE email = 'owner@acme.test';
```

### Issue 5: Tenant status tidak active
```sql
UPDATE tenants SET status = 'active' WHERE slug = 'acme';
```

## Step 6: Verify Frontend Request

Pastikan frontend mengirim header `X-Tenant-Slug`:

1. Buka browser DevTools (F12)
2. Tab Network
3. Coba login
4. Cek request ke `/api/v1/auth/login`
5. Pastikan header `X-Tenant-Slug: acme` ada

Jika header tidak ada, cek `fe/src/lib/api/authService.ts` dan pastikan `tenantSlug` dikirim dengan benar.

## Step 7: Check Backend Middleware Order

Pastikan `TenantContext` middleware dijalankan sebelum auth handler. Cek `BE/internal/http/router/router.go` untuk urutan middleware.

---

**Jika semua langkah di atas sudah dilakukan tapi masih error, cek backend logs untuk error detail!**

