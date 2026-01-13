# MikroTik Setup Guide - Simple & Clear

## 🎯 Tujuan

Biar RRNET backend bisa connect ke MikroTik via API, supaya bisa:

- Buat user PPPoE via Radius
- Buat user Hotspot via Radius
- Isolir client

---

## 📋 Yang Perlu Disiapkan

1. **Akses ke MikroTik** (via Winbox/WebFig/Terminal)
2. **IP address** yang akan di-allow di firewall MikroTik
3. **Username & Password** admin MikroTik

---

## 🚀 Setup untuk Development (Laptop & MikroTik di Jaringan Sama)

### Step 1: Cek IP Laptop

**Windows:**

```powershell
ipconfig
```

Cari **IPv4 Address**, contoh: `192.168.1.100`

**Catat IP ini!** Ini yang akan di-allow di MikroTik.

---

### Step 2: Setup di MikroTik

Buka **Winbox** atau **Terminal** MikroTik, lalu copy-paste script ini:

```routeros
# GANTI "192.168.1.100" dengan IP laptop kamu dari Step 1!

/ip service set api disabled=no port=8728
/ip firewall address-list add list=rrnet-allow address=172.21.4.72 comment="RRNET: allow laptop"
/ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728 src-address-list=rrnet-allow comment="RRNET: allow API"
:log info "RRNET: Setup selesai"
```

**Yang dilakukan script ini:**

- ✅ Enable API service di port 8728
- ✅ Buat address-list "rrnet-allow"
- ✅ Allow IP laptop kamu di firewall
- ✅ Tag semua dengan "RRNET:" biar mudah dihapus nanti

---

### Step 3: Test di RRNET

1. Buka RRNET → Network Management → Add Router
2. Isi form:
   - **Router ID**: `router1` (atau nama bebas)
   - **Host**: `192.168.1.1` (IP MikroTik di LAN)
   - **Port**: `8728`
   - **Username**: username admin MikroTik
   - **Password**: password admin MikroTik
   - **SSL**: `false`
3. Klik **"Test Connection"**
4. Kalau berhasil, klik **"Simpan"**

**Selesai!** 🎉

---

## 🌐 Setup untuk Development dengan ngrok (Simulasi Production)

**Kapan pakai ini?**

- Kalau mau test seperti production (backend di VPS connect ke MikroTik)
- Atau kalau laptop dan MikroTik **tidak** di jaringan yang sama

### Step 1: Jalankan ngrok

**Di laptop kamu:**

```powershell
cd E:\Project\ERP_NET\BE
.\scripts\start_ngrok_tcp.ps1
```

Atau manual:

```bash
ngrok tcp 8728
```

**Output contoh:**

```
Forwarding    tcp://0.tcp.ap.ngrok-free.dev:12345 -> localhost:8728
```

**Catat:**

- Hostname: `0.tcp.ap.ngrok-free.dev`
- Port: `12345`

---

### Step 2: Dapatkan IP ngrok Server

**Windows:**

```powershell
nslookup 0.tcp.ap.ngrok-free.dev
```

**Atau cek di browser:**
Buka: `http://127.0.0.1:4040` → lihat IP di dashboard

**Contoh hasil:** IP ngrok = `52.1.2.3`

**Catat IP ini!** Ini yang akan di-allow di MikroTik.

---

### Step 3: Setup di MikroTik

Buka **Winbox** atau **Terminal** MikroTik, lalu copy-paste script ini:

```routeros
# GANTI "52.1.2.3" dengan IP ngrok server dari Step 2!

/ip service set api disabled=no port=8728
/ip firewall address-list add list=rrnet-allow address=52.1.2.3 comment="RRNET: allow ngrok"
/ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728 src-address-list=rrnet-allow comment="RRNET: allow API"
:log info "RRNET: Setup dengan ngrok selesai"
```

---

### Step 4: Test di RRNET

1. Buka RRNET → Network Management → Add Router
2. Isi form:
   - **Router ID**: `router1`
   - **Host**: `0.tcp.ap.ngrok-free.dev` (hostname ngrok, BUKAN IP)
   - **Port**: `12345` (port dari ngrok, BUKAN 8728)
   - **Username**: username admin MikroTik
   - **Password**: password admin MikroTik
   - **SSL**: `false`
3. Klik **"Test Connection"**
4. Kalau berhasil, klik **"Simpan"**

**⚠️ Catatan:**

- ngrok URL berubah setiap restart (free plan)
- Setiap restart ngrok, harus update IP di MikroTik lagi
- Untuk production, pakai DDNS + Port Forward (lihat bagian Production)

---

## 🏭 Setup untuk Production (Backend di VPS/Cloud)

### Step 1: Dapatkan IP Public VPS

**Cek IP public VPS kamu:**

```bash
curl ifconfig.me
```

Atau cek di dashboard cloud provider (AWS/GCP/Azure).

**Contoh:** IP VPS = `203.0.113.1`

