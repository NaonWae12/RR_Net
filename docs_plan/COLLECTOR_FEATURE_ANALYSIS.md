# 📋 ANALISIS & SPESIFIKASI FITUR COLLECTOR

**Tanggal Analisis:** 2025-01-13  
**Status:** Audit & Spesifikasi (BELUM CODING)  
**Sumber Referensi:** docs_plan, execution plans, existing codebase

---

## 1️⃣ AUDIT DOKUMEN

### Dokumen yang Telah Diperiksa

1. **BE/docs/execution/EXECUTION_08.yaml** - Spesifikasi utama collector system
2. **BE/docs/execution/EXECUTION_08_1.yaml** - Hardening & integrasi dengan billing
3. **docs_plan/new_plan/ROLE_CAPABILITY_SPEC.md** - Definisi role collector
4. **docs_plan/new_plan/ROLE_PERMISSION_MATRIX.md** - Permission matrix
5. **docs_plan/old_plan/core_system_force_spec_v1_patch_v1.txt** - Capabilities & restrictions
6. **docs_plan/random/TECHNICIAN_COLLECTOR_FE_ALIGNMENT_PLAN.md** - Align technician & collector
7. **fe/docs/execution_v2/FE_EXECUTION_06.yaml** - Frontend execution plan
8. **BE/internal/validation/workflows/collector_workflow.go** - Workflow validator

### Temuan Kunci dari Dokumen

#### Apakah "collector" adalah role user, fitur, atau workflow?

**Jawaban:** Collector adalah **ROLE USER** yang memiliki **FITUR/WORKFLOW** khusus untuk penagihan cash.

- **Role:** `collector` adalah role tenant-scoped (bukan global)
- **Fitur:** Modul collector dengan 3-phase verification workflow
- **Workflow:** Proses penagihan cash melalui 3 fase (visit_success → deposited → confirmed)

#### Apakah collector bagian dari billing, atau modul terpisah?

**Jawaban:** Collector adalah **MODUL TERPISAH** yang **TERINTEGRASI** dengan billing.

- **Modul terpisah:** Ada struktur `internal/collector/`, `collector_assignments` table, dll
- **Integrasi erat:** Collector menggunakan invoice dari billing, update payment status
- **Design principle:** "Payments table is single source of truth for financial state"
- **Collector module drives payment phase transitions**

---

## 2️⃣ DEFINISI FUNGSI COLLECTOR

### Tugas Utama Collector

Berdasarkan dokumen, collector memiliki tugas utama:

1. **Menagih invoice cash** (bukan online payment)
2. **Mencatat kunjungan** (visit success/failed)
3. **Melaporkan setoran** (deposit report)
4. **TIDAK mencatat pembayaran langsung** (hanya finance yang bisa confirm)
5. **TIDAK input nominal** (amount dari invoice, bukan manual input)

### Objek yang Diakses Collector

#### ✅ BOLEH Diakses:

1. **Invoice**
   - Hanya invoice yang di-assign ke collector tersebut
   - Invoice dengan payment method = `cash` atau `collector`
   - Status: unpaid, visit_success, deposited (belum confirmed)

2. **Client**
   - Hanya client yang di-assign ke collector
   - Bisa lihat: name, address, phone, map location
   - Bisa lihat: package info, amount due

3. **Assignment (Collector Task)**
   - `collector_assignments` table
   - Status: assigned, visit_success, deposited, confirmed, failed
   - Scheduled date

4. **Map Location**
   - Client location (lat/lng) untuk navigasi
   - TIDAK bisa lihat ODC/ODP (hanya client markers)

#### ❌ TIDAK BOLEH Diakses:

1. **Semua client** (hanya assigned clients)
2. **Invoice lain** (hanya assigned invoices)
3. **Payment records** (hanya finance/admin yang bisa)
4. **Network/ODC/ODP** (hanya technician)
5. **HR/Employee data**
6. **Financial reports** (hanya summary sendiri)

