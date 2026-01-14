# VPS Database Guide

## Overview

Dokumentasi ini menjelaskan cara mengecek database PostgreSQL di VPS, termasuk cara melihat database, tabel, dan isi tabel.

## Prerequisites

- Akses SSH ke VPS: `ssh root@72.60.74.209`
- PostgreSQL terinstall di VPS
- User database: `rrnet`
- Password database: `rrnet_secret`
- Database name: `rrnet_dev`

## Koneksi ke Database

### 0. Fix Authentication (Jika Error Password)

**Jika mendapat error "password authentication failed", jalankan script fix:**

```bash
# SSH ke VPS
ssh root@72.60.74.209

# Pull latest changes
cd /opt/rrnet
git pull origin main

# Run fix script
chmod +x scripts/fix_postgres_auth.sh
./scripts/fix_postgres_auth.sh
```

Script ini akan:

- Membuat/reset user `rrnet` dengan password `rrnet_secret`
- Memberikan privileges yang diperlukan
- Test koneksi

### 1. Koneksi via psql (Command Line)

```bash
# SSH ke VPS
ssh root@72.60.74.209

# Koneksi ke PostgreSQL sebagai user rrnet
psql -U rrnet -d rrnet_dev

# Atau dengan password langsung (recommended)
PGPASSWORD=rrnet_secret psql -U rrnet -d rrnet_dev -h localhost
```

### 2. Koneksi via psql dengan spesifikasi lengkap

```bash
psql -h localhost -U rrnet -d rrnet_dev
# Masukkan password: rrnet_secret
```

## Basic Database Operations

### 1. Cek Database yang Ada

```sql
-- List semua database
\l

-- Atau query langsung
SELECT datname FROM pg_database WHERE datistemplate = false;
```

**Output contoh:**

```
   Name    |  Owner   | Encoding |   Collate   |    Ctype    | ICU Locale | Locale Provider |   Access privileges
-----------+----------+----------+-------------+-------------+------------+-----------------+-----------------------
 postgres  | postgres | UTF8     | en_US.UTF-8 | en_US.UTF-8 |            | libc            |
 rrnet_dev | rrnet    | UTF8     | en_US.UTF-8 | en_US.UTF-8 |            | libc            |
 template0 | postgres | UTF8     | en_US.UTF-8 | en_US.UTF-8 |            | libc            | =c/postgres          +
           |          |          |             |             |            |                 | postgres=CTc/postgres
 template1 | postgres | UTF8     | en_US.UTF-8 | en_US.UTF-8 |            | libc            | =c/postgres          +
           |          |          |             |             |            |                 | postgres=CTc/postgres
```

### 2. Switch Database

```sql
-- Pindah ke database lain
\c database_name

-- Contoh: Pindah ke rrnet_dev
\c rrnet_dev
```

### 3. Cek Tabel yang Ada

```sql
-- List semua tabel di database saat ini
\dt

-- Atau query langsung
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Output contoh:**

```
                    List of relations
 Schema |              Name              | Type  | Owner
--------+--------------------------------+-------+-------
 public | addons                         | table | rrnet
 public | audit_logs                     | table | rrnet
 public | clients                        | table | rrnet
 public | migrations                     | table | rrnet
 public | plans                          | table | rrnet
 public | schema_migrations              | table | rrnet
 public | tenants                        | table | rrnet
 public | users                          | table | rrnet
```

### 4. Cek Struktur Tabel (Schema)

```sql
-- Lihat struktur tabel tertentu
\d table_name

-- Contoh: Lihat struktur tabel tenants
\d tenants
```

**Output contoh:**

```
                                    Table "public.tenants"
    Column     |           Type           | Collation | Nullable |              Default
---------------+--------------------------+-----------+----------+--------------------------------------
 id            | uuid                     |           | not null | gen_random_uuid()
 name          | character varying(255)   |           | not null |
 slug          | character varying(255)   |           | not null |
 domain        | character varying(255)   |           |          |
 status        | character varying(50)    |           | not null | 'active'::character varying
 billing_status| character varying(50)    |           |          | 'active'::character varying
 plan_id       | uuid                     |           |          |
 created_at    | timestamp with time zone |           | not null | now()
 updated_at    | timestamp with time zone |           | not null | now()
Indexes:
    "tenants_pkey" PRIMARY KEY, btree (id)
    "tenants_slug_key" UNIQUE CONSTRAINT, btree (slug)
```

### 5. Cek Isi Tabel

```sql
-- Lihat semua data di tabel
SELECT * FROM table_name;