**Catat IP ini!**

---

### Step 2: Setup di MikroTik

Buka **Winbox** atau **Terminal** MikroTik, lalu copy-paste script ini:

```routeros
# GANTI "203.0.113.1" dengan IP public VPS dari Step 1!

/ip service set api disabled=no port=8728
/ip firewall address-list add list=rrnet-allow address=203.0.113.1 comment="RRNET: allow VPS"
/ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728 src-address-list=rrnet-allow comment="RRNET: allow API"
:log info "RRNET: Production setup selesai"
```

---

### Step 3: Setup Port Forward (Kalau MikroTik di Belakang Router/ONT)

**Kalau MikroTik adalah router utama (gateway):**

- ✅ Tidak perlu port forward, langsung bisa

**Kalau MikroTik di belakang router/ONT lain:**

- ⚠️ Perlu setup port forward di router/ONT:
  - Forward port **8728** (TCP) ke IP MikroTik
  - Contoh: WAN:8728 → 192.168.1.1:8728

---

### Step 4: Test di RRNET

1. Buka RRNET → Network Management → Add Router
2. Isi form:
   - **Router ID**: `router1`
   - **Host**: `router.ddns.net` (DDNS hostname) atau `203.0.113.1` (IP public)
   - **Port**: `8728`
   - **Username**: username admin MikroTik
   - **Password**: password admin MikroTik
   - **SSL**: `false`
3. Klik **"Test Connection"**
4. Kalau berhasil, klik **"Simpan"**

---

## 🔧 Troubleshooting

### Test Connection Gagal

**1. Cek API service aktif:**

```routeros
/ip service print
```

Pastikan `api` tidak `disabled`.

**2. Cek firewall rule:**

```routeros
/ip firewall filter print where comment~"RRNET:"
```

Pastikan rule ada dan `action=accept`.

**3. Cek address-list:**

```routeros
/ip firewall address-list print where list=rrnet-allow
```

Pastikan IP yang benar ada di list.

**4. Cek koneksi dari backend:**

```bash
# Test dari VPS/laptop
telnet 192.168.1.1 8728
# atau
nc -zv 192.168.1.1 8728
```

**5. Cek log MikroTik:**

```routeros
/log print where topics~"firewall"
```

---

### Works di LAN Tapi Gagal dari Internet

**Kemungkinan:**

- ❌ Pakai IP lokal (192.168.x.x) di RRNET
- ❌ Port forward belum setup
- ❌ CGNAT (ISP tidak kasih public IP)

**Solusi:**

- ✅ Pakai DDNS atau IP public
- ✅ Setup port forward
- ✅ Minta public IP ke ISP atau pakai VPN

---

## 🗑️ Hapus Setup (Undo)

Kalau mau hapus semua setup RRNET di MikroTik:

```routeros
# Hapus semua yang di-tag "RRNET:"
/ip firewall filter remove [find where comment~"RRNET:"]
/ip firewall address-list remove [find where comment~"RRNET:"]
:log info "RRNET: Setup dihapus"
```

**Note:** API service tetap aktif (tidak di-disable).

---

## ✅ Checklist Cepat

### Development (Local):

- [ ] Cek IP laptop (`ipconfig`)
- [ ] Enable API di MikroTik (port 8728)
- [ ] Allow IP laptop di firewall MikroTik
- [ ] Test di RRNET dengan IP lokal MikroTik

### Development (ngrok):

- [ ] Jalankan ngrok (`ngrok tcp 8728`)
- [ ] Dapatkan IP ngrok server (`nslookup`)
- [ ] Enable API di MikroTik (port 8728)
- [ ] Allow IP ngrok di firewall MikroTik
- [ ] Test di RRNET dengan hostname ngrok

### Production:

- [ ] Dapatkan IP public VPS
- [ ] Enable API di MikroTik (port 8728)
- [ ] Allow IP VPS di firewall MikroTik
- [ ] Setup port forward (jika perlu)
- [ ] Test di RRNET dengan DDNS/IP public

---

## 📝 Catatan Penting

1. **Jangan buka Winbox/SSH ke internet!** Hanya buka API port (8728/8729) dan hanya untuk IP yang di-allow.

2. **Untuk production, pertimbangkan pakai SSL:**

   - Port 8729 (API-SSL)
   - Lebih aman, tapi perlu setup certificate

3. **CGNAT Problem:**

   - Kalau WAN IP MikroTik = private IP (bukan public)
   - Port forward tidak akan bekerja
   - Solusi: minta public IP ke ISP atau pakai VPN (WireGuard/Tailscale)

4. **ngrok untuk Development:**
   - URL berubah setiap restart (free plan)
   - Hanya untuk testing, jangan pakai di production

---

**Selesai!** Sekarang RRNET bisa connect ke MikroTik dan siap untuk:

- ✅ Buat user PPPoE via Radius
- ✅ Buat user Hotspot via Radius
- ✅ Isolir client