### Aksi yang BOLEH Dilakukan Collector

#### ✅ BOLEH:

1. **View**
   - ✅ List assigned clients
   - ✅ Detail assigned invoice
   - ✅ Client contact & location
   - ✅ Package & amount due
   - ✅ Own collection history

2. **Create/Update**
   - ✅ Mark visit success (Phase 1)
   - ✅ Mark visit failed
   - ✅ Report deposit (Phase 2)
   - ✅ Attach photo/note untuk visit
   - ✅ View own collection activities

3. **Status Updates**
   - ✅ Update assignment status: `assigned` → `visit_success` → `deposited`
   - ✅ TIDAK bisa update ke `confirmed` (hanya finance)

### Aksi yang TIDAK BOLEH Dilakukan Collector

#### ❌ DILARANG:

1. **Financial Operations**
   - ❌ Mark invoice as PAID (hanya finance)
   - ❌ Edit invoice amount (immutable)
   - ❌ Input nominal payment (amount dari invoice)
   - ❌ Confirm deposit (hanya finance)

2. **Data Management**
   - ❌ Create/edit/delete invoice
   - ❌ Create/edit/delete client
   - ❌ Access other collectors' assignments
   - ❌ Manage network/HR/finance

3. **Approval**
   - ❌ Approve/reject anything
   - ❌ Confirm financial transactions

---

## 3️⃣ ROLE & PERMISSION

### Apakah collector adalah role baru?

**Jawaban:** Ya, `collector` adalah **ROLE BARU** yang terpisah dari role lain.

- **Role code:** `collector`
- **Role name:** "Collector" / "Payment collector for cash-based billing"
- **Scope:** Tenant-scoped (bukan global)

### Hubungan dengan Role Lain

#### Collector vs Technician

**Status saat ini:**
- **MVP:** 1 role per user (tidak bisa multi-role)
- **Dokumen menyebut:** "Technician may have multiple roles; system supports role composition (e.g., technician + collector)"
- **Gap:** Spec lama menyebut technician bisa multifungsi collector, tapi MVP belum support multi-role

**Opsi yang disebutkan:**
1. Buat role custom `technician_collector` (gabungan permission)
2. Upgrade model ke multi-role/switch (future)

**Catatan dari FE plan:**
- "Asumsi: Semua Technician = Collector (sementara)" - ini untuk FE alignment, bukan backend
- Technician bisa akses collector menus (via `RoleGuard` logic)

#### Collector vs Admin vs Finance

**Permission Matrix (dari ROLE_PERMISSION_MATRIX.md):**

| Role | Permissions (Seed) |
|------|-------------------|
| `collector` | `["collector:*","client:read","billing:collect"]` |
| `admin` | `["user:read","user:create","user:update","network:*","maps:*","client:*","wa:read","wa:send","report:read"]` + (target: `["user:*","network:*","client:*","maps:*","hr:*","billing:*","collector:read","wa:*","report:*","addon:*"]`) |
| `finance` | `["billing:*","collector:read","report:finance","client:read"]` |
| `owner` | `["tenant:*","user:*","billing:*","network:*","maps:*","hr:*","collector:*","technician:*","client:*","wa:*","addon:*","report:*"]` |

**Perbandingan:**

| Capability | Collector | Admin | Finance | Owner |
|------------|-----------|-------|---------|-------|
| View assigned clients | ✅ | ✅ | ✅ | ✅ |
| View all clients | ❌ | ✅ | ✅ | ✅ |
| View collector assignments | ✅ (own only) | ✅ (all) | ✅ (all) | ✅ (all) |
| Mark visit success | ✅ | ❌ | ❌ | ✅ |
| Report deposit | ✅ | ❌ | ❌ | ✅ |
| Confirm deposit | ❌ | ❌ | ✅ | ✅ |
| Mark invoice paid | ❌ | ✅ | ✅ | ✅ |
| Create invoice | ❌ | ✅ | ✅ | ✅ |
| Manage clients | ❌ | ✅ | ✅ | ✅ |

