# Feature Request & Polling Policy

Platform menyediakan mekanisme Feature Request untuk mendukung pengembangan produk berbasis kebutuhan pengguna.

---

## 1. Jenis Feature Request

### A. Paid Feature Request
- Fitur khusus atau prioritas
- Bersifat spesifik tenant
- Dikenakan biaya sesuai kesepakatan
- Tidak wajib dirilis ke tenant lain

### B. Community Feature (Polling-Based)
- Fitur diajukan oleh tenant
- Masuk ke tahap polling pada tier yang sama
- Jika memenuhi syarat, akan dikembangkan tanpa biaya tambahan

---

## 2. Aturan Polling

- Polling bersifat **tier-isolated**
- Tenant hanya dapat melihat dan memberikan suara pada polling di tier yang sama
- Voting memiliki batas waktu
- Pengelola berhak melakukan evaluasi teknis dan keamanan

---

## 3. Hak Akses (RBAC)

| Role      | Ajukan Request | Vote | Lihat Status |
|-----------|----------------|------|--------------|
| Owner     | ✔ | ✔ | ✔ |
| Admin     | ✔ | ✔ | ✔ |
| Finance   | ✘ | ✘ | Read-only |
| Teknisi   | ✘ | ✘ | ✘ |
| Collector | ✘ | ✘ | ✘ |
| HR        | ✘ | ✘ | ✘ |
| Client / Reseller | ✘ | ✘ | ✘ |

---

## 4. Ketentuan Umum

- Tidak semua fitur yang lolos polling dijamin langsung dirilis
- Pengelola berhak menunda, menggabungkan, atau menolak fitur
- Keputusan pengelola bersifat final
- Roadmap produk bersifat dinamis

Dengan menggunakan fitur ini, pengguna memahami dan menyetujui kebijakan ini.
