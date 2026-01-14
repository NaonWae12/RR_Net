# Development Workflow Guide

## Overview

Dokumentasi ini menjelaskan workflow development untuk project RRNET, termasuk cara melakukan perubahan kode lokal, push ke GitHub, dan deploy ke VPS.

## Prerequisites

- Git terinstall di local machine
- Akses SSH ke VPS
- Akses ke GitHub repository: `https://github.com/NaonWae12/RR_Net.git`

## Development Workflow

### 1. Development di Local Machine

#### Setup Awal (Hanya Sekali)

```bash
# Clone repository (jika belum ada)
git clone https://github.com/NaonWae12/RR_Net.git
cd RR_Net

# Setup remote (jika belum ada)
git remote add origin https://github.com/NaonWae12/RR_Net.git
```

#### Workflow Harian

**1. Update dari GitHub (Sebelum Mulai Development)**

```bash
# Pastikan di branch main
git checkout main

# Pull perubahan terbaru dari GitHub
git pull origin main
```

**2. Buat Perubahan Kode**

- Edit file-file yang diperlukan di local machine
- Test perubahan secara lokal (jika memungkinkan)

**3. Commit Perubahan**

```bash
# Cek status perubahan
git status

# Add file yang diubah
git add <file-path>
# atau add semua perubahan
git add -A

# Commit dengan pesan yang jelas
git commit -m "Fix: Add explicit text colors to super admin pages"
```

**Contoh Pesan Commit yang Baik:**
- `Fix: Add explicit text colors to super admin pages`
- `Feature: Add new tenant management functionality`
- `Update: Improve error handling in login page`
- `Refactor: Clean up unused imports`

**4. Push ke GitHub**

```bash
# Push ke GitHub
git push origin main
```

**5. Deploy ke VPS**

Setelah push ke GitHub, deploy ke VPS dengan langkah berikut:

```bash
# SSH ke VPS
ssh root@72.60.74.209

# Masuk ke direktori project
cd /opt/rrnet

# Pull perubahan dari GitHub
git pull origin main

# Jika ada konflik atau file untracked yang menghalangi:
# - Backup file yang konflik (jika penting)
# - Hapus file yang tidak diperlukan
# - Pull lagi

# Rebuild Frontend (jika ada perubahan di frontend)
cd fe
npm run build
systemctl restart rrnet-frontend

# Rebuild Backend (jika ada perubahan di backend)
cd ../BE
go build -o rrnet-api ./cmd/api
systemctl restart rrnet-backend

# Cek status service
systemctl status rrnet-frontend
systemctl status rrnet-backend
```

## Struktur Workflow

```
┌─────────────────┐
│  Local Machine  │
│  (Development)  │
└────────┬────────┘
         │
         │ 1. Edit Code
         │
         ▼
┌─────────────────┐
│  Local Git      │
│  Repository     │
└────────┬────────┘
         │
         │ 2. Commit
         │
         ▼
┌─────────────────┐
│  GitHub         │
│  (Remote Repo)  │
└────────┬────────┘
         │
         │ 3. Push
         │
         ▼
┌─────────────────┐
│  VPS            │
│  (Production)   │
└────────┬────────┘
         │
         │ 4. Pull & Deploy
         │
         ▼
┌─────────────────┐
│  Live App       │
│  (Browser)      │
└─────────────────┘
```

## Best Practices

### 1. Commit Messages

Gunakan format yang jelas dan deskriptif:

```
<Type>: <Description>

[Optional: Detailed explanation]
```

**Types:**
- `Fix:` - Perbaikan bug
- `Feature:` - Fitur baru
- `Update:` - Update fitur existing
- `Refactor:` - Refactoring code
- `Docs:` - Perubahan dokumentasi
- `Style:` - Perubahan styling/formatting
- `Test:` - Menambah/update test

**Contoh:**
```bash
git commit -m "Fix: Add explicit text colors to prevent text blending with background"
git commit -m "Feature: Add tenant suspension functionality"
git commit -m "Update: Improve error messages in login page"
```