### Capabilities (dari RBAC code)

**Dari `BE/internal/rbac/capabilities.go`:**
- `CapCollectorView` = `"collector.view"`
- `CapCollectorManage` = `"collector.manage"`

**Dari `BE/internal/rbac/role_capability_map.go`:**
- `RoleCollector` memiliki: `CapCollectorView`, `CapCollectorManage`, `CapBillingCollect`
- `RoleFinance` memiliki: `CapCollectorView` (read-only)
- `RoleOwner` memiliki: `CapCollectorView`, `CapCollectorManage`

---

## 4️⃣ ALUR KERJA (WORKFLOW)

### 3-Phase Cash Collection Workflow

Berdasarkan `EXECUTION_08.yaml` dan `EXECUTION_08_1.yaml`:

#### **Phase 1: Visit Success**
- **Actor:** Collector
- **Action:**
  - Mark invoice visit success
  - Update assignment status: `assigned` → `visit_success`
  - Update payment: `collector_id` set, `collected_at` = now(), `status` = pending
- **Rules:**
  - ❌ TIDAK mark invoice as PAID
  - ✅ Hanya bisa mark visit success untuk assigned invoice
  - ✅ Bisa attach photo/note
- **Status di assignment:** `visit_success`
- **Status di payment:** `pending` (belum paid)

#### **Phase 2: Deposit Report**
- **Actor:** Collector
- **Action:**
  - Mark invoice deposited
  - Confirm cash handover
  - Update assignment status: `visit_success` → `deposited`
  - Update payment: `deposited_at` = now()
- **Rules:**
  - ❌ TIDAK input amount (amount dari invoice)
  - ✅ Hanya bisa report deposit untuk visit_success
- **Status di assignment:** `deposited`
- **Status di payment:** `pending` (masih belum paid)

#### **Phase 3: Finance Confirm**
- **Actor:** Finance (atau Admin/Owner)
- **Action:**
  - Confirm deposit
  - Mark invoice paid
  - Update assignment status: `deposited` → `confirmed`
  - Update payment: `confirmed_at` = now(), `status` = success
  - Update invoice: `status` = paid, `paid_at` = now()
- **Rules:**
  - ✅ Hanya finance/admin/owner yang bisa confirm
  - ✅ Payment baru marked success setelah phase 3
- **Status di assignment:** `confirmed`
- **Status di payment:** `success`
- **Status di invoice:** `paid`

### Alur Normal (Step-by-Step)

```
1. Invoice dibuat (dari billing)
   └─ Status: unpaid
   └─ Payment method: cash/collector

2. Assignment dibuat (otomatis atau manual)
   └─ Trigger: Daily cron (invoice due_date < now(), payment.method = cash)
   └─ Atau: Admin/Owner/Finance assign manual
   └─ Status: assigned
   └─ Collector melihat di dashboard

3. Collector visit client
   └─ Collector buka assignment detail
   └─ Lihat client address, phone, map location
   └─ Navigate ke lokasi (optional: GPS/route optimization)

4. Collector input visit result
   └─ Jika berhasil: Mark "Visit Success" (Phase 1)
      └─ Assignment status: visit_success
      └─ Payment: collector_id set, collected_at = now(), status = pending
      └─ Invoice: TIDAK berubah (masih unpaid)
   └─ Jika gagal: Mark "Visit Failed"
      └─ Assignment status: failed
      └─ Bisa reschedule next day

5. Collector report deposit (setoran)
   └─ Setelah visit success, collector setor uang ke admin/finance
   └─ Mark "Deposit Reported" (Phase 2)
   └─ Assignment status: deposited
   └─ Payment: deposited_at = now()
   └─ Invoice: TIDAK berubah (masih unpaid)

6. Finance confirm deposit
   └─ Finance verifikasi setoran dari collector
   └─ Mark "Deposit Confirmed" (Phase 3)
   └─ Assignment status: confirmed
   └─ Payment: confirmed_at = now(), status = success
   └─ Invoice: status = paid, paid_at = now()

7. Invoice lunas
   └─ Invoice status: paid
   └─ Payment status: success
   └─ Assignment status: confirmed
```

