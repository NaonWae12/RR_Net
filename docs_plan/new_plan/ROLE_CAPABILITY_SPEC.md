# ROLE CAPABILITY SPEC (NEW_PLAN - MVP)

Dokumen ini adalah versi **penyusunan ulang** dari `docs_plan/old_plan/ROLE_CAPABILITY_SPEC.md`, disesuaikan dengan keputusan terbaru:

- **MVP RBAC = 1 role per user** (kolom `users.role_id`)
- **Admin multifungsi** (admin + HR + finance) dicapai lewat **permissions role**, bukan switch/multi-role
- **Tier Basic (tanpa RBAC)**: hanya ada user `owner`, dan UI/route hanya menampilkan modul sesuai `plans.features` (yang lain **hide + block**)  
  (lihat: `docs_plan/new_plan/TIER_MODULE_GATING.md`)

Referensi implementasi permission strings: `docs_plan/new_plan/ROLE_PERMISSION_MATRIX.md`

---

## 1) Prinsip Umum

### 1.1 RBAC vs Tier Gating

- **RBAC**: menentukan _siapa (role)_ boleh melakukan aksi tertentu.
- **Tier gating**: menentukan _apakah fitur/modul tersedia_ untuk tenant berdasarkan plan/addon/toggle.

Artinya:

- Walaupun role punya permission, **tetap bisa ditolak** kalau fitur tidak tersedia di tier.
- Untuk tier Basic, “owner full control” berlaku **hanya untuk modul yang tersedia** di Basic.

### 1.2 Format “fungsi” role

Di bawah ini, tiap role dijelaskan dengan:

- **Scope** (global vs tenant)
- **Tujuan** (fungsi utama)
- **Akses modul** (Dashboard, Client, Billing, Network, Maps, HR, dll)
- **Permission strings** (format `resource:action` / wildcard)

---

## 2) Roles

### 2.1 `super_admin` (global)

**Tujuan:** mengelola platform SaaS (multi-tenant).

**Fungsi utama (high-level):**

- Manage tenants (create/suspend/assign plan)
- Manage plans & addons
- Manage domains/ssl (future)
- Manage global feature toggles (future)
- Monitoring & audit platform-level

**Permission strings (seed):**

- `["*"]`

**Catatan batasan visibility (policy):**

- Tidak melihat data privat tenant (collector logs, internal payment history end-user, customer PII) — sesuai spec lama.

---

### 2.2 `owner` (tenant)

**Tujuan:** pemilik tenant; kontrol penuh di level tenant (sesuai tier gating).

**Fungsi utama (high-level):**

- Mengatur profil tenant (nama, domain, settings)
- Operasional inti tenant: client, billing, network, maps (jika tersedia)
- Mengelola user/employee (hanya jika feature `rbac_employee` tersedia)
- Melihat laporan & mengambil keputusan

**Akses modul (jika tersedia oleh tier):**

- Tenant/Profile/Settings: penuh
- Clients: CRUD penuh
- Billing: penuh (SaaS billing + end-user billing) sesuai modul
- Network: penuh
- Maps: penuh (Business+)
- HR/Employees: penuh (Pro+ via `rbac_employee`)
- Technician/Collector: bisa mengawasi (future)

**Permission strings (seed):**

- `["tenant:*","user:*","billing:*","network:*","maps:*","hr:*","collector:*","technician:*","client:*","wa:*","addon:*","report:*"]`

**Perilaku khusus tier Basic (tanpa RBAC):**

- Sistem tetap menyimpan role = `owner`
- UI/route hanya menampilkan modul yang tersedia di Basic (hide + block)
- Tidak ada employee management karena feature `rbac_employee` tidak tersedia

---

### 2.3 `admin` (tenant) — MVP “multifungsi”

**Tujuan:** operator utama tenant (delegasi dari owner).  
Di MVP ini, admin bisa “multifungsi” (operasional + HR + finance) lewat permissions.

**Fungsi utama (high-level):**

- Mengelola operasional (client, billing end-user, network)
- Membuat akun karyawan (HR/finance/technician/collector) bila RBAC tersedia
- Menjalankan SOP isolir/unisolir (jika tersedia)

