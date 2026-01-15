# Setup L2TP/IPSec VPN: MikroTik(Client) ↔ VPS(Server)

## Overview

Model yang NAT-friendly dan scalable: **MikroTik sebagai VPN client** yang connect outbound ke **VPS sebagai VPN server**. Dengan ini router yang berada di belakang NAT tetap bisa dikelola, dan VPS bisa akses MikroTik API via IP VPN.

## Prerequisites

- MikroTik RouterOS (versi apapun yang support L2TP/IPSec)
- VPS dengan 2 Core / 8GB RAM (sudah cukup)
- Akses SSH ke VPS
- Akses Winbox/SSH ke MikroTik

---

## Part 1: Setup L2TP/IPSec Server di VPS

### Install via Script (Recommended)

1. SSH ke VPS:

```bash
ssh root@72.60.74.209
cd /opt/rrnet
git pull origin main
```

2. Jalankan installer server (akan minta input PSK + user pertama):

```bash
chmod +x scripts/install_vpn_server.sh
bash scripts/install_vpn_server.sh
```

3. Cek status:

```bash
bash scripts/vpn_server_status.sh
```

### Catatan penting

- VPS akan punya **VPN local IP** default: `10.10.10.1`
- MikroTik client akan dapat **VPN IP** dari pool: `10.10.10.100-10.10.10.200`
- Setiap MikroTik disarankan punya **akun VPN sendiri** (username/password) agar provisioning lebih aman.

---

## Part 2: Setup L2TP/IPSec Client di MikroTik

### Via Winbox GUI (Recommended)

1. Buka **Winbox** → **PPP** → **Interface**
2. Klik **+** → pilih **L2TP Client**
3. Isi:
   - **Connect To:** IP public VPS (contoh: `72.60.74.209`)
   - **User:** username VPN khusus router ini (dibuat di VPS)
   - **Password:** password VPN router ini
   - **Use IPSec:** ✓ (centang)
   - **IPSec Secret:** PSK yang sama seperti di VPS
4. Klik **OK**
5. Pastikan interface **running** (status `R`)

### Via Terminal (copy-paste)

Isi variable ini dulu:

```bash
:local vpsIp "72.60.74.209"
:local vpnUser "vpn-router-001"
:local vpnPass "CHANGE_ME"
:local psk "CHANGE_ME"
```

Lalu buat L2TP client:

```bash
/interface l2tp-client add name=l2tp-to-vps connect-to=$vpsIp user=$vpnUser password=$vpnPass use-ipsec=yes ipsec-secret=$psk disabled=no
```

---

## Part 3: Allow MikroTik API via VPN + Test

### Step 1: Allow API dari network VPN (di MikroTik)

> Pastikan `api` service aktif (port 8728) dan batasi akses hanya dari subnet VPN.

```bash
/ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728 src-address=10.10.10.0/24 comment="Allow MikroTik API from VPN"
```

### Step 2: Cek VPS sudah melihat client VPN

Di VPS:

```bash
bash scripts/vpn_server_status.sh
ip addr | grep -E \"ppp|l2tp\" -n || true
```

### Step 3: Test koneksi API dari VPS ke IP VPN MikroTik

Misal MikroTik mendapat IP `10.10.10.101`:

```bash
timeout 5 bash -c \"echo > /dev/tcp/10.10.10.101/8728\" && echo \"✓ OK\" || echo \"✗ FAILED\"
```

### Step 2: Test di Web Project

1. Buka: `http://72.60.74.209:3000/network/routers/create`
2. Isi form:
   - **Host:** IP VPN MikroTik (contoh: `10.10.10.101`, bukan IP public)
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

## Tambah Router Baru (akun VPN baru)

Di VPS, untuk tiap MikroTik (router) buat akun VPN sendiri:

```bash
chmod +x scripts/vpn_server_add_user.sh
bash scripts/vpn_server_add_user.sh
```

---

## Service Commands (VPS)

```bash
systemctl restart strongswan
systemctl restart xl2tpd
bash scripts/vpn_server_status.sh
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