### Pertanyaan Workflow

#### Apakah collector butuh approval?

**Jawaban:** TIDAK, collector TIDAK butuh approval untuk aksinya.

- Collector bisa langsung mark visit success (Phase 1)
- Collector bisa langsung report deposit (Phase 2)
- Yang butuh approval: Finance confirm (Phase 3) - tapi ini bukan approval collector, tapi verifikasi setoran

#### Apakah collector bisa menagih partial?

**Jawaban:** BELUM JELAS dari dokumen.

- **Dokumen menyebut:** "Invoice defines amount" - amount immutable
- **Tidak ada spesifikasi:** Partial payment handling
- **Asumsi:** Collector hanya bisa collect full amount (karena tidak bisa input nominal)
- **Pertanyaan terbuka:** Bagaimana jika client bayar partial? Apakah perlu multiple payments?

#### Online / offline payment?

**Jawaban:** Collector untuk **CASH PAYMENT** (offline).

- Payment method: `cash` atau `collector`
- Online payment (bank_transfer, e_wallet, qris, virtual_account) TIDAK melalui collector
- Collector workflow khusus untuk cash collection di lapangan

---

## 5️⃣ UI / UX IMPLICATION (High-level)

### Apakah collector butuh dashboard sendiri?

**Jawaban:** YA, berdasarkan `FE_EXECUTION_06.yaml`.

**Dashboard Collector:**
- Today's assignments overview
- Collection progress summary
- Route optimization suggestions
- Weather information (optional)
- Quick actions
- Performance metrics summary
- Offline mode indicator
- Sync status display
- Mobile-optimized layout

### Fitur UI yang Dibutuhkan

#### 1. Dashboard Collector
- **Route:** `/collector` atau `/technician/collector` (jika technician = collector)
- **Widgets:**
  - Today assignments count
  - Completed vs pending
  - Total collected amount (after finance confirm)
  - Route map dengan client markers

#### 2. List Invoice Assigned
- **Route:** `/collector/assignments`
- **Features:**
  - Filter by date (default: today)
  - Filter by status (assigned, visit_success, deposited, confirmed, failed)
  - Sort by: scheduled_date, client name, amount
  - Search: client name, invoice number
- **Mobile:** Card-based layout, swipe actions

#### 3. Map / Route
- **Route:** `/collector/routes`
- **Features:**
  - Show assigned clients di map
  - Route optimization (suggested order)
  - GPS navigation integration
  - Client markers dengan status color
- **Restriction:** Collector hanya lihat client markers (TIDAK ODC/ODP)

#### 4. History Penagihan
- **Route:** `/collector/history` atau `/collector/activities`
- **Features:**
  - List semua assignments (completed & pending)
  - Filter by date range
  - Show: client, invoice, amount, status, visit date, deposit date
  - Performance metrics: total collected, success rate

#### 5. Assignment Detail
- **Route:** `/collector/assignments/[id]`
- **Features:**
  - Client info: name, address, phone, map location
  - Invoice info: number, amount, due date
  - Package info: service plan, monthly fee
  - Actions: Mark visit success, Report deposit
  - Photo upload (optional)
  - Notes field

#### 6. Collection Workflow UI
- **Phase indicators:** Visual progress (Phase 1 → Phase 2 → Phase 3)
- **Status badges:** Color-coded (assigned, visit_success, deposited, confirmed, failed)
- **Action buttons:** 
  - "Mark Visit Success" (Phase 1)
  - "Report Deposit" (Phase 2)
  - "View Details" (all phases)
- **Finance view:** "Confirm Deposit" button (Phase 3)

### Mobile Optimization