-- Contoh: Lihat semua tenants
SELECT * FROM tenants;

-- Lihat dengan limit (untuk tabel besar)
SELECT * FROM table_name LIMIT 10;

-- Lihat dengan kondisi tertentu
SELECT * FROM tenants WHERE status = 'active';

-- Lihat kolom tertentu saja
SELECT id, name, slug, status FROM tenants;
```

**Output contoh:**

```
                  id                  |     name      |  slug   | status  | billing_status |         created_at          |         updated_at
--------------------------------------+---------------+---------+---------+----------------+----------------------------+----------------------------
 123e4567-e89b-12d3-a456-426614174000 | EntCorp ISP   | entcorp | active  | active         | 2026-01-01 16:56:00+00     | 2026-01-01 16:56:00+00
 223e4567-e89b-12d3-a456-426614174001 | BizNet ISP    | biznet  | active  | active         | 2026-01-01 16:56:00+00     | 2026-01-01 16:56:00+00
```

### 6. Cek Jumlah Data (Count)

```sql
-- Hitung jumlah row di tabel
SELECT COUNT(*) FROM table_name;

-- Contoh: Hitung jumlah tenants
SELECT COUNT(*) FROM tenants;

-- Count dengan kondisi
SELECT COUNT(*) FROM tenants WHERE status = 'active';
```

### 7. Cek Indexes

```sql
-- Lihat semua index di tabel
\di

-- Atau untuk tabel tertentu
\di table_name

-- Query langsung
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'tenants';
```

### 8. Cek Constraints

```sql
-- Lihat constraints di tabel
\d+ table_name

-- Query langsung
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'tenants'::regclass;
```

## Advanced Queries

### 1. Cek Relasi Antar Tabel

```sql
-- Lihat foreign keys
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'tenants';
```

### 2. Cek Size Database dan Tabel

```sql
-- Size database
SELECT pg_size_pretty(pg_database_size('rrnet_dev'));

-- Size semua tabel
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3. Cek User dan Permissions

```sql
-- List semua users
\du

-- Cek permissions user tertentu
SELECT
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'tenants';
```

### 4. Query dengan Join

```sql
-- Contoh: Lihat tenants dengan plan mereka
SELECT
    t.id,
    t.name,
    t.slug,
    t.status,
    p.name AS plan_name,
    p.code AS plan_code
FROM tenants t
LEFT JOIN plans p ON t.plan_id = p.id;
```

## Useful psql Commands

### Command Line Shortcuts

```sql
-- Help
\?

-- Help untuk SQL commands
\h

-- List semua databases
\l

-- List semua tables
\dt

-- Describe table structure
\d table_name

-- List semua schemas
\dn

-- List semua functions
\df

-- List semua views
\dv

-- Show current database
SELECT current_database();

-- Show current user
SELECT current_user;

-- Show current schema
SHOW search_path;

-- Exit psql
\q
```

### Formatting Output

```sql
-- Expanded display (untuk kolom banyak)
\x

-- Turn off expanded display
\x

-- Set column width
\pset columns 100

-- Set border style
\pset border 2

-- Set format (aligned, wrapped, etc)
\pset format aligned
```

## Common Operations

### 1. Backup Database

```bash
# Backup ke file SQL
pg_dump -U rrnet -d rrnet_dev > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup dengan format custom (lebih efisien)
pg_dump -U rrnet -d rrnet_dev -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Backup dengan password
PGPASSWORD=rrnet_secret pg_dump -U rrnet -d rrnet_dev > backup.sql
```

### 2. Restore Database

```bash
# Restore dari file SQL
psql -U rrnet -d rrnet_dev < backup.sql

# Restore dengan password
PGPASSWORD=rrnet_secret psql -U rrnet -d rrnet_dev < backup.sql

# Restore dari custom format
pg_restore -U rrnet -d rrnet_dev backup.dump
```

### 3. Export Data ke CSV

```sql
-- Export query result ke CSV
\copy (SELECT * FROM tenants) TO '/tmp/tenants.csv' CSV HEADER;

-- Atau via command line
psql -U rrnet -d rrnet_dev -c "COPY (SELECT * FROM tenants) TO STDOUT CSV HEADER" > tenants.csv
```

### 4. Import Data dari CSV

```sql
-- Import dari CSV
\copy tenants FROM '/tmp/tenants.csv' CSV HEADER;
```

## Troubleshooting

### 1. Permission Denied

**Problem:** `permission denied for schema public`

**Solution:**

