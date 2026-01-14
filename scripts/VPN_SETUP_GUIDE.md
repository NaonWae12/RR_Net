# Setup L2TP/IPSec VPN: MikroTik ↔ VPS

## Overview

Setup VPN L2TP/IPSec untuk koneksi VPS ke MikroTik, memungkinkan backend mengakses MikroTik API meskipun tidak dalam satu jaringan.

## Prerequisites

- MikroTik RouterOS (versi apapun yang support L2TP/IPSec)
- VPS dengan 2 Core / 8GB RAM (sudah cukup)
- Akses SSH ke VPS
- Akses Winbox/SSH ke MikroTik

---

## Part 1: Setup L2TP/IPSec Server di MikroTik

### Via Winbox GUI (Recommended)

#### Step 1: Setup IP Pool untuk VPN

1. Buka **Winbox** → **IP** → **Pool**
2. Klik **+** (Add)
3. Isi:
   - **Name:** `vpn-pool`
   - **Addresses:** `10.10.10.100-10.10.10.200`
4. Klik **OK**

#### Step 2: Setup PPP Profile

1. Buka **Winbox** → **PPP** → **Profiles**
2. Klik **+** (Add)
3. Isi:
   - **Name:** `vpn-profile`
   - **Local Address:** `10.10.10.1`
   - **Remote Address:** `vpn-pool`
4. Klik **OK**

#### Step 3: Setup L2TP Server

1. Buka **Winbox** → **PPP** → **Interface** → **L2TP Server**
2. Klik **Enable** (atau centang **Enabled**)
3. Set:
   - **Default Profile:** `vpn-profile`
   - **Use IPSec:** ✓ (centang)
   - **IPSec Secret:** `rahasiaipsec123` (atau password lain yang aman)
4. Klik **OK**

#### Step 4: Setup User VPN

1. Buka **Winbox** → **PPP** → **Secrets**
2. Klik **+** (Add)
3. Isi:
   - **Name:** `vpn-user` (atau username lain)
   - **Password:** `vpnpass123` (atau password lain yang aman)
   - **Service:** `l2tp`
   - **Profile:** `vpn-profile`
4. Klik **OK**

#### Step 5: Setup Firewall Rules

1. Buka **Winbox** → **IP** → **Firewall** → **Filter Rules**
2. Tambahkan rules berikut (drag ke atas, sebelum deny rules):

   **Rule 1: Allow L2TP (UDP 1701)**
   - **Chain:** `input`
   - **Protocol:** `udp`
   - **Dst. Port:** `1701`
   - **Action:** `accept`
   - **Comment:** `Allow L2TP VPN`

   **Rule 2: Allow IPSec IKE (UDP 500)**
   - **Chain:** `input`
   - **Protocol:** `udp`
   - **Dst. Port:** `500`
   - **Action:** `accept`
   - **Comment:** `Allow IPSec IKE`

   **Rule 3: Allow IPSec NAT-T (UDP 4500)**
   - **Chain:** `input`
   - **Protocol:** `udp`
   - **Dst. Port:** `4500`
   - **Action:** `accept`
   - **Comment:** `Allow IPSec NAT-T`

   **Rule 4: Allow API dari VPN Network**
   - **Chain:** `input`
   - **Protocol:** `tcp`
   - **Src. Address:** `10.10.10.0/24`
   - **Dst. Port:** `8728`
   - **Action:** `accept`
   - **Comment:** `Allow API from VPN`

---

## Part 2: Install VPN Client di VPS

### Step 1: Pull Script Terbaru

```bash
ssh root@72.60.74.209
cd /opt/rrnet
git pull origin main
```

### Step 2: Edit Configuration (PENTING!)

Sebelum install, edit script dengan credential yang sama dengan setup MikroTik:

```bash
nano scripts/install_vpn_client.sh
```

Edit bagian ini (baris 8-11):

```bash
MIKROTIK_IP="36.70.234.179"
IPSEC_SECRET="rahasiaipsec123"  # Ganti dengan IPSec secret dari MikroTik
VPN_USERNAME="vpn-user"          # Ganti dengan username VPN dari MikroTik
VPN_PASSWORD="vpnpass123"        # Ganti dengan password VPN dari MikroTik
```

**PENTING:** Pastikan:
- `IPSEC_SECRET` sama dengan yang di-set di MikroTik L2TP Server
- `VPN_USERNAME` sama dengan username yang dibuat di PPP Secrets
- `VPN_PASSWORD` sama dengan password yang dibuat di PPP Secrets