**Dari `FE_EXECUTION_06.yaml`:**
- Mobile-first design
- Touch-optimized controls (min 44x44px)
- Offline mode support
- GPS location tracking
- Photo capture functionality
- One-hand usable interface

---

## 6️⃣ INTEGRASI DENGAN MODUL EKSISTING

### Modul yang Terkait

#### 1. **Billing** (Paling Dekat)
- **Relationship:** Collector menggunakan invoice dari billing
- **Integration points:**
  - Invoice: collector read assigned invoices
  - Payment: collector actions update payment status
  - Invoice status: unpaid → visit_success → deposited → confirmed → paid
- **Design principle:** "Payments table is single source of truth"
- **Collector module drives payment phase transitions**

#### 2. **Clients**
- **Relationship:** Collector hanya lihat assigned clients
- **Integration points:**
  - Client list: filtered by collector assignment
  - Client detail: collector bisa lihat full detail (untuk penagihan)
  - Client location: untuk map/navigation
- **Restriction:** Collector TIDAK bisa create/edit/delete client

#### 3. **Technician / Tasks**
- **Relationship:** Technician bisa multifungsi collector (future)
- **Integration points:**
  - Technician bisa akses collector menus (via RoleGuard)
  - Technician bisa lihat assigned clients (jika juga collector)
- **Note:** MVP belum support multi-role, jadi perlu role custom atau upgrade

#### 4. **Maps**
- **Relationship:** Collector butuh map untuk navigasi
- **Integration points:**
  - Client location markers
  - Route optimization
  - GPS tracking
- **Restriction:** Collector TIDAK bisa lihat ODC/ODP (hanya client)

#### 5. **Wallet / Payment**
- **Relationship:** Payment table adalah single source of truth
- **Integration points:**
  - Payment method: `cash` atau `collector`
  - Payment status: pending → success (via 3-phase)
  - Payment fields: `collector_id`, `collected_at`, `deposited_at`, `confirmed_at`
- **Design:** Collector actions update payment, tapi tidak create payment langsung

### Modul Mana yang Paling Dekat?

**Jawaban:** **BILLING** adalah modul yang paling dekat dengan collector.

- Collector adalah extension dari billing untuk cash payment
- Collector workflow adalah bagian dari payment lifecycle
- Collector tidak bisa exist tanpa billing (prerequisite)

### Apakah collector hanya "view + action" di billing?

**Jawaban:** TIDAK, collector lebih dari sekedar "view + action" di billing.

- Collector punya modul sendiri (`internal/collector/`)
- Collector punya table sendiri (`collector_assignments`, `collector_activities`)
- Collector punya workflow sendiri (3-phase verification)
- Collector punya dashboard/UI sendiri
- **Tapi:** Collector sangat dependent pada billing untuk invoice data

---

## 7️⃣ RINGKASAN FUNGSI COLLECTOR

### Fungsi Utama (1-2 Paragraf)

**Collector** adalah role user khusus untuk penagihan cash di lapangan. Collector bertugas mengunjungi client yang memiliki invoice unpaid dengan payment method cash, mencatat hasil kunjungan (visit success/failed), dan melaporkan setoran uang yang telah dikumpulkan. Collector TIDAK bisa menandai invoice sebagai paid atau input nominal payment secara manual - semua amount berasal dari invoice yang sudah dibuat oleh admin/finance.

Collector bekerja melalui **3-phase verification workflow** untuk memastikan akuntabilitas keuangan: (1) Collector mark visit success setelah client bayar di tempat, (2) Collector report deposit setelah setor uang ke admin/finance, (3) Finance confirm deposit dan mark invoice as paid. Collector hanya bisa melihat dan mengelola client/invoice yang di-assign kepadanya, tidak bisa akses semua data. Modul collector terintegrasi erat dengan billing (menggunakan invoice) dan payment (update payment status), tapi memiliki struktur dan workflow sendiri.

### Daftar Tanggung Jawab Collector

