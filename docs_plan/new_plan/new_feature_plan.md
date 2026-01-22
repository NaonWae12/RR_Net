# Feature Plan – SaaS RT/RW Net

Dokumen ini menjelaskan pembagian fitur berdasarkan tier layanan.
Perubahan fitur dapat dilakukan secara berkala mengikuti roadmap produk.

---

## 📦 Paket & Harga

| Tier | Harga |
|-----|------|
| Basic | 150k / bulan |
| Pro | 400k / bulan |
| Business | 950k / bulan |
| Enterprise | 2jt+ / bulan |

---

## 🧩 Daftar Fitur per Tier

| Fitur                                        | Basic | Pro | Business | Enterprise | Status Dev |
|--------------------------------------------- |-------|-----|----------|------------|------------|
| **Radius Basic**                             |   ✔   |  ✔ |     ✔    | ✔      | 🟧 |
| **MikroTik API Basic**                       | ✔ | ✔ | ✔ | ✔ | 🟩 |
| **MikroTik Control Panel (Advanced)**        | ✘ | ✔ | ✔ | ✔ | 🟩 |
| **Max Router**                               | 2 | 5 | 10 | Unlimited | — |
| **Max User**                                 | 250 | 1.000 | 5.000 | Unlimited | — |
| **Active User**                              | Unlimited | Unlimited | Unlimited | Unlimited | ★ |
| **Voucher Limit**                            | 15.000 | 35.000 | Unlimited | Unlimited | 🟧 |
| **RBAC Employee**                            | ✔ | ✔ | ✔ | ✔ | 🟩 |
| **RBAC Client / Reseller**                   | ✔ | ✔ | ✔ | ✔ | 🟩 |
| **ODP Maps**                                 | ✘ | ✘ | 100 | Unlimited | ⬜ |
| **Client Maps**                              | ✘ | ✘ | 600 | Unlimited | ⬜ |
| **Payment Gateway**                          | ✘ | ✔ | ✔ | ✔ | ⬜ |
| **WA Gateway**                               | ✔ (basic) | ✔ | ✔ | ✔ | 🟧 |
| **Manual Isolir**                            | ✔ | ✔ | ✔ | ✔ | 🟩 |
| **Auto Isolir**                              | ✘ | ✔ | ✔ | ✔ | ⬜ |
| **API Integration**                          | 1 API | Partial | Full | Full + Custom | 🟧 |
| **Multi-tenant SaaS (Super Admin)**          | ✘ | ✘ | ✘ | ✔ | 🟩 |
| **High Availability**                        | ✘ | ✘ | ✘ | ✔ | ⬜ |
| **White-label Full**                         | ✘ | ✘ | Optional | ✔ | ⬜ |
| **AI Agent (Client via WA)**                 | ✘ | Optional Add-on | ✔ | ✔ | ⬜ |
| **AI Agent (Admin Ops)**                     | Coming Soon | Coming Soon | Coming Soon | Coming Soon | ⬜ |
| **HCM (Absensi, Gaji, Cuti, Reimbursement)** | ✘ | ✔ | ✔ | ✔ | 🟩 |
| **Mobile App (Client/Employee)**             | Coming Soon | Coming Soon | Coming Soon | Coming Soon | ⬜ |
| **Custom Login Page**                        | ✘ | ✘ | ✔ | ✔ | ⬜ |
| **Custom Isolir Page**                       | ✘ | ✘ | ✔ | ✔ | ⬜ |
| **Payment Reporting (Advanced)**             | ✘ | ✔ | ✔ | ✔ | 🟩 |
| **Payment History**                          | 1 Tahun | Unlimited | Unlimited | Unlimited | 🟧 |
| **Dashboard Pendapatan**                     | ✘ | ✔ | ✔ | ✔ | 🟩 |
| **CPE Remote Management (GenieACS / TR-069)**| Coming Soon | Coming Soon | Coming Soon | Coming Soon | ⬜ Future Add-on |

---

## 📌 Catatan Penting

- Fitur **CPE Remote Management (GenieACS / TR-069)** direncanakan sebagai **add-on terpisah**.
- Ketersediaan fitur tergantung kompatibilitas perangkat pelanggan.
- Tidak semua fungsi dapat digunakan pada semua jenis modem / ONT.
- Roadmap produk dapat berubah mengikuti kebutuhan pasar dan kelayakan teknis.

##
tier enterprice : - full tier business: - owner - admin + rangkap ngatur gaji tapi simple task - teknisi + (extend) collector - finance + (extend) administrator inventaris - client + (extend) reseller tier pro - owner - admin - teknisi + (extend) collector - finance + (extend) administrator inventaris - client + (extend) reseller tier basic - owner - admin - teknisi + (extend) collector - client + (extend) reseller