### 2. Branch Management

Untuk development yang lebih kompleks, gunakan branch:

```bash
# Buat branch baru
git checkout -b feature/new-feature

# Development di branch
# ... make changes ...

# Commit dan push branch
git add -A
git commit -m "Feature: New feature description"
git push origin feature/new-feature

# Merge ke main (via GitHub Pull Request atau langsung)
git checkout main
git merge feature/new-feature
git push origin main
```

### 3. Testing Sebelum Push

Sebelum push, pastikan:
- Code tidak ada syntax error
- Linter tidak error (jika ada)
- Test secara lokal (jika memungkinkan)

### 4. Backup Sebelum Pull di VPS

Sebelum pull di VPS, backup file penting:

```bash
# Backup database
pg_dump -U rrnet -d rrnet_dev > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup config files
cp .env .env.backup
cp fe/.env.local fe/.env.local.backup
```

## Troubleshooting

### 1. Git Pull Conflict di VPS

**Problem:** File untracked menghalangi pull

```bash
error: The following untracked working tree files would be overwritten by merge:
        BE/rrnet-api
        dev_data_export_20260113_221957.sql
```

**Solution:**

```bash
# Backup file (jika penting)
mv BE/rrnet-api BE/rrnet-api.backup
mv dev_data_export_20260113_221957.sql dev_data_export_20260113_221957.sql.backup

# Atau hapus jika tidak diperlukan
rm -f BE/rrnet-api dev_data_export_20260113_221957.sql

# Pull lagi
git pull origin main
```

### 2. Build Error di VPS

**Problem:** Frontend build gagal

```bash
# Cek Node.js version
node -v  # Harus >= 20.9.0

# Update Node.js jika perlu
# (lihat VPS_DEPLOYMENT_GUIDE.md)

# Clean install
cd fe
rm -rf node_modules .next
npm install --legacy-peer-deps
npm run build
```

**Problem:** Backend build gagal

```bash
# Update Go dependencies
cd BE
go mod tidy
go mod download

# Build lagi
go build -o rrnet-api ./cmd/api
```

### 3. Service Tidak Restart

```bash
# Cek status
systemctl status rrnet-frontend
systemctl status rrnet-backend

# Restart manual
systemctl restart rrnet-frontend
systemctl restart rrnet-backend

# Cek log jika error
journalctl -u rrnet-frontend -n 50
journalctl -u rrnet-backend -n 50
```

## Quick Reference Commands

### Local Development

```bash
# Update dari GitHub
git pull origin main

# Commit perubahan
git add -A
git commit -m "Your commit message"
git push origin main
```

### VPS Deployment

```bash
# SSH ke VPS
ssh root@72.60.74.209

# Pull dan deploy
cd /opt/rrnet
git pull origin main
cd fe && npm run build && systemctl restart rrnet-frontend
cd ../BE && go build -o rrnet-api ./cmd/api && systemctl restart rrnet-backend
```

## Environment Variables

### Local Development

File: `.env.local` (jika ada)

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

### VPS Production

File: `/opt/rrnet/fe/.env.local`

```env
NEXT_PUBLIC_API_URL=http://72.60.74.209:8080/api/v1
```

**Important:** Setelah mengubah `.env.local` di VPS, rebuild frontend:

```bash
cd /opt/rrnet/fe
npm run build
systemctl restart rrnet-frontend
```

## Notes

- **Jangan commit file sensitif** seperti `.env`, credentials, dll
- **Selalu test di local** sebelum push (jika memungkinkan)
- **Backup database** sebelum major changes
- **Monitor logs** setelah deploy untuk memastikan tidak ada error
- **Gunakan commit messages yang jelas** untuk memudahkan tracking perubahan

## Support

Jika ada masalah dengan workflow, cek:
1. `VPS_DEPLOYMENT_GUIDE.md` - Panduan deployment lengkap
2. `VPS_DATABASE_GUIDE.md` - Panduan database operations
3. GitHub Issues - Untuk bug reports dan feature requests