1. ✅ Melihat daftar client yang di-assign untuk penagihan
2. ✅ Melihat detail invoice yang perlu ditagih (amount, due date, client info)
3. ✅ Mengunjungi client di lapangan (dengan bantuan map/navigation)
4. ✅ Mencatat hasil kunjungan (visit success atau failed)
5. ✅ Melaporkan setoran uang yang telah dikumpulkan
6. ✅ Melihat history penagihan sendiri
7. ✅ Melihat performance metrics sendiri (total collected, success rate)
8. ❌ TIDAK menandai invoice sebagai paid (hanya finance)
9. ❌ TIDAK input nominal payment (amount dari invoice)
10. ❌ TIDAK akses client/invoice yang tidak di-assign

### Daftar Aksi yang Diizinkan & Dilarang

#### ✅ Diizinkan:
- View assigned clients & invoices
- Mark visit success (Phase 1)
- Mark visit failed
- Report deposit (Phase 2)
- Attach photo/note untuk visit
- View own collection history
- View client location di map
- Use route optimization (jika tersedia)

#### ❌ Dilarang:
- Mark invoice as PAID
- Edit invoice amount
- Input nominal payment manual
- Confirm deposit (hanya finance)
- Create/edit/delete invoice
- Create/edit/delete client
- Access other collectors' assignments
- Access all clients (hanya assigned)
- View ODC/ODP di map
- Manage network/HR/finance

### Workflow Penagihan (Step List)

1. **Invoice Creation** (Admin/Finance)
   - Invoice dibuat dengan payment method = cash/collector
   - Status: unpaid

2. **Assignment Creation** (Automatic atau Manual)
   - Automatic: Daily cron (invoice due_date < now(), payment.method = cash)
   - Manual: Admin/Owner/Finance assign invoice ke collector
   - Status: assigned

3. **Collector View Assignment**
   - Collector lihat di dashboard: today's assignments
   - Bisa lihat: client info, invoice amount, location

4. **Collector Visit Client** (Phase 1)
   - Collector navigate ke client location (map/GPS)
   - Client bayar cash di tempat
   - Collector mark "Visit Success"
   - Assignment status: visit_success
   - Payment: collector_id set, collected_at = now(), status = pending
   - Invoice: TIDAK berubah (masih unpaid)

5. **Collector Report Deposit** (Phase 2)
   - Collector setor uang ke admin/finance
   - Collector mark "Deposit Reported"
   - Assignment status: deposited
   - Payment: deposited_at = now()
   - Invoice: TIDAK berubah (masih unpaid)

6. **Finance Confirm Deposit** (Phase 3)
   - Finance verifikasi setoran
   - Finance mark "Deposit Confirmed"
   - Assignment status: confirmed
   - Payment: confirmed_at = now(), status = success
   - Invoice: status = paid, paid_at = now()

7. **Invoice Paid**
   - Invoice status: paid
   - Payment status: success
   - Assignment status: confirmed

### Daftar Pertanyaan Terbuka / Asumsi yang Belum Jelas

#### 1. Partial Payment
- **Pertanyaan:** Apakah collector bisa menagih partial payment?
- **Status:** BELUM JELAS
- **Dokumen menyebut:** "Invoice defines amount" - amount immutable
- **Asumsi:** Collector hanya bisa collect full amount
- **Klarifikasi diperlukan:** Bagaimana jika client bayar partial? Apakah perlu multiple payments atau invoice adjustment?

#### 2. Multi-Role Technician-Collector
- **Pertanyaan:** Bagaimana implementasi technician yang juga collector?
- **Status:** BELUM JELAS (MVP 1 role per user)
- **Dokumen menyebut:** "Technician may have multiple roles" (spec lama)
- **Opsi:** Role custom `technician_collector` atau upgrade ke multi-role
- **Klarifikasi diperlukan:** Apakah perlu support multi-role di MVP atau cukup role custom?

