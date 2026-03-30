# Environment Setup untuk Backend

## Masalah yang Terjadi

**Error:** `DATABASE_URL is required`

**Penyebab:**
1. Go tidak otomatis membaca file `.env` (tidak seperti Node.js)
2. Config loader hanya membaca dari `os.Getenv()` yang membaca environment variables sistem
3. File `.env` tidak ter-load ke environment variables

## Solusi

### Cara 1: Menggunakan godotenv (Recommended)

Backend sudah diupdate untuk load `.env` file otomatis menggunakan `godotenv`.

**Buat file `BE/.env`:**
```env
APP_ENV=development
APP_NAME=rrnet
APP_PORT=8080
DATABASE_URL=postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
JWT_SECRET=dev-secret-key-change-in-production-min-32-characters-long
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
```

**Jalankan:**
```bash
cd BE
go run cmd/api/main.go
```

### Cara 2: Menggunakan PowerShell Script

```powershell
cd BE
.\run.ps1
```

Script akan otomatis load `.env` atau set default values.

### Cara 3: Set Manual di PowerShell

```powershell
cd BE
$env:DATABASE_URL="postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable"
$env:REDIS_ADDR="localhost:6379"
go run cmd/api/main.go
```

## Verifikasi

Pastikan PostgreSQL & Redis sudah running:
```bash
docker-compose up -d postgres redis
docker-compose ps
```

## Penjelasan Masalah

**Kenapa Go tidak load .env otomatis?**
- Go adalah compiled language, tidak punya built-in .env loader
- Environment variables harus di-set di sistem atau di-load manual
- Library `godotenv` menambahkan fungsi untuk load .env file ke environment variables

**Flow:**
1. `godotenv.Load()` membaca file `.env`
2. Mem-parse key=value pairs
3. Set ke `os.Getenv()` via `os.Setenv()`
4. `config.Load()` membaca dari `os.Getenv()`

