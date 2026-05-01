# Hybrid RADIUS Implementation Plan

## Objective
Meningkatkan ketersediaan (availability) layanan RADIUS server agar 100% imun terhadap putusnya jaringan VPN. Dengan setup ini, request RADIUS dari MikroTik akan secara otomatis beralih menggunakan jalur internet publik (tanpa VPN) jika gateway VPN tidak bisa diakses, menjamin layanan autentikasi Hotspot/PPPoE tetap berjalan lancar.

## Current Condition
- MikroTik saat ini hanya memiliki 1 entri Server RADIUS (`10.10.10.1` untuk L2TP / `10.10.20.1` untuk SSTP).
- Jika router terputus dari VPN, packet autentikasi RADIUS tidak akan kekirim, bikin user gagal login voucher.
- File `infra/freeradius/clients.conf` saat ini di-*lock* hanya menerima request dari network `10.0.0.0/8`. Koneksi RADIUS public IP diblokir di level FreeRADIUS.

## Implementation Steps

### 1. Update FreeRADIUS Configuration 
Kita harus memperbolehkan trafik dari IP manapun (`0.0.0.0/0`) masuk ke *dockerized* FreeRADIUS dengan secret key yang sudah kita atur (tetap aman asal *secret key* kuat).

**File target:** `infra/freeradius/clients.conf`

**Perubahan (Tambahkan baris berikut):**
```text
client public-nets {
  ipaddr = 0.0.0.0/0
  secret = rrnet-dev-radius-secret
  require_message_authenticator = no
}
```
*Setelah merubah ini, docker FreeRADIUS harus di-restart (`docker restart rrnet-freeradius-prod`).*

### 2. Update Backend Router Generation Script
Agar otomatis saat router baru dibuat aplikasi, kita perlu melakukan update pada method konfigurasi skrip MikroTik.

**File target:** `be/internal/service/network_service.go`
**Function target:** `generateMikrotikRadiusScript(router *network.Router)` dan logic proxy API (seperti di method `SetupRadius` / `radius.go`). 

**Perubahan di skrip MikroTik:**
Tambahkan baris tambahan pada CLI command MikroTik supaya ada *2 entri radius*:

```text
/radius add address=10.x.x.x secret=XXX service=hotspot,ppp comment="RR-NET (VPN)"
/radius add address=<IP_PUBLIC_VPS> secret=XXX service=hotspot,ppp comment="RR-NET (Backup)"
```

### 3. Eksekusi Router Eksisting
Untuk client-client router yang sudah terpasang, siapkan command untuk meng-*inject* konfigurasi RADIUS *backup* ini secara massal (melalui backend remote API, API `/radius/add`).

## Catatan Tambahan (Security Consideration)
- Walau IP Public dibuka `0.0.0.0/0` untuk port UDP `1812/1813`, keamanannya tetap bergantung pada `radius_secret` yang kompleks. 
- Jika takut adanya Brute Force, kita bisa menambahkan opsi `iptables` di VPS untuk hanya me-whitelist IP Public spesifik pelanggan ISP, walau fitur ini butuh effort monitoring public IP router client secara berkala berhubung IP telkom/ISP sering berubah (dynamic). Konfigurasi `client public-nets` dengan secret yang panjang sejauh ini dinilai *cukup aman*.