#### 3. Assignment Creation Logic
- **Pertanyaan:** Bagaimana assignment dibuat untuk invoice yang sudah ada?
- **Status:** SUDAH JELAS (automatic via cron atau manual)
- **Klarifikasi:** Apakah perlu UI untuk admin assign manual? Atau cukup automatic saja?

#### 4. Failed Visit Handling
- **Pertanyaan:** Berapa kali collector bisa retry visit failed?
- **Status:** BELUM JELAS
- **Dokumen menyebut:** "allow_reschedule_next_day" (retry logic)
- **Klarifikasi diperlukan:** Apakah ada limit retry? Atau unlimited sampai visit success?

#### 5. Offline Mode
- **Pertanyaan:** Bagaimana sync data saat collector offline?
- **Status:** SUDAH DISEBUT (FE_EXECUTION_06.yaml: offline mode support)
- **Klarifikasi diperlukan:** Detail implementasi offline mode (local storage, sync strategy)

#### 6. Route Optimization
- **Pertanyaan:** Apakah route optimization wajib atau optional?
- **Status:** SUDAH DISEBUT (excluded dari scope: "advanced_route_optimization")
- **Klarifikasi:** Apakah basic route optimization (suggested order) sudah cukup?

#### 7. Photo/Note Upload
- **Pertanyaan:** Apakah photo/note upload wajib atau optional?
- **Status:** SUDAH DISEBUT (optional di beberapa dokumen)
- **Klarifikasi:** Apakah perlu validation (min 1 photo untuk visit success)?

#### 8. Notification
- **Pertanyaan:** Apakah collector dapat notifikasi untuk assignment baru?
- **Status:** SUDAH DISEBUT (notification_hooks: visit_success, deposit_submitted, finance_confirmed)
- **Klarifikasi:** Apakah collector juga dapat notifikasi untuk assignment baru? Atau hanya finance yang dapat notifikasi?

#### 9. Performance Metrics
- **Pertanyaan:** Metrics apa saja yang ditampilkan untuk collector?
- **Status:** SUDAH DISEBUT (total_assigned, total_visited, total_collected, total_pending)
- **Klarifikasi:** Apakah perlu metrics tambahan (success rate, average collection time, dll)?

#### 10. GPS Tracking
- **Pertanyaan:** Apakah GPS tracking wajib atau optional?
- **Status:** SUDAH DISEBUT (gps_checkin excluded dari scope)
- **Klarifikasi:** Apakah collector perlu check-in GPS saat visit? Atau hanya untuk navigation?

---

## 8️⃣ KESIMPULAN

### Status Implementasi

- **Backend:** Spesifikasi sudah jelas (EXECUTION_08, EXECUTION_08_1)
- **Frontend:** Spesifikasi sudah jelas (FE_EXECUTION_06)
- **Database Schema:** Sudah didefinisikan (collector_assignments, collector_activities)
- **RBAC:** Sudah didefinisikan (role collector, permissions, capabilities)
- **Workflow:** Sudah didefinisikan (3-phase verification)

### Yang Sudah Jelas

✅ Collector adalah role user terpisah  
✅ Collector punya modul sendiri (terintegrasi dengan billing)  
✅ Collector workflow: 3-phase verification  
✅ Collector hanya akses assigned clients/invoices  
✅ Collector TIDAK bisa mark invoice paid (hanya finance)  
✅ Collector TIDAK bisa input nominal (amount dari invoice)  
✅ Collector butuh dashboard, assignment list, map, history  

### Yang Perlu Klarifikasi

❓ Partial payment handling  
❓ Multi-role technician-collector (MVP vs future)  
❓ Failed visit retry limit  
❓ Offline mode detail implementation  
❓ Photo/note upload validation  
❓ Notification untuk assignment baru  
❓ GPS check-in requirement  
❓ Performance metrics detail  

---

**Dokumen ini siap untuk digunakan sebagai referensi sebelum coding dimulai.**