**Permission strings**

- **Current seed (di code sekarang):**

  - `["user:read","user:create","user:update","network:*","maps:*","client:*","wa:read","wa:send","report:read"]`

- **Target MVP (disepakati di new_plan, belum dieksekusi ke DB):**
  - `["user:*","network:*","client:*","maps:*","hr:*","billing:*","collector:read","wa:*","report:*","addon:*"]`

**Catatan:**

- “Admin multifungsi” **tidak sama** dengan multi-role. Ini tetap 1 role, hanya permission-nya lebih luas.
- Jika nanti admin perlu dipersempit, bisa pindah ke model switch/multi-role.

---

### 2.4 `hr` (tenant)

**Tujuan:** mengelola SDM/karyawan tenant (employee management).

**Fungsi utama (high-level):**

- CRUD employee (akun/identitas)
- Attendance/leave/payroll (jika modul tersedia)
- Lihat report HR

**Permission strings (seed):**

- `["hr:*","user:read","report:hr"]`

**Tier dependency:**

- Hanya relevan jika feature `rbac_employee` dan/atau `hcm_module` tersedia (Pro+).

---

### 2.5 `finance` (tenant)

**Tujuan:** mengelola billing & finance tenant (end-user billing + laporan).

**Fungsi utama (high-level):**

- Invoice lifecycle (create/update/confirm)
- Payment records
- Financial reporting
- Interaksi dengan collector flow (phase 3 confirm deposit) — future

**Permission strings (seed):**

- `["billing:*","collector:read","report:finance","client:read"]`

**Tier dependency:**

- Basic: modul billing ada tapi sederhana; finance role biasanya tidak dipakai karena tidak ada RBAC.
- Pro+: billing makin lengkap, finance role berguna.

---

### 2.6 `technician` (tenant)

**Tujuan:** teknisi lapangan (operasional jaringan + tugas teknisi).

**Fungsi utama (high-level):**

- Menangani task/outage
- Akses baca peta/topologi (jika tersedia)
- Akses baca status network terbatas

**Permission strings (seed):**

- `["technician:*","maps:read","client:read","network:read"]`

**Tier dependency:**

- Umumnya butuh maps/topology (Business+). Untuk Pro/Basic, menu teknisi bisa di-hide via tier gating.

---

### 2.7 `collector` (tenant)

**Tujuan:** penagihan cash (collector flow 3-phase) — sebagian besar future module.

**Fungsi utama (high-level):**

- Akses daftar client yang ditugaskan
- Mark “collect/visit success”
- Laporkan setoran (phase 2), finance konfirmasi (phase 3)

**Permission strings (seed):**

- `["collector:*","client:read","billing:collect"]`

**Catatan:**

- Spec lama menyebut “technician bisa multifungsi collector” → itu butuh **multi-role** atau role gabungan.  
  Karena MVP kita 1-role, opsi nanti:
  - buat role custom `technician_collector` (gabungan permission), atau
  - upgrade model ke multi-role/switch.

---

### 2.8 `client` (tenant end-user portal)

**Tujuan:** end-user/customer (portal pelanggan).

**Fungsi utama (high-level):**

- Lihat tagihan sendiri
- Bayar tagihan sendiri
- Terima notifikasi WA (future)

**Permission strings (seed):**

- `["client:self","billing:self","wa:receive"]`

---

## 3) Ringkasan praktis (MVP)

### 3.1 Tier Basic

- Role yang dipakai: `owner` saja
- UI/route: hide + block modul non-Basic
- Tidak ada employee creation (tidak ada `rbac_employee`)

### 3.2 Tier Pro/Business/Enterprise

- Role yang dipakai: owner/admin/hr/finance/technician/collector/client (sesuai kebutuhan)
- Admin bisa multifungsi lewat permission design (target)

---

## 4) Next steps (setelah dokumen ini)

- Decide final “admin multifungsi” permissions → update `roles.permissions` di DB seed/migration.
- Tambahkan employee CRUD + assignment rules:
  - owner full access: owner bisa register employee & client
  - jika owner breakdown: HR register employee, admin register client (di-enforce via permission)
