# 🚀 Panduan Migrasi VPS Seamless (Zero Downtime)
> Dokumen ini berisi instruksi langkah-demi-langkah untuk memindahkan seluruh infrastruktur RRNET dari VPS lama ke VPS baru tanpa mengganggu client yang sedang aktif.

---

## 🛠️ 1. Persiapan (Lakukan Sekarang!)
Sebelum memulai migrasi, pastikan arsitektur "pintu gerbang" sudah fleksibel:

- **Wajib FQDN (Domain)**: Pastikan semua MikroTik tenant diarahkan ke nama domain (misal: `vpn.billrrnet.tech`), bukan IP publik VPS langsung.
- **DNS Management**: Gunakan layanan DNS yang cepat (Cloudflare sangat direkomendasikan).
- **TTL DNS**: 24 jam sebelum migrasi, turunkan **TTL (Time To Live)** dari A-Record domain lu ke `1 menit` atau `2 menit` agar propagasi IP berlangsung instan saat switch.

---

## 🏗️ 2. Fase Setup VPS Baru (H-1)
Siapkan lingkungan di server baru agar siap menerima data:

1. **Install Engine**: Pastikan Docker & Docker Compose sudah terpasang.
2. **Setup Source**: Clone repository terbaru ke `/opt/rrnet`.
3. **Konfigurasi Lingkungan**: Samakan isi file `.env` di VPS baru dengan VPS lama (terutama `JWT_SECRET` dan `POSTGRES_PASSWORD`).
4. **Firewall**: Buka port-port krusial:
   - `80, 443` (HTTP/HTTPS)
   - `1812, 1813` (RADIUS UDP)
   - `500, 4500, 1701` (VPN L2TP/IPSec)
   - `8080, 3000` (API & Dashboard)

---

## 📦 3. Fase Transfer Data (Hari-H)
Pindahkan "nyawa" aplikasi dari server lama ke baru:

### A. Database PostgreSQL (Data Utama)
```bash
# Di VPS LAMA (Export):
docker exec rrnet-postgres-prod pg_dump -U rrnet rrnet_prod > backup_db_full.sql

# Pindahkan file ke VPS BARU (Gunakan scp atau rsync):
scp backup_db_full.sql root@IP_VPS_BARU:/opt/rrnet/

# Di VPS BARU (Import):
cat backup_db_full.sql | docker exec -i rrnet-postgres-prod psql -U rrnet -d rrnet_prod
```

### B. VPN Credentials (Koneksi Router)
Copy file pengaturan user VPN langsung dari host VPS:
```bash
scp /etc/ppp/chap-secrets root@IP_VPS_BARU:/etc/ppp/
scp /etc/ipsec.secrets root@IP_VPS_BARU:/etc/
```

### C. WA Gateway Volume (Sesi WhatsApp)
Copy folder `wa_gateway_data` agar tenant tidak perlu scan ulang QR Code. Docker volume biasanya ada di `/var/lib/docker/volumes/`:
```bash
# Sync folder volume langsung (Sesuaikan prefix nama project jika berbeda)
rsync -avz /var/lib/docker/volumes/rrnet_wa_gateway_data root@IP_VPS_BARU:/var/lib/docker/volumes/
```
> [!IMPORTANT]
> Pastikan di VPS BARU, folder tersebut memiliki permission yang benar (biasanya dialihkan ke user docker).

---

## 🔄 4. Fase Eksekusi & Switching (Cekrek!)
Saatnya memindahaan trafik:

1. **Update A-Record**: Di panel DNS Cloudflare, ganti IP domain (misal `radius.billrrnet.tech`, `api.billrrnet.tech`, `vpn.billrrnet.tech`) dari IP VPS LAMA ke **IP VPS BARU**.
2. **Start Docker VPS Baru**:
   ```bash
   cd /opt/rrnet
   docker-compose -f docker-compose.production.yml up -d
   ```
3. **SSL/HTTPS**: 
   - Jika menggunakan sertifikat lama, pastikan file di `./nginx/ssl/` sudah di-copy.
   - Jika generate baru, jalankan `certbot` di host VPS BARU dan arahkan outputnya ke folder `./nginx/ssl/` project.
4. **Monitor Log**: Cek apakah paket RADIUS dan API sudah masuk ke server baru:
   ```bash
   docker logs -f rrnet-backend-prod
   docker logs -f rrnet-freeradius-prod
   ```

---

## ✅ 5. Verifikasi & Pasca-Migrasi
- Pastikan semua MikroTik tenant statusnya `Connected` di VPN.
- Pastikan client voucher bisa login tanpa diminta credentials baru.
- Kembalikan TTL DNS ke setingan normal (misal 1 jam) setelah migrasi stabil (H+2).

> [!TIP]
> **Selalu Backup!** Jangan hapus VPS lama setidaknya 3 hari setelah migrasi selesai untuk jaga-jaga jika ada data yang tertinggal.
