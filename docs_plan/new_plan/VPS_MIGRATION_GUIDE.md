# 🚀 Panduan Migrasi VPS RRNET (Step by Step)

> [!IMPORTANT]
> Panduan ini berdasarkan migrasi aktual dari Hostinger (`76.13.17.143`) ke Unihost (`173.234.14.162`) pada 16 Juni 2026.

---

## 📋 Arsitektur yang Harus Dipindahkan

| Komponen | Teknologi | Lokasi |
|----------|-----------|--------|
| ERP App (BE, FE, DB, Redis, WA) | Docker Compose | `/opt/rrnet/` |
| SSTP VPN | `accel-ppp` (native, BUKAN SoftEther) | `/usr/local/sbin/accel-pppd` |
| L2TP VPN | `xl2tpd` + `strongswan` (native) | systemd services |
| Reverse Proxy | Nginx (Docker) | `/opt/rrnet/nginx/` |
| RADIUS Auth | FreeRADIUS (Docker) | Built from `infra/freeradius/` |
| SSL Certificate | Let's Encrypt | `/opt/rrnet/nginx/ssl/` |
| Port Forwarding | iptables (DNAT + MASQUERADE) | `iptables-persistent` |

---

## STEP 1: Persiapan VPS Baru

```bash
# Update sistem
apt update && apt upgrade -y

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com | sh

# Install dependency untuk accel-ppp & L2TP
apt install -y libpcre2-8-0 libssl3 libnl-3-200 libnl-genl-3-200 zlib1g \
  strongswan xl2tpd iptables-persistent

# Aktifkan IP forwarding
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p
```

---

## STEP 2: Migrasi Docker App (dari VPS Lama)

```bash
# Di VPS Lama: Copy seluruh project
rsync -avz /opt/rrnet/ root@<VPS_BARU_IP>:/opt/rrnet/
```

### ⚠️ PITFALL: SSL Certificate Symlink
Nginx di dalam Docker **tidak bisa membaca symlink** Let's Encrypt.

**Solusi:** Copy file sertifikat secara langsung (bukan symlink):
```bash
# Di VPS Baru
cp /etc/letsencrypt/live/<domain>/fullchain.pem /opt/rrnet/nginx/ssl/fullchain.pem
cp /etc/letsencrypt/live/<domain>/privkey.pem /opt/rrnet/nginx/ssl/privkey.pem
```

### Start Docker Services
```bash
cd /opt/rrnet
docker-compose -f docker-compose.production.yml up -d --build
```

---

## STEP 3: Migrasi SSTP VPN (accel-ppp)

> [!CAUTION]
> SSTP VPN menggunakan `accel-ppp`, **BUKAN** SoftEther (`vpnserver`).
> Folder `/opt/vpnserver/` adalah instalasi lama yang TIDAK digunakan untuk SSTP.

### Copy dari VPS Lama ke VPS Baru:
```bash
# 1. Konfigurasi + sertifikat SSL VPN
rsync -avz /etc/accel-ppp/ root@<VPS_BARU_IP>:/etc/accel-ppp/

# 2. Systemd service file
scp /etc/systemd/system/accel-ppp.service root@<VPS_BARU_IP>:/etc/systemd/system/

# 3. Binary program
scp /usr/local/sbin/accel-pppd root@<VPS_BARU_IP>:/usr/local/sbin/

# 4. Library pendukung (BUAT FOLDER DULU di VPS Baru!)
# Di VPS Baru: mkdir -p /usr/local/lib64
rsync -avz /usr/local/lib64/accel-ppp/ root@<VPS_BARU_IP>:/usr/local/lib64/accel-ppp/

# 5. User database (chap-secrets)
scp /etc/ppp/chap-secrets root@<VPS_BARU_IP>:/etc/ppp/chap-secrets
```

### Setup di VPS Baru:
```bash
# Buat folder & symlink library
mkdir -p /var/log/accel-ppp /usr/local/lib/accel-ppp
ln -sf /usr/local/lib64/accel-ppp/* /usr/local/lib/accel-ppp/

# Aktifkan service
systemctl daemon-reload
systemctl enable accel-ppp
systemctl start accel-ppp
systemctl status accel-ppp
```

### ⚠️ PITFALL: Folder `/usr/local/lib64` tidak ada
`rsync` akan gagal jika parent folder belum dibuat. Selalu jalankan `mkdir -p /usr/local/lib64` di VPS Baru terlebih dahulu.

---

## STEP 4: Migrasi L2TP VPN (xl2tpd + strongswan)

### Copy dari VPS Lama:
```bash
# IPsec config & secret
scp /etc/ipsec.conf root@<VPS_BARU_IP>:/etc/ipsec.conf
scp /etc/ipsec.secrets root@<VPS_BARU_IP>:/etc/ipsec.secrets

# xl2tpd config
rsync -avz /etc/xl2tpd/ root@<VPS_BARU_IP>:/etc/xl2tpd/

# PPP options
scp /etc/ppp/options.xl2tpd root@<VPS_BARU_IP>:/etc/ppp/options.xl2tpd
```

