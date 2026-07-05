# Enterprise Features Overview: Auto Provisioning & Modem Monitoring

## 1. Pendahuluan
Dokumen ini merangkum rencana pengembangan fitur Enterprise pada ERP_NET, yang bertujuan untuk meningkatkan efisiensi operasional ISP melalui otomatisasi pengaturan perangkat (Provisioning) dan pengawasan kondisi perangkat (Monitoring) secara real-time.

## 2. Fitur Utama

### A. Auto Provisioning
Proses otomatisasi konfigurasi modem (ONT/CPE) baru agar bisa langsung terhubung ke layanan internet tanpa perlu setting manual yang rumit di sisi perangkat.
- **Goals:** Zero-touch provisioning untuk perangkat yang mendukung.
- **Target:** Mempercepat waktu pemasangan client baru.

### B. Modem Monitoring
Sistem pengawasan kondisi fisik dan logika modem dari dashboard pusat.
- **Goals:** Deteksi dini gangguan (kabel putus, redaman tinggi, atau power loss).
- **Target:** Mengurangi biaya maintenance dan mempercepat penanganan trouble.

## 3. Teknologi yang Digunakan

| Komponen | Teknologi | Peran |
| :--- | :--- | :--- |
| **Protocol Management** | **GenieACS (TR-069)** | Komunikasi remote ke modem untuk push/pull konfigurasi (SSID, PPPoE, dll). |
| **Network Infrastructure** | **MikroTik API** | Manajemen user (PPPoE/Hotspot), bandwidth control (Queues), dan Netwatch. |
| **Optical Layer** | **SNMP / CLI (SSH)** | Komunikasi ke OLT (HSGQ, HIOSO, V-SOL, Huawei) untuk otorisasi perangkat. |
| **Backend Engine** | **Golang** | Orchestrator yang menghubungkan OLT, MikroTik, dan ACS. |

## 4. Strategi Implementasi

### Jalur OLT (Enterprise Mode)
Memanfaatkan fitur manajemen hardware bawaan OLT (OMCI) untuk kontrol penuh terhadap modem, terlepas dari konfigurasi IP modem tersebut.
- **Kelebihan:** Bisa monitoring redaman sinyal (Optical Power) dan remote modem meskipun mode Bridge.

### Jalur HTB / Media Converter (Standard Mode)
Menggunakan teknik **IP Management** dan **MikroTik Netwatch** untuk melakukan pengawasan terhadap perangkat yang berada di jaringan Layer 2 yang pasif.
- **Kelebihan:** Murah dan bisa diaplikasikan pada jaringan lama.
- **Kekurangan:** Terbatas pada monitoring status Online/Offline saja.

## 5. Rencana Tahapan Eksekusi
1. **Fase 1:** Auto Provisioning (Prioritas Utama).
2. **Fase 2:** Modem Monitoring & Alerting System.
3. **Fase 3:** Integrasi Maps & Fault Localization (Deteksi titik putus kabel).
