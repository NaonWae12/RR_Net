# 🛠️ RRNET VPS Maintenance Guide

Dokumentasi ini berisi panduan untuk melakukan pemeliharaan (maintenance) pada server VPS RRNET, termasuk migrasi database, restart service, dan manajemen Docker.

---

## 🏗️ 1. Database Migrations

Sistem migrasi digunakan untuk memperbarui struktur database (tambah tabel, tambah kolom, dll).

### A. Migrasi Otomatis (Direkomendasikan)
Gua sudah setting agar **Backend otomatis menjalankan migrasi** setiap kali container di-restart (menggunakan `docker-entrypoint.sh`).
Jadi, cukup jalankan:
```bash
cd /opt/rrnet
docker compose -f docker-compose.production.yml restart backend
```
*Backend akan mengecek folder `BE/migrations` dan menjalankan file `.up.sql` yang belum pernah dieksekusi.*

### B. Migrasi Manual (Jika dibutuhkan)
Jika ingin menjalankan migrasi tanpa restart API, gunakan binary `rrnet-migrate` yang sudah gua build di folder `BE`:
```bash
cd /opt/rrnet/BE
# Load env dan jalankan
export DATABASE_URL=$(grep '^DATABASE_URL=' /opt/rrnet/.env | cut -d'=' -f2-)
./rrnet-migrate -url "$DATABASE_URL" -dir ./migrations up
```

---

## 🔄 2. Restarting Services

Service berjalan di dalam Docker. Berikut cara me-restart masing-masing bagian:

### Restart Backend (API Golang)
```bash
docker compose -f docker-compose.production.yml restart backend
```

### Restart Frontend (Next.js)
```bash
docker compose -f docker-compose.production.yml restart frontend
```

### Restart Nginx (Reverse Proxy)
```bash
docker compose -f docker-compose.production.yml restart nginx
```
### Restart FreeRADIUS (VPN Authentication)
```bash
docker compose -f docker-compose.production.yml restart freeradius
```
### Restart Postgres (Database)
```bash
docker compose -f docker-compose.production.yml restart postgres
```

### Restart WhatsApp Gateway
```bash
docker compose -f docker-compose.production.yml restart wa-gateway
```

### Restart Seluruh Sistem
```bash
docker compose -f docker-compose.production.yml restart
```

---

## 🐳 3. Docker Management (VPS Host)

Gunakan command ini untuk memantau kesehatan sistem:

### Cek Status Container
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
*Pastikan statusnya `Up` atau `healthy`.*

### Cek Logs (Troubleshooting)
Jika ada error (seperti 500 tadi), cek logs dengan:
```bash
# Cek 50 baris terakhir logs backend
docker logs --tail 50 rrnet-backend-prod

# Cek logs real-time (tunggu error muncul)
docker logs -f rrnet-backend-prod
```

### Hapus Image & Container Lama (Cleanup)
Jika disk penuh atau mau build dari nol:
```bash
docker system prune -a --volumes
```

---

## 🚀 4. Deployment Flow (Update Code)

Jika ada perubahan kode di lokal dan sudah dipush ke Git:

1. **Masuk ke VPS**
2. **Tarik Kode Terbaru:**
   ```bash
   cd /opt/rrnet
   git pull
   ```
3. **Rebuild & Restart:**
   ```bash
   docker compose -f docker-compose.production.yml up -d --build
   ```
   *Proses `--build` akan mendeteksi perubahan file dan otomatis menjalankan migrasi DB yang baru.*

---

## ⚠️ Troubleshooting Tips

1. **Error 500 di Frontend:** Cek logs backend (`docker logs rrnet-backend-prod`). Biasanya karena tabel belum ada (migrasi belum jalan) atau data NULL.
2. **Frontend Gak Konek Backend:** Pastikan `NEXT_PUBLIC_API_URL` di file `.env` VPS sudah benar mengarah ke domain/IP server.
3. **Database Error:** Cek koneksi Postgres (`docker ps` harus `healthy`). Jika bermasalah, restart postgres: `docker compose restart postgres`.

---
*Last Updated: 2026-03-24 by Antigravity*