```sql
-- Grant permissions
GRANT ALL ON SCHEMA public TO rrnet;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rrnet;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rrnet;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO rrnet;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO rrnet;
```

### 2. Connection Refused

**Problem:** `could not connect to server: Connection refused`

**Solution:**

```bash
# Cek apakah PostgreSQL running
systemctl status postgresql

# Start PostgreSQL jika tidak running
systemctl start postgresql

# Cek port
netstat -tlnp | grep 5432
```

### 3. Authentication Failed

**Problem:** `password authentication failed for user "rrnet"`

**Solution 1: Gunakan Script Fix (Recommended)**

```bash
# Run fix script
cd /opt/rrnet
chmod +x scripts/fix_postgres_auth.sh
./scripts/fix_postgres_auth.sh
```

**Solution 2: Manual Fix**

```bash
# Reset password sebagai postgres superuser
sudo -u postgres psql

# Di psql:
ALTER USER rrnet WITH PASSWORD 'rrnet_secret';

# Atau create user jika belum ada
CREATE USER rrnet WITH PASSWORD 'rrnet_secret';
ALTER USER rrnet CREATEDB;

# Exit
\q
```

**Solution 3: Cek PostgreSQL Authentication Config**

```bash
# Cek pg_hba.conf
cat /etc/postgresql/*/main/pg_hba.conf | grep -E "^local|^host.*127.0.0.1"

# Jika perlu, edit untuk allow password authentication
# Restart PostgreSQL setelah edit
systemctl restart postgresql
```

## Quick Reference

### Connect to Database

```bash
# Basic connection
psql -U rrnet -d rrnet_dev

# With password
PGPASSWORD=rrnet_secret psql -U rrnet -d rrnet_dev -h localhost
```

### Common Queries

```sql
-- List databases
\l

-- List tables
\dt

-- Describe table
\d table_name

-- Select all
SELECT * FROM table_name LIMIT 10;

-- Count rows
SELECT COUNT(*) FROM table_name;

-- Exit
\q
```

### Backup & Restore

```bash
# Backup
pg_dump -U rrnet -d rrnet_dev > backup.sql

# Restore
psql -U rrnet -d rrnet_dev < backup.sql
```

## Example Workflow

### 1. Cek Database dan Tabel

```bash
# SSH ke VPS
ssh root@72.60.74.209

# Connect ke database
psql -U rrnet -d rrnet_dev

# Di psql:
\l                    # List databases
\dt                   # List tables
\d tenants            # Describe tenants table
SELECT * FROM tenants LIMIT 5;  # View sample data
\q                    # Exit
```

### 2. Cek Data Specific

```bash
# Connect
psql -U rrnet -d rrnet_dev

# Query
SELECT COUNT(*) FROM tenants WHERE status = 'active';
SELECT id, name, slug FROM tenants ORDER BY created_at DESC LIMIT 10;
SELECT * FROM plans;
SELECT * FROM addons;

# Exit
\q
```

### 3. Backup Database

```bash
# Backup
pg_dump -U rrnet -d rrnet_dev > /opt/rrnet/backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh /opt/rrnet/backup_*.sql
```

## Notes

- **Selalu backup sebelum major changes**
- **Gunakan LIMIT untuk query tabel besar**
- **Hati-hati dengan DELETE/UPDATE queries**
- **Test query di development dulu sebelum production**
- **Monitor database size secara berkala**

## Support

Untuk masalah database lebih lanjut, cek:

1. PostgreSQL logs: `/var/log/postgresql/`
2. `VPS_DEPLOYMENT_GUIDE.md` - Untuk setup database
3. PostgreSQL documentation: https://www.postgresql.org/docs/

#test
-- Cek tenants
SELECT id, name, slug, status FROM tenants;

-- Cek users (development accounts)
SELECT id, email, name, status FROM users WHERE email LIKE '%@rrnet.test' OR email LIKE '%@acme.test';

-- Cek clients (jika ada)
SELECT COUNT(\*) as total_clients FROM clients;

-- Cek invoices (jika ada)
SELECT COUNT(\*) as total_invoices FROM invoices;

-- Cek payments (jika ada)
SELECT COUNT(\*) as total_payments FROM payments;

-- Cek service packages
SELECT COUNT(\*) as total_packages FROM service_packages;

#Verify akun development
-- Super Admin
SELECT u.id, u.email, u.name, u.status, r.code as role
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.email = 'admin@rrnet.test';

-- Owner Acme
SELECT u.id, u.email, u.name, u.status, t.name as tenant_name
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.email = 'owner@acme.test';
