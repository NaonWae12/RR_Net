# Deep Dive: Auto Provisioning Strategy

## 1. Fokus Pengembangan
Fase pertama pengembangan fitur Enterprise difokuskan pada **Auto Provisioning**, yaitu proses aktivasi otomatis modem pelanggan dari dashboard ERP.

## 2. Strategi Jalur OLT (Full Automation)
Digunakan untuk tenant yang sudah menggunakan OLT (HSGQ, HIOSO, V-SOL, Huawei).

### Alur Kerja:
1. **Discovery:** ERP melakukan polling ke OLT via SNMP/CLI untuk mendeteksi "Unconfigured ONU".
2. **Alerting:** Admin menerima notifikasi adanya perangkat baru di dashboard.
3. **Binding:** Admin memilih client dari database untuk dipasangkan dengan Serial Number (SN) modem tersebut.
4. **Execution:**
   - ERP mengirim command ke OLT untuk **Authorize** ONU.
   - ERP mengirim command ke MikroTik untuk membuat **PPPoE Secret**.
   - ERP mengirim command ke GenieACS untuk push konfigurasi WAN ke modem.

## 3. Strategi Jalur HTB / Hybrid (Semi-Automation)
Digunakan untuk tenant yang belum menggunakan OLT atau menggunakan sistem media converter.

### Alur Kerja:
1. **IP Management Registration:** Admin/Teknisi cukup memasukkan **Management IP** modem ke ERP (tanpa perlu input SN/MAC yang ribet).
2. **IP Management Setup:** Teknisi mengatur IP Management modem secara unik (misal: 172.16.x.x) dan mematikan DHCP Server pada modem.
3. **Network Segmentation:** Pastikan segmen **IP Management** (untuk perangkat) berbeda dengan segmen **IP Hotspot** (untuk user).
   - *Contoh:* IP Management `172.16.0.0/24`, IP Hotspot User `10.20.30.0/24`.
4. **Automated Config:** ERP membuatkan profile PPPoE di MikroTik dan otomatis menambahkan **Netwatch** untuk monitoring IP Management tersebut.
5. **Bridging Hotspot:** Jika untuk kebutuhan Hotspot, modem di-set mode **Bridge** agar MAC Address HP user langsung terbaca oleh MikroTik.

## 4. Perbandingan Implementasi

| Fitur | Jalur OLT | Jalur HTB |
| :--- | :--- | :--- |
| **Deteksi Modem Baru** | Otomatis (via SNMP) | Management IP |
| **Otorisasi Hardware** | Remote via OLT (SN Based) | Tidak Ada |
| **Push Config WAN** | Via GenieACS (TR-069) | Via GenieACS / Manual |
| **Ketergantungan IP** | Tidak Butuh IP (OMCI) | Wajib IP Management Unik |

## 6. MikroTik Configuration Template (HTB Mode)

Berikut adalah contoh script yang bisa diadaptasi untuk setup Management Network di MikroTik:

### A. Setup Management IP
Jalankan ini di interface yang terhubung ke jalur HTB (misal: `ether2` atau `bridge-htb`):
```routeros
/ip address
add address=172.16.0.1/24 interface=ether2 comment="Management Modem Network"
```

### B. Setup Netwatch Monitoring (Automated by ERP)
Contoh script Netwatch yang akan digenerate oleh ERP untuk tiap modem:
```routeros
/tool netwatch
add host=172.16.0.2 interval=1m comment="Monitoring-Modem-Client-1" \
    down-script="/tool fetch url=\"http://erp-anda.com/api/v1/monitoring/callback?ip=172.16.0.2&status=down\" keep-result=no" \
    up-script="/tool fetch url=\"http://erp-anda.com/api/v1/monitoring/callback?ip=172.16.0.2&status=up\" keep-result=no"
```

### C. Firewall Security (Optional but Recommended)
Supaya user hotspot nggak bisa iseng buka-buka IP management modem:
```routeros
/ip firewall filter
add action=drop chain=forward dst-address=172.16.0.0/24 src-address-list=!admin_list \
    comment="Block hotspot users from accessing modem management"
```
