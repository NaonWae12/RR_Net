# 🚨 Post-Mortem & Troubleshooting Guide: Docker Build Failures on VPS

## 📋 Ringkasan Masalah
Saat melakukan deployment (build ulang Docker) di VPS untuk pembaruan fitur, build sering kali gagal dengan pesan yang menyesatkan. Meskipun `package.json` sudah benar, perintah di dalam container seperti `next build` atau `tsc` akan melaporkan `not found`, atau terjadi error `i/o timeout` saat mengunduh package (`apk add` atau `go mod download`).

## 🔍 Gejala Error yang Muncul
1. **Frontend (Next.js):**
   - `sh: 1: next: not found`
   - `sh: 1: ./node_modules/.bin/next: not found`
   - `EAI_AGAIN` (DNS Resolution error saat menjalankan `npx`)
2. **Backend (Golang):**
   - `dial tcp: lookup proxy.golang.org: i/o timeout`
   - `WARNING: fetching ... APKINDEX.tar.gz: DNS: transient error (try again later)`
3. **WA-Gateway (Node.js/TypeScript):**
   - `sh: tsc: not found`

## 🧠 Root Causes (Akar Permasalahan)

### 1. DNS Resolution Fails di Dalam Container (Bridged Network)
Secara default, Docker menggunakan jaringan *bridge* miliknya sendiri. Pada VPS Ubuntu/Debian yang menggunakan `systemd-resolved` (IP `127.0.0.53`), container Docker sering mengalami "Kebutaan DNS". Mereka tidak tahu cara meresolusi alamat seperti `registry.npmjs.org` atau alamat repository OS.

### 2. Alpine Linux & Ketergantungan Eksternal
Image berbasis `alpine` dibuat untuk ukuran kecil, namun mereka:
- Sangat bergantung pada `apk add` yang butuh DNS untuk mengunduh package *runtime* tambahan (seperti `libc6-compat`, `bash`, `tzdata`).
- Sering kali bentrok dengan *shared libraries* C (glibc) yang dibutuhkan oleh biner node modern, sehingga file biner "Next.js" ada tapi tidak bisa dieksekusi oleh OS (menghasilkan log palsu `not found`).

### 3. Silent Failing saat `npm install` (Low RAM/Network Throttle)
Bila memori (RAM) VPS terlalu penuh karena container lama masih menyala, atau koneksi jaringan melambat, `npm install` bisa selesai seolah "Sukses", padahal ia melewati (skip) pembuatan biner (symlink) di folder `./node_modules/.bin/`. Sifat Docker yang agresif dalam menyimpan cache justru mengunci hasil busuk (corrupt) ini untuk build-build berikutnya.

---

## 🛠 Solusi Permanen yang Diterapkan (Jangan Diubah!)

### 1. Mode Jaringan Host Saat Build (docker-compose.production.yml)
Setiap service harus menggunakan `network: host` pada tahap build-nya agar Docker meminjam DNS langsung dari sistem VPS tanpa perantara, menghilangkan error `i/o timeout`.

```yaml
# Contoh di docker-compose.production.yml
    build:
      context: ./fe
      dockerfile: Dockerfile
      network: host # 👈 PANACEA (OBAT DEWA)
```

### 2. Migrasi ke Debian-Based (Atau "Gemuk") Images
Tinggalkan image `-alpine`. Gunakan image `node:20` (untuk node.js) atau `debian:bookworm-slim` (untuk Golang).
Images ini jauh lebih stabil karena sudah di-bundle dengan `glibc` dan `ca-certificates` standar, sehingga instalasi bisa berjalan seutuhnya secara *offline* tanpa memanggil internet untuk dependensi dasar (seperti `apk add`).

### 3. Pembersihan Cache Mandiri di Dockerfile (Single-Stage)
Buang folder `node_modules` sebelum install di Dockerfile untuk memotong warisan cache busuk dari Host / VPS:

```dockerfile
# Contoh di fe/Dockerfile
RUN rm -rf node_modules && npm install --legacy-peer-deps
RUN ./node_modules/.bin/next build # Tembak path absolut!
```

---

## 🩺 Langkah Pertolongan Pertama (First-Aid) Jika Terulang

Jika error aneh seperti ini kembali muncul di *production server*, **JANGAN PANIK.** Lakukan urutan 3 langkah (Triase) ini:

1. **Pembersihan Cache Paksa:**
   ```bash
   docker builder prune -a -f
   docker system prune -f
   ```
2. **Restart Jaringan/VPS:**
   Bila VPS sudah tidak di-restart lebih dari berbulan-bulan, *memory leak* pada daemon jaringan bisa terjadi. Jika aman secara operasional, lakukan perintah `reboot` pada VPS.
3. **Build Ulang Tanpa Cache:**
   ```bash
   cd /opt/rrnet
   git fetch origin main && git reset --hard origin/main
   docker compose -f docker-compose.production.yml build --no-cache
   docker compose -f docker-compose.production.yml up -d
   ```
