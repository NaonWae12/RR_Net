# Arsitektur & Perencanaan Integrasi ACS (TR-069 / GenieACS) — ERP_NET

## 1. Pendahuluan & Tujuan
Fitur Auto Configuration Server (ACS) berbasis TR-069 (CWMP - CPE WAN Management Protocol) dirancang untuk memberikan kendali penuh terhadap perangkat CPE (Customer Premises Equipment / ONT / Router pelanggan) dari jarak jauh tanpa harus mendatangi lokasi fisik pelanggan.

### Tujuan Utama:
1. **Monitoring Real-time ONT**: Mengetahui status online/offline, Optical Power RX/TX (redaman fiber optic dalam dBm), uptime, suhu, tegangan, dan daftar perangkat klien yang terhubung ke WiFi.
2. **Remote Management Tanpa Login Web GUI**:
   - Ganti SSID (Nama WiFi) & Password WiFi langsung dari dashboard ERP / Portal Pelanggan.
   - Remote Reboot ONT.
   - Remote Factory Reset / Restore config.
3. **Zero-Touch Provisioning**:
   - Saat ONT baru dicolok ke jaringan dan mengarah ke ACS, sistem otomatis men-set username & password PPPoE, VLAN Internet, dan parameter dasar sesuai data pelanggan di ERP.
4. **Isolasi Multi-Tenancy**:
   - Tiap Tenant di ERP hanya bisa melihat dan mengontrol ONT milik pelanggannya masing-masing (menggunakan fitur tagging & virtual parameter GenieACS).

---

## 2. Pilihan Teknologi: GenieACS
Kita memilih **GenieACS** sebagai server ACS karena:
- Merupakan standar industri open-source paling stabil, mature, dan digunakan oleh ribuan ISP/RT-RW Net di seluruh dunia.
- Mendukung protokol TR-069, TR-098 (Data Model lama: InternetGatewayDevice), dan TR-181 (Data Model baru: Device).
- Kompatibel dengan mayoritas ONT di pasar Indonesia (ZTE F609/F660/F670L, Huawei HG8245H/H5, FiberHome AN5506, VSOL, C-Data, dsb).
- Memiliki **NBI (Northbound Interface)** berbasis REST API (port 7557) yang mudah diintegrasikan dengan Backend Go kita via JSON HTTP.

---

## 3. Komponen & Alokasi Port

GenieACS terdiri dari 4 service utama:

| Service | Port Default | Port Mapping Host | Fungsi |
|---|---|---|---|
| **CWMP** | `7547` | `7547` | Menerima koneksi HTTP/SOAP dari ONT pelanggan (Informing) |
| **NBI** | `7557` | `7557` | REST API untuk dikonsumsi oleh Backend Go ERP_NET |
| **FS** | `7567` | `7567` | File server untuk upload firmware / file konfigurasi XML |
| **UI** | `3000` | `7558` | Web Dashboard Admin GenieACS (diubah ke 7558 agar tidak bentrok dengan Next.js) |
| **MongoDB** | `27017` | `27017` | Database internal GenieACS untuk menyimpan tree parameter TR-069 |

---

## 4. Alur Integrasi Sistem

```
+-------------------------------------------------------------------------+
|                                PELANGGAN                                |
|  [ ONT Pelanggan ] (ZTE / Huawei / VSOL)                                |
|           |                                                             |
|           | 1. HTTP Inform (Port 7547) TR-069                           |
|           v                                                             |
+-----------+-------------------------------------------------------------+
|                               GENIEACS                                  |
|  [ GenieACS CWMP ] ---> [ MongoDB ] <--- [ GenieACS NBI (Port 7557) ]   |
+------------------------------------------------+------------------------+
                                                 ^
                                                 | 2. REST API (JSON)
                                                 v
+------------------------------------------------+------------------------+
|                                ERP_NET                                  |
|  [ Backend Go ] (internal/infra/genieacs)                               |
|        ^                                                                |
|        | Internal Handler / Service                                     |
|        v                                                                |
|  [ PostgreSQL ] (Tabel: ont_devices, ont_device_logs)                   |
|        ^                                                                |
|        | API /api/v1/acs/...                                            |
|        v                                                                |
|  [ Frontend Next.js ] (Tab "Perangkat ONT" di Detail Client)           |
+-------------------------------------------------------------------------+
```

