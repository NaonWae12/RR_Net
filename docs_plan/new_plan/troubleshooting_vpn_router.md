# RRNet VPN & Router Provisioning Troubleshooting Guide

Dokumen ini merangkum masalah teknis, arsitektur, dan solusi yang diimplementasikan untuk fitur Create Router & Remote Winbox Access.

## 1. Arsitektur Jaringan (Kondisi Akhir)

Untuk memastikan backend dapat mengelola `iptables` host dan VPN tunnel secara real-time, arsitektur diputuskan menggunakan **Host Networking** untuk layanan utama:

- **Nginx & Frontend & Backend**: Berjalan dalam `network_mode: host`.
- **Komunikasi Internal**: Menggunakan `127.0.0.1` (localhost).
- **Database (Postgres) & Redis**: Tetap dalam container bridge namun di-expose secara aman ke `127.0.0.1` agar bisa diakses oleh backend.

## 2. Masalah & Solusi Teknis

### A. Docker Volume & `sed -i` (Resource Busy)
- **Masalah**: Script manajemen user VPN gagal memodifikasi `/etc/ppp/chap-secrets`.
- **Penyebab**: Docker mount tidak mengizinkan pergantian *inode* file yang sedang di-mount (perilaku default `sed -i`).
- **Solusi**: Gunakan teknik penulisan ulang file:
  ```bash
  sed "..." file > file.tmp && cat file.tmp > file && rm file.tmp
  ```

### B. Network Mode (Host vs Bridge)
- **Masalah**: Backend tidak bisa memasang rule `iptables` ke VPS host dari dalam container.
- **Penyebab**: Container memiliki network namespace (dan tabel iptables) sendiri yang terisolasi.
- **Solusi**: Menggunakan `network_mode: host` pada container backend di `docker-compose.production.yml`.

### C. Nginx Proxying di Host Network
- **Masalah**: Layanan web (Nginx) memberikan error 502 Bad Gateway.
- **Penyebab**: Setelah backend pindah ke host network, DNS Docker tidak dapat menyelesaikan nama `backend`.
- **Solusi**: 
  1. Pindahkan Nginx ke host network.
  2. Gunakan `server 127.0.0.1:8080` (Backend) dan `server 127.0.0.1:3000` (Frontend) dalam `nginx/nginx.conf`.

### D. Router Duplication (Frontend Logic)
- **Masalah**: Terjadi duplikasi data router saat klik "Complete Setup".
- **Penyebab**: Form mengirim request `POST` baru di Step 3, padahal router ID sudah tercipta saat `Provisioning` di Step 1.
- **Solusi**: Tambahkan validasi di `RouterForm.tsx` untuk membedakan antara `Update` (jika `provisionedId` ada) dan `Create` (jika baru).

### E. Firewall FORWARD Policy (DROP)
- **Masalah**: Tunnel Up, DNAT Up, tapi Winbox tetap tidak bisa terkoneksi.
- **Penyebab**: Policy default `FORWARD` pada VPS adalah `DROP`. Paket DNAT tidak diizinkan melintasi interface bridge/ppp.
- **Solusi**: Tambahkan rule ijin forwarding di host VPS:
  ```bash
  # Izin masuk ke tunnel
  iptables -I FORWARD 1 -i eth0 -o ppp+ -p tcp --dport 8291 -j ACCEPT
  # Izin paket kembali (Established/Related)
  iptables -I FORWARD 2 -i ppp+ -o eth0 -m state --state RELATED,ESTABLISHED -j ACCEPT
  ```

## 3. Checklist Debugging (Cepat)

Jika Remote Winbox Gagal:
1. Cek apakah tunnel ada: `ip addr show | grep ppp`.
2. Cek apakah DNAT ada: `iptables -t nat -L -n -v | grep DNAT`.
3. Cek hits pada FORWARD rule: `iptables -L FORWARD -n -v`.
4. Cek apakah port Winbox MikroTik terbuka: `nc -zv -w5 <IP-TUNNEL> 8291`.

---
*Dokumen ini dibuat otomatis sebagai bagian dari perbaikan sistem VPN RRNet.*
