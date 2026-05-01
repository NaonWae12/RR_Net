# Panduan Troubleshooting VPN & Remote Winbox (MikroTik)

Dokumen ini berisi langkah-langkah praktis untuk mengecek dan memperbaiki router MikroTik yang statusnya offline atau tidak bisa di-remote via Winbox dari VPS.

---

## 1. Cek Apakah Router Terkoneksi VPN
Pertama, kita harus pastikan router MikroTik berhasil melakukan *dial-in* (konek) ke VPS kita.

**A. Cari IP VPN dari Username Router**
Buka daftar otentikasi VPN `/etc/ppp/chap-secrets`. Misal nama routernya "Zam-Zam":
```bash
cat /etc/ppp/chap-secrets | grep -i "zam"
```
*Output yang diharapkan:*
`vpn-hp-zam-zam-1efa * a6ef11dc1904 10.10.20.11`
Dari sini kita dapat **IP VPN: 10.10.20.11**.

**B. Cek Apakah IP Tersebut Sedang Aktif (Konek)**
Cari tahu apakah IP tersebut muncul di *interface* ppp:
```bash
ip address show | grep "10.10.20.11"
```
*Atau lihat list semua sesi SSTP detail:*
```bash
accel-cmd show sessions
```
*Jika IP tersebut muncul, berarti internet router sehat dan tunnel VPN nyambung! Lanjut ke langkah 2.*

---

## 2. Cek Akses Winbox (Ping dan Netcat)
Mari kita tes dari dalam VPS, apakah port Winbox di router tersebut kebaca dan terbuka. 
*(Gunakan IP VPN yang didapat di langkah 1, contoh: 10.10.20.11)*

**Cek Kestabilan Latency Ping:**
```bash
ping -c 3 10.10.20.11
```
*(Pastikan tidak RTO. Jika latency ratusan millisecond, indikasi ISP di router lagi bapuk).*

**Cek Port Winbox (8291):**
```bash
nc -zv 10.10.20.11 8291
```
*(Harus muncul `succeeded!`. Kalau `timeout / refused`, berarti fitur layanan Winbox di IP->Services MikroTik dimatikan, diganti portnya, atau diblok firewall).*

---

## 3. Cek Port Forwarding (Kasus Winbox Nyasar/Duplikat)
Jika Winbox VPS bilang "Timeout" waktu di-remote lewat port Publik (misal 10500) padahal langkah 1 dan 2 sukses, kemungkinan besar ada **bentrok di iptables (Duplikat)**.

**Lihat siapa saja yang memakai port 10500:**
```bash
iptables -t nat -L PREROUTING --line-numbers -n -v | grep 10500
```
Jika muncul **lebih dari satu baris**, berarti Winbox nyasar ke router lain yang mendapat antrean atas!

**Cara Mengatasi Duplikat (Contoh Port 10500):**

1. Hapus semua lintasan *port* yang bentrok. Ulangi perintah di bawah sampai error / not found (untuk IP yang benar maupun yang salah):
```bash
iptables -t nat -D PREROUTING -p tcp --dport 10500 -j DNAT --to-destination 10.10.10.101:8291
iptables -t nat -D PREROUTING -p tcp --dport 10500 -j DNAT --to-destination 10.10.20.11:8291
```

2. Tambahkan ulang HANYA untuk IP router yang benar:
```bash
iptables -t nat -A PREROUTING -p tcp --dport 10500 -j DNAT --to-destination 10.10.20.11:8291
```

3. Save permanen konfigurasi IPTables:
```bash
iptables-save > /etc/iptables/rules.v4
```

---

## Ringkasan Alur Masalah

1. **Router Gak Konek Sama Sekali?** Cek listrik router, cek apakah ISP lokal mati.
2. **Konek tapi Remote Lemot/Spike?** Internet lokal di lokasi router sedang ampas / *lossy* gara-gara nge-*drop* paketan TCP VPN (SSTP). Coba geser L2TP jika bisa.
3. **Ping Aman tapi Winbox Gak Konek?** Duplikat rules *iptables* gara-gara sisa *cache* router lama yang dihapus tak bersih. Lakukan **Langkah 3** di atas.