---

## 5. Rencana Skema Database ERP_NET

Tabel baru yang akan ditambahkan (dengan migrasi bersih):

### `ont_devices`
- `id` (UUID, PK)
- `tenant_id` (UUID, FK -> tenants)
- `client_id` (UUID, Nullable, FK -> clients) - Relasi ke pelanggan jika sudah di-assign
- `serial_number` (VARCHAR, Unique per tenant) - Nomor seri unik ONT (contoh: ZTEGC1234567 atau HWTC12345678)
- `mac_address` (VARCHAR)
- `oui` (VARCHAR) - Organizationally Unique Identifier vendor
- `product_class` (VARCHAR) - Model perangkat (misal: F609, HG8245H5)
- `manufacturer` (VARCHAR) - ZTE, Huawei, Fiberhome, dll
- `hardware_version` (VARCHAR)
- `software_version` (VARCHAR)
- `ip_address` (VARCHAR) - IP yang didapat ONT saat ini
- `status` (VARCHAR: `online`, `offline`)
- `rx_power_dbm` (NUMERIC) - Redaman penerimaan FO (dBm)
- `tx_power_dbm` (NUMERIC) - Redaman pancaran FO (dBm)
- `wifi_ssid` (VARCHAR)
- `wifi_enabled` (BOOLEAN)
- `uptime_seconds` (BIGINT)
- `last_inform_at` (TIMESTAMPTZ)
- `created_at` & `updated_at` (TIMESTAMPTZ)

---

## 6. Tahapan Pengembangan (Roadmap)

### Fase 1: Lingkungan Terisolasi & Docker Setup
- [x] Buat branch terisolasi: `feat/acs-tr069`
- [ ] Buat `docker-compose.acs.yml` standalone (MongoDB + GenieACS CWMP, NBI, FS, UI).
- [ ] Buat file environment `.env.acs.example`.
- [ ] Pastikan GenieACS UI bisa diakses di `http://localhost:7558` dan NBI di `http://localhost:7557`.

### Fase 2: Client Library Backend (Go)
- [ ] Buat package `internal/infra/genieacs` untuk komunikasi HTTP ke GenieACS NBI (GET /devices, POST /devices/{id}/tasks).
- [ ] Buat parser parameter TR-069 umum:
  - Redaman optik (ZTE: `InternetGatewayDevice.WANDevice.1.X_ZTE-FTTH_WANPONInterfaceConfig.RXPower`, Huawei: `InternetGatewayDevice.WANDevice.1.X_HW_DEBUG.SMP.OPTIC.RxPower`).
  - Info WiFi SSID & Password (`InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID`, `PreSharedKey.1.KeyPassphrase`).
  - Reboot command (`setParameterValues` / `reboot`).

### Fase 3: Service & Handler ERP
- [ ] Service `ACSService` untuk sync data dari GenieACS ke PostgreSQL ERP.
- [ ] Endpoint backend untuk:
  - List ONT per Tenant.
  - Link/Unlink ONT ke Client.
  - Get Real-time optical signal (dBm).
  - Ubah Nama & Password WiFi.
  - Trigger Reboot ONT.

### Fase 4: Frontend UI
- [ ] Tambahkan tab "Perangkat ONT" di Detail Client.
- [ ] Kartu indikator sinyal FO:
  - Hijau: -15 dBm s/d -24 dBm (Normal)
  - Kuning: -25 dBm s/d -27 dBm (Peringatan)
  - Merah: > -28 dBm (Redaman buruk / LOS)
- [ ] Tombol kontrol: "Reboot ONT", "Ganti Password WiFi", "Refresh Parameter".

---

## 7. Keamanan & Isolasi Kode
- Semua fitur baru berada di branch `feat/acs-tr069`.
- Konfigurasi diatur via flag environment: `ACS_ENABLED=false` secara default, sehingga bila dideploy ke prod tanpa GenieACS, sistem lama tetap berjalan 100% normal tanpa gangguan.