### ⚠️ PENTING: Update IP di ipsec.conf
Ubah `leftid` ke IP VPS Baru:
```bash
# Di VPS Baru, edit /etc/ipsec.conf
# Ganti: leftid=<IP_VPS_LAMA>
# Menjadi: leftid=<IP_VPS_BARU>
```

```bash
# Restart services
systemctl restart strongswan-starter
systemctl restart xl2tpd
```

---

## STEP 5: Setup iptables Port Forwarding

### A. DNAT Rules (Port → MikroTik)
Backend Go otomatis membuat rules ini. Tapi jika perlu manual:
```bash
# Contoh format:
iptables -t nat -A PREROUTING -p tcp --dport 10506 -j DNAT --to-destination 10.10.20.14:8291
```

### B. MASQUERADE Rules (Return Traffic)
```bash
iptables -t nat -A POSTROUTING -d 10.10.10.0/24 -j MASQUERADE
iptables -t nat -A POSTROUTING -s 10.10.0.0/16 -j MASQUERADE
iptables -t nat -A POSTROUTING -d 10.10.0.0/16 -j MASQUERADE
```

### C. FORWARD Rules (WAJIB!)
```bash
# Rule paling penting - izinkan return traffic
iptables -I FORWARD 1 -m state --state ESTABLISHED,RELATED -j ACCEPT

# Per-router ACCEPT (contoh)
iptables -A FORWARD -d 10.10.20.14 -p tcp --dport 8291 -j ACCEPT
```

### D. MSS Clamping (Anti MTU Issue)
```bash
iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
iptables -t mangle -A FORWARD -o ppp+ -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1360
iptables -t mangle -A FORWARD -i ppp+ -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1360
```

### E. Persist Rules
```bash
netfilter-persistent save
```

---

## STEP 6: Update DNS & Cutover

```bash
# 1. Update DNS A record: vpn.billrrnet.tech → <IP_VPS_BARU>
# 2. Update DNS A record: billrrnet.tech → <IP_VPS_BARU>
# 3. Matikan VPN di VPS Lama agar router pindah ke VPS Baru
systemctl stop accel-ppp && systemctl disable accel-ppp  # Di VPS Lama
```

---

## STEP 7: Verifikasi

```bash
# Cek semua Docker container
docker ps

# Cek SSTP VPN
systemctl status accel-ppp
journalctl -u accel-ppp -f

# Cek L2TP VPN
systemctl status xl2tpd
systemctl status strongswan-starter

# Cek port listening
netstat -tulnp | grep -E "4443|1701|500|4500|8080|3000"

# Cek tunnel VPN aktif
ip addr show | grep ppp

# Cek iptables
iptables -t nat -L -n --line-numbers
iptables -L FORWARD -n --line-numbers

# Cek remote Winbox
curl -m 3 telnet://10.10.20.14:8291
```

---

## 🗂️ Daftar File Sensitif

| File | Isi | Catatan |
|------|-----|---------|
| `/opt/rrnet/.env` | DB password, JWT secret, API keys | **JANGAN commit ke Git** |
| `/etc/ppp/chap-secrets` | Username & password VPN semua router | Shared oleh SSTP & L2TP |
| `/etc/ipsec.secrets` | PSK untuk L2TP/IPsec | Update `leftid` saat migrasi |
| `/opt/rrnet/nginx/ssl/*.pem` | SSL certificate | Copy langsung, jangan symlink |
| `/etc/accel-ppp/ssl/` | SSL cert khusus VPN SSTP | Beda dengan Nginx SSL |

---

## 🐛 Masalah yang Ditemui & Solusi

### 1. Nginx Bootloop (SSL Symlink)
- **Gejala:** Nginx container restart terus, website down
- **Sebab:** Docker tidak bisa resolve symlink Let's Encrypt
- **Solusi:** Copy file `.pem` langsung ke folder mounted volume

### 2. VPN Auth Failed Instan (SoftEther vs accel-ppp)
- **Gejala:** `User authentication failed` di log SoftEther, koneksi ditolak <1ms
- **Sebab:** SSTP VPN sebenarnya dihandle `accel-ppp`, bukan SoftEther
- **Solusi:** Install & konfigurasi `accel-ppp`, disable SoftEther
- **Cara identifikasi:** Cek `systemctl list-units | grep -E "accel|sstp"` di VPS Lama

### 3. Remote Winbox Gagal (Missing ESTABLISHED Rule)
- **Gejala:** DNAT rules ada, tapi koneksi timeout
- **Sebab:** Docker set FORWARD policy ke DROP, return traffic diblokir
- **Solusi:** `iptables -I FORWARD 1 -m state --state ESTABLISHED,RELATED -j ACCEPT`

### 4. rsync Gagal (Missing Parent Directory)
- **Gejala:** `mkdir failed: No such file or directory`
- **Sebab:** Folder `/usr/local/lib64/` belum ada di VPS Baru
- **Solusi:** `mkdir -p /usr/local/lib64` sebelum rsync

### 5. iptables Hilang Setelah Reboot
- **Sebab:** iptables rules bersifat volatile (hilang saat reboot)
- **Solusi:** Install `iptables-persistent` + `netfilter-persistent save`

---

*Dokumentasi migrasi RRNET — Dibuat 16 Juni 2026* 🫡