### Step 3: Install VPN Client

```bash
cd /opt/rrnet
chmod +x scripts/install_vpn_client.sh
bash scripts/install_vpn_client.sh
```

Script akan:
1. Install xl2tpd dan strongswan
2. Setup konfigurasi IPSec
3. Setup konfigurasi L2TP
4. Setup PPP options
5. Start services
6. Connect VPN
7. Test koneksi

### Step 4: Verifikasi VPN Connection

```bash
# Cek status VPN
bash scripts/vpn_status.sh

# Atau manual check
ip addr show ppp0
ping -c 3 10.10.10.1
```

Jika berhasil, akan muncul:
- Interface `ppp0` dengan IP dari pool (mis. `10.10.10.100`)
- Ping ke `10.10.10.1` berhasil

---

## Part 3: Test Koneksi API

### Step 1: Test dari VPS

```bash
# Test koneksi ke MikroTik API via VPN
timeout 5 bash -c "echo > /dev/tcp/10.10.10.1/8728" && echo "✓ OK" || echo "✗ FAILED"
```

### Step 2: Test di Web Project

1. Buka: `http://72.60.74.209:3000/network/routers/create`
2. Isi form:
   - **Host:** `10.10.10.1` (IP VPN MikroTik, bukan IP public)
   - **API Port:** `8728`
   - **Connectivity Mode:** `VPN (Private)`
   - **Username:** Username API MikroTik (bukan username VPN)
   - **Password:** Password API MikroTik (bukan password VPN)
3. Klik **Test Connection**
4. Harusnya berhasil!

---

## Troubleshooting

### VPN Tidak Connect

```bash
# Cek log IPSec
journalctl -u strongswan -n 50 --no-pager

# Cek log xl2tpd
journalctl -u xl2tpd -n 50 --no-pager

# Manual connect
echo "c mikrotik" > /var/run/xl2tpd/l2tp-control
sleep 5
ip addr show ppp0
```

**Common Issues:**
1. **IPSec secret tidak match** → Pastikan secret di VPS sama dengan di MikroTik
2. **Username/password salah** → Pastikan credential VPN benar
3. **L2TP server belum enabled** → Cek di MikroTik
4. **Firewall block** → Pastikan firewall rules sudah benar

### VPN Connect tapi API Tidak Bisa Diakses

```bash
# Test koneksi ke MikroTik
ping 10.10.10.1

# Test port API
telnet 10.10.10.1 8728

# Cek firewall MikroTik
# Pastikan rule allow API dari VPN network (10.10.10.0/24) sudah ada
```

---

## Auto-Connect VPN saat Boot

Untuk auto-connect VPN saat VPS boot:

```bash
# Edit crontab
crontab -e

# Tambahkan baris ini:
@reboot sleep 30 && /opt/rrnet/scripts/vpn_connect.sh >> /var/log/vpn-connect.log 2>&1
```

---

## Manual Commands

### Connect VPN
```bash
bash /opt/rrnet/scripts/vpn_connect.sh
```

### Check Status
```bash
bash /opt/rrnet/scripts/vpn_status.sh
```

### Disconnect VPN
```bash
echo "d mikrotik" > /var/run/xl2tpd/l2tp-control
```

### Restart Services
```bash
systemctl restart strongswan
systemctl restart xl2tpd
bash /opt/rrnet/scripts/vpn_connect.sh
```

---

## Configuration Files

Setelah install, file konfigurasi ada di:
- `/etc/ipsec.conf` - IPSec configuration
- `/etc/ipsec.secrets` - IPSec secrets (chmod 600)
- `/etc/xl2tpd/xl2tpd.conf` - L2TP configuration
- `/etc/ppp/options.l2tpd.client` - PPP options (chmod 600)

Untuk edit credential, edit file-file di atas atau re-run install script dengan credential baru.

---

## Security Notes

1. **Gunakan password yang kuat** untuk IPSec secret dan VPN user
2. **Jangan commit** file `/etc/ipsec.secrets` dan `/etc/ppp/options.l2tpd.client` ke git
3. **Rotate credentials** secara berkala
4. **Monitor VPN connection** untuk memastikan tetap terhubung

---

## Next Steps

Setelah VPN terhubung dan API bisa diakses:
1. Test connection di web project
2. Create router dengan IP VPN (`10.10.10.1`)
3. Setup auto-connect VPN saat boot
4. Monitor resource usage

