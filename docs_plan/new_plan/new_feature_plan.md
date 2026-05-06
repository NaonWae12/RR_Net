# 🚀 Feature Plan – SaaS RT/RW Net (Updated 2026-05-05)

Dokumen ini menjelaskan pembagian fitur berdasarkan tier layanan. Perubahan dilakukan untuk memastikan setiap tier memiliki nilai proposisi yang jelas, terutama pada fitur Manajemen Voucher dan Keuangan.

---

## 📦 Paket & Harga

| Tier | Harga | Target Pengguna |
|-----|------|-----------------|
| **Basic** | 150k / bulan | Personal / RT RW Net Pemula (Max 2 Router) |
| **Pro** | 400k / bulan | Bisnis ISP Menengah (Max 5 Router) |
| **Business** | 950k / bulan | ISP Profesional / Skala Wilayah (Max 10 Router) |
| **Enterprise** | 2jt+ / bulan | Provider Skala Besar / Korporat (Unlimited) |

---

## 🧩 Komparasi Fitur Utama

| Fitur | Basic | Pro | Business | Enterprise | Status |
|:--- |:---:|:---:|:---:|:---:|:---:|
| **Manajemen Router (MikroTik)** | 2 Unit | 5 Unit | 10 Unit | Unlimited | 🟩 |
| **Kapasitas User Active** | 250 | 1.000 | 5.000 | Unlimited | 🟩 |
| **Voucher Limit (Storage)** | 15.000 | 35.000 | Unlimited | Unlimited | 🟧 |
| **Radius Server** | ✔ | ✔ | ✔ | ✔ | 🟩 |
| **Auto Isolir (Billing)** | ✘ | ✔ | ✔ | ✔ | ⬜ |
| **Payment Gateway Integration** | ✘ | ✔ | ✔ | ✔ | ⬜ |
| **WA Gateway Notification** | Basic | Full | Full | Full | 🟧 |
| **HCM (Absensi & Gaji)** | ✘ | ✔ | ✔ | ✔ | 🟩 |
| **AI Agent (Ops & Client)** | ✘ | Add-on | ✔ | ✔ | ⬜ |

---

## 🎟️ Manajemen Voucher & Desain (Optimized)
*Optimasi layout voucher untuk hasil print maksimal dan kemudahan branding.*

| Fitur Desain Voucher | Basic | Pro | Business | Enterprise |
|:--- |:---:|:---:|:---:|:---:|
| **Standard Templates** | ✔ | ✔ | ✔ | ✔ |
| **Optimized Mikhmon (18px Font)** | ✔ (Standard) | ✔ (Custom) | ✔ (Full) | ✔ (Full) |
| **Modern QR (88px Height)** | ✘ | ✔ | ✔ | ✔ |
| **Inner Border Thickness (2px)** | ✔ | ✔ | ✔ | ✔ |
| **Branding Management (DNS/Label)** | ✘ | ✔ (1 DNS) | ✔ (Unlimited) | ✔ (Unlimited) |
| **Print Preview A4 Simulation** | ✔ | ✔ | ✔ | ✔ |

---

## 👥 Struktur Peran & RBAC (Tier Comparison)
*Pembagian peran operasional untuk efisiensi manajemen tim.*

### 1. Tier Basic (Starter)
- **Owner**: Kontrol utama & Reporting.
- **Admin**: Input data & Manajemen harian.
- **Teknisi + Collector**: Perbaikan jaringan sekaligus penagihan ke rumah pelanggan.
- **Client + Reseller**: Akses dasar ke portal pelanggan.

### 2. Tier Pro (Scale-up)
- **Owner & Admin**: Terpisah untuk akuntabilitas.
- **Teknisi + Collector**: Fokus pada pemeliharaan dan retensi pelanggan.
- **Finance + Inventory**: Manajemen kas kecil dan stok barang (modem, kabel).
- **Client + Reseller**: Portal khusus reseller voucher.

### 3. Tier Business (Corporate)
- **Owner**: Strategic dashboard.
- **Admin (+HCM Task)**: Mengurus data karyawan & gaji (simple flow).
- **Teknisi + Collector**: Tim lapangan terpisah untuk area luas.
- **Finance + Inventory**: Akuntansi lengkap dan kontrol gudang.
- **Client + Reseller**: White-label portal (Custom Branding).

### 4. Tier Enterprise (Full Power)
- **Full Tier Capabilities**: Akses ke seluruh peran tanpa pengecualian.
- **Super Admin Panel**: Untuk manajemen multi-organisasi atau sub-cabang.

---

## 📌 Catatan Teknis & Roadmap
- **CPE Remote Management (GenieACS / TR-069)**: Direncanakan sebagai **Add-on Terpisah**.
- **Mobile App**: Sedang dalam tahap pengembangan (*Coming Soon*).
- **White-label**: Tersedia secara opsional di tier Business dan standar di tier Enterprise.
