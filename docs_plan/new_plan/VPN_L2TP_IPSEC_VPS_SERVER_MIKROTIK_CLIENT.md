# VPN L2TP/IPSec (Model NAT-friendly)
## VPS = VPN Server, MikroTik = VPN Client

Dokumen ini mencatat setup VPN yang dipakai untuk RRNET agar **router MikroTik di belakang NAT tetap bisa di-manage** oleh backend (VPS).

## Parameter yang dipakai (sesuai eksekusi di VPS)

- **VPS Public IP**: `72.60.74.209`
- **IPSec PSK (Secret)**: `LLaptop7721@`
- **Initial VPN Username**: `VPN-L2TP`
- **Initial VPN Password**: `VPN2026`
- **VPN Local IP (server)**: `10.10.10.1`
- **VPN Pool**: `10.10.10.100` - `10.10.10.200`

> Catatan keamanan: kredensial di atas sebaiknya diganti ke secret khusus VPN (jangan reuse password lain) dan disimpan di password manager.

---

## 1) Setup VPN Server di VPS

### 1.1 Pull kode terbaru

```bash
ssh root@72.60.74.209
cd /opt/rrnet
git pull origin main
```

### 1.2 Jalankan installer VPN server

```bash
bash scripts/install_vpn_server.sh
```

Saat diminta prompt, isi sesuai parameter di atas:
- VPS public IP/domain: `72.60.74.209`
- IPSec PSK: `LLaptop7721@`
- Initial VPN username: `VPN-L2TP`
- Initial VPN password: `VPN2026`
- VPN local IP: `10.10.10.1`
- VPN pool start: `10.10.10.100`
- VPN pool end: `10.10.10.200`

### 1.3 Cek status server

```bash
bash scripts/vpn_server_status.sh
```

### 1.4 Tambah user VPN baru per router (recommended)

Untuk tiap MikroTik, gunakan user VPN berbeda:

```bash
bash scripts/vpn_server_add_user.sh
```

---

## 2) Setup MikroTik sebagai L2TP/IPSec Client

Lihat juga snippet lengkap di `scripts/mikrotik_l2tp_client_commands.txt`.

### 2.1 Winbox GUI (disarankan)

- Winbox → **PPP** → **Interface** → **( + )** → **L2TP Client**
- Isi:
  - **Connect To**: `72.60.74.209`
  - **User**: `VPN-L2TP` (atau user per-router jika dibuat)
  - **Password**: `VPN2026` (atau password per-router)
  - **Use IPSec**: ✓
  - **IPSec Secret**: `LLaptop7721@`
- Pastikan interface status **R (running)**.

### 2.2 Allow MikroTik API via VPN (penting)

Agar backend bisa akses MikroTik API lewat IP VPN, allow port API dari subnet VPN:

```bash
/ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728 src-address=10.10.10.0/24 comment="Allow MikroTik API from VPN"
```

Pastikan service API aktif:

```bash
/ip service print where name=api
```

---

## 3) Cara input di RRNET (Add Router)

Di halaman add router:
- **Connectivity Mode**: `VPN (Private)`
- **Host**: isi **IP VPN MikroTik** yang didapat dari pool (contoh `10.10.10.101`)
- **API Port**: `8728` (atau `8729` jika pakai API-SSL)
- **Username/Password**: kredensial **API MikroTik** (bukan user/password VPN)

> Kamu bisa lihat IP VPN MikroTik dari Winbox/terminal setelah interface L2TP client up.

---

## 4) Troubleshooting singkat

- Jika MikroTik client tidak connect:
  - Pastikan firewall VPS membuka UDP `500/4500/1701` dan ESP.
  - Pastikan PSK sama persis.
  - Pastikan user/password benar dan ada di VPS (`/etc/ppp/chap-secrets`).
- Jika VPN connect tapi API test masih timeout:
  - Pastikan rule allow API dari `10.10.10.0/24` ada di MikroTik dan posisinya di atas rule drop.
  - Pastikan port `8728` aktif di `/ip service`.


