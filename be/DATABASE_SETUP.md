# Database Setup Guide

Panduan lengkap untuk setup database, migrations, dan seed data untuk development.

---

## Prerequisites

1. **PostgreSQL** running (via Docker atau native)
2. **golang-migrate** CLI installed
3. **Database** `rrnet_dev` sudah dibuat

---

## Step 1: Install golang-migrate

### Windows (PowerShell)
```powershell
# Menggunakan scoop
scoop install migrate

# Atau menggunakan go install
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```

### macOS
```bash
brew install golang-migrate
```

### Linux
```bash
# Download binary
curl -L https://github.com/golang-migrate/migrate/releases/download/v4.16.2/migrate.linux-amd64.tar.gz | tar xvz
sudo mv migrate /usr/local/bin/migrate
```

---

## Step 2: Setup Database Connection

Pastikan database `rrnet_dev` sudah dibuat:

```sql
-- Via psql
psql -h localhost -p 15432 -U rrnet -d postgres
CREATE DATABASE rrnet_dev;
\q
```

Atau jika menggunakan Docker:
```bash
docker exec -it rrnet-postgres psql -U rrnet -d postgres -c "CREATE DATABASE rrnet_dev;"
```

---

## Step 3: Run Migrations

Jalankan semua migrations untuk membuat tabel-tabel:

```bash
cd BE

# Windows PowerShell
migrate -path ./migrations -database "postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable" up

# Linux/macOS
migrate -path ./migrations -database "postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable" up
```

**Expected output:**
```
18/u create_technician_tables (123.456ms)
```

---

## Step 4: Verify Migrations

Cek versi migration saat ini:

```bash
migrate -path ./migrations -database "postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable" version
```

**Expected output:**
```
18
```

---

## Step 5: Seed Development Accounts

Jalankan seed script untuk membuat akun development:

```bash
# Windows PowerShell
psql -h localhost -p 15432 -U rrnet -d rrnet_dev -f migrations/seed/001_dev_accounts.sql

# Linux/macOS
psql -h localhost -p 15432 -U rrnet -d rrnet_dev -f migrations/seed/001_dev_accounts.sql
```

Atau via Docker:
```bash
docker exec -i rrnet-postgres psql -U rrnet -d rrnet_dev < BE/migrations/seed/001_dev_accounts.sql
```

**Expected output:**
```
NOTICE:  Seed verification:
NOTICE:    Super Admin accounts: 1
NOTICE:    Owner accounts: 1
NOTICE:    Tenants: 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
UPDATE 1
```

---

## Step 6: Verify Seed Data

Cek apakah akun sudah terbuat:

```sql
-- Connect to database
psql -h localhost -p 15432 -U rrnet -d rrnet_dev

-- Check Super Admin
SELECT id, email, name, status FROM users WHERE email = 'admin@rrnet.test';

-- Check Owner
SELECT id, email, name, status FROM users WHERE email = 'owner@acme.test';

-- Check Tenant
SELECT id, name, slug, status FROM tenants WHERE slug = 'acme';

-- Check Roles
SELECT code, name FROM roles ORDER BY code;
```

---

## Development Accounts

Setelah seed berhasil, akun berikut tersedia:

### Super Admin
- **Email:** `admin@rrnet.test`
- **Password:** `password`
- **Role:** `super_admin`
- **Tenant:** None (platform-level)

### Tenant Owner (Acme Networks)
- **Email:** `owner@acme.test`
- **Password:** `password`
- **Role:** `owner`
- **Tenant:** `acme`
- **Tenant Slug:** `acme` (gunakan di header `X-Tenant-Slug`)

---

## Troubleshooting

### Error: "relation does not exist"
**Penyebab:** Migrations belum dijalankan.

**Solusi:**
```bash
# Jalankan migrations dulu
migrate -path ./migrations -database "postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable" up
```

### Error: "duplicate key value violates unique constraint"
**Penyebab:** Seed data sudah pernah dijalankan.

**Solusi:** Seed script menggunakan `ON CONFLICT DO NOTHING`, jadi aman dijalankan berulang kali. Jika ingin reset, hapus data manual:

```sql
DELETE FROM users WHERE email IN ('admin@rrnet.test', 'owner@acme.test');
DELETE FROM tenants WHERE slug = 'acme';
```

### Error: "password authentication failed"
**Penyebab:** Username/password database salah.

**Solusi:** Cek `DATABASE_CONNECTION_INFO.md` untuk kredensial yang benar:
- Host: `localhost`
- Port: `15432`
- Database: `rrnet_dev`
- Username: `rrnet`
- Password: `rrnet_secret`

### Error: "connection refused"
**Penyebab:** PostgreSQL tidak running.

**Solusi:**
```bash
# Cek status Docker container
docker ps | grep rrnet-postgres

# Jika tidak running, start container
docker-compose up -d postgres
```

---

## Rollback Migrations

Jika perlu rollback migration terakhir:

```bash
migrate -path ./migrations -database "postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable" down 1
```

**⚠️ Warning:** Rollback akan menghapus data! Backup dulu jika ada data penting.

---

## Reset Database (Development Only)

Untuk reset database dari awal:

```bash
# 1. Drop database
psql -h localhost -p 15432 -U rrnet -d postgres -c "DROP DATABASE IF EXISTS rrnet_dev;"

# 2. Create database baru
psql -h localhost -p 15432 -U rrnet -d postgres -c "CREATE DATABASE rrnet_dev;"

# 3. Run migrations
migrate -path ./migrations -database "postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable" up

# 4. Seed data
psql -h localhost -p 15432 -U rrnet -d rrnet_dev -f migrations/seed/001_dev_accounts.sql
```

---

## Quick Setup Script (PowerShell)

Buat file `BE/scripts/setup-database.ps1`:

```powershell
# Setup Database Script
$DB_URL = "postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable"
$MIGRATIONS_PATH = "./migrations"
$SEED_PATH = "./migrations/seed/001_dev_accounts.sql"

Write-Host "Step 1: Running migrations..." -ForegroundColor Yellow
migrate -path $MIGRATIONS_PATH -database $DB_URL up

Write-Host "Step 2: Seeding development accounts..." -ForegroundColor Yellow
psql -h localhost -p 15432 -U rrnet -d rrnet_dev -f $SEED_PATH

Write-Host "Database setup complete!" -ForegroundColor Green
```

Jalankan:
```powershell
cd BE
.\scripts\setup-database.ps1
```

---

_Last updated: Manual Testing Phase_

