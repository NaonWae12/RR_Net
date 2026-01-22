# 🔍 Analisis: Fitur Penyetoran Collector dengan QR Confirmation

## 📋 Executive Summary

**Tujuan:** Menentukan struktur dan flow fitur penyetoran collector dengan QR-based confirmation untuk admin dan collector.

**Konteks Bisnis:**
- Collector mengumpulkan uang dari client
- Collector TIDAK langsung setor ke finance
- Collector harus konfirmasi setoran ke ADMIN via QR Code
- QR dibuat oleh ADMIN, expire 1 jam, dikirim ke collector

---

## 1️⃣ ANALISIS HALAMAN BILLING EXISTING

### Data yang Sudah Ada di Billing

**Invoices:**
- Invoice status: draft, pending, paid, overdue, cancelled
- Invoice amount, due date, paid amount
- Client information
- Invoice number

**Payments:**
- Payment records dengan method: cash, bank_transfer, e_wallet, qris, virtual_account, **collector**
- Payment amount, reference, received_at
- Payment linked ke invoice
- Collector ID (optional field)

**Summary:**
- Total invoices, pending, overdue, paid
- Total revenue, pending amount, overdue amount
- Collected this month

**User Access:**
- Roles: owner, admin, finance, **collector** (sudah ada di RoleGuard)
- Collector bisa akses Billing page tapi dengan visibility terbatas

### Fungsi Billing Saat Ini

**Fokus Utama:**
- ✅ **Client Payment Management** - fokus ke invoice dan payment dari client
- ✅ **Payment Recording** - record payment dengan berbagai method termasuk collector
- ✅ **Financial Summary** - overview revenue dan outstanding
- ✅ **Payment History** - tracking semua payment records

**Kekuatan:**
- ✅ Payment method "collector" sudah ada di enum
- ✅ Payment form sudah support collector_id field
- ✅ Payment table sudah track collector payments
- ✅ Billing = single source of truth untuk financial state

**Keterbatasan:**
- ❌ Tidak ada flow khusus untuk **collector settlement verification**
- ❌ Tidak ada QR generation/verification mechanism
- ❌ Tidak ada admin confirmation workflow untuk collector deposits
- ❌ Tidak ada separation antara "collector collected" vs "collector deposited to admin"
- ❌ Payment recording masih manual, tidak ada operational verification layer

**Kesimpulan:**
Billing saat ini fokus ke **client payment tracking**, belum menyentuh **operational payment handling** untuk collector settlement verification.

---

## 2️⃣ KECOCOKAN FITUR PENYETORAN COLLECTOR

### Analisis Mental Model Admin

**Billing = Financial Records**
- Admin melihat Billing sebagai tempat untuk:
  - Lihat invoice client
  - Record payment dari client
  - Track outstanding
  - Financial summary

**Collector Settlement = Operational Verification**
- Admin perlu:
  - Generate QR untuk collector
  - Verify setoran collector
  - Track setoran per collector
  - Reconcile setoran dengan payment records

**Mental Model Separation:**
- Billing = "Uang masuk dari client"
- Collector Settlement = "Verifikasi collector sudah setor ke admin"

### Risiko UX Clutter

**Jika dimasukkan ke Billing:**
- ❌ Billing page jadi terlalu kompleks
- ❌ Mix antara financial records dan operational verification
- ❌ Tab structure jadi crowded (sudah ada: invoices, payments, subscription, settings)
- ❌ Mental model admin jadi bingung: "Ini bagian billing atau operasional?"

**Jika halaman terpisah:**
- ✅ Clear separation of concerns
- ✅ Billing tetap fokus ke financial records
- ✅ Collector Settlement fokus ke operational verification
- ✅ Scalable untuk fitur operasional lain (misalnya: daily reconciliation)

### Skalabilitas Fitur ke Depan

**Fitur operasional yang mungkin dibutuhkan:**
- Daily reconciliation per collector
- Setoran batch (multiple invoices sekaligus)
- Anomali detection (nominal tidak match)
- Reminder untuk setoran pending
- Summary harian per collector
- Audit trail untuk setoran

**Jika di Billing:**
- ❌ Billing jadi terlalu berat
- ❌ Sulit untuk extend fitur operasional

**Jika halaman terpisah:**
- ✅ Bisa extend dengan fitur operasional lain
- ✅ Billing tetap clean dan focused

### Rekomendasi Struktur

**✅ Halaman Terpisah: "Collector Settlement" atau "Settlement"**

**Alasan:**
1. **Mental Model:** Billing = financial records, Settlement = operational verification
2. **UX Clarity:** Tidak clutter Billing page dengan operational workflow
3. **Scalability:** Bisa extend dengan fitur operasional lain tanpa mengganggu Billing
4. **Separation of Concerns:** Financial tracking vs operational verification adalah 2 concern berbeda

**Struktur yang Direkomendasikan:**
```
/billing
  - Invoices (existing)
  - Payments (existing)
  - Subscription (existing)
  - Settings (existing)

/settlement (NEW)
  - Overview (summary per collector, pending settlements)
  - Generate QR (admin action)
  - Verify Settlement (admin action)
  - History (per collector, per date, per nominal)
```

**Alternative (jika harus di Billing):**
Jika harus di Billing karena constraint, maka:
- Tab baru: "Settlement" di Billing page
- Tapi ini kurang ideal karena mix concerns

---

## 3️⃣ FLOW ADMIN (DETAIL)

### Step-by-Step Flow Admin

#### A. Generate QR Penyetoran

**Trigger:**
- Admin klik "Generate QR" di Settlement page
- Atau dari collector assignment detail

**Input:**
- Collector ID (select dari dropdown)
- Settlement date (default: today)
- Optional: Invoice IDs (jika specific invoices)
- Optional: Expected amount (untuk verification)

**Process:**
1. System generate unique QR token
2. QR token expire dalam 1 jam
3. QR token single-use (setelah digunakan, tidak bisa dipakai lagi)
4. QR token linked ke:
   - Collector ID
   - Settlement date
   - Expected invoices (optional)
   - Expected amount (optional)
   - Admin user ID (who generated)

**Output:**
- QR Code image (downloadable)
- QR Code text (copy-able)
- QR expiration time
- Share options (WhatsApp, Email, Copy link)

**Aturan QR:**
- ✅ Expire time: 1 jam dari generation
- ✅ Single-use: setelah collector scan & submit, QR invalid
- ✅ Linked to collector: QR hanya valid untuk collector yang ditentukan
- ✅ Optional multi-use: bisa set untuk batch settlement (multiple invoices)

#### B. Verifikasi Setoran

**Entry Point:**
- Notification: "Collector X telah submit setoran"
- Settlement page: List pending verifications
- Payment detail: Link ke settlement verification

**Data yang Diverifikasi:**
- QR token (valid/invalid/expired)
- Collector ID (match dengan QR)
- Settlement date (match dengan QR)
- Submitted invoices (match dengan expected, jika ada)
- Submitted amount (match dengan expected, jika ada)
- Timestamp submission

**Aksi Admin:**

**1. Approve:**
- System create/update payment records
- Link payment ke invoices
- Mark settlement as verified
- Update collector assignment status
- Trigger notification ke collector: "Setoran Anda telah diverifikasi"

**2. Reject:**
- Reason required (dropdown atau text)
- Options:
  - QR expired
  - QR invalid
  - Amount mismatch
  - Invoice mismatch
  - Other (text input)
- Settlement status = rejected
- QR token tetap invalid (tidak bisa dipakai lagi)
- Trigger notification ke collector: "Setoran Anda ditolak: [reason]"

**3. Mark as Mismatch:**
- Untuk kasus amount tidak match tapi admin tetap approve
- Admin input actual amount
- System record discrepancy
- Settlement status = verified_with_discrepancy
- Flag untuk review (anomali detection)

**Verification Flow:**
```
Admin receives notification
  ↓
Admin opens Settlement page
  ↓
Admin sees pending verification list
  ↓
Admin clicks "Verify" on specific settlement
  ↓
Admin sees:
  - QR token info
  - Collector info
  - Submitted invoices
  - Submitted amount
  - Expected amount (if set)
  - Timestamp
  ↓
Admin chooses action:
  - Approve → Create payment records
  - Reject → Set reason, notify collector
  - Mark as Mismatch → Input actual amount, flag discrepancy
```

#### C. Histori Setoran

**Filter Options:**
- Per collector (dropdown select)
- Per tanggal (date range picker)
- Per nominal (min/max amount)
- Per status (pending, verified, rejected, mismatch)

**Display:**
- Table dengan columns:
  - Date
  - Collector name
  - Amount
  - Invoices count
  - Status
  - Verified by (admin name)
  - Verified at
  - Actions (view detail, re-verify)

**Detail View:**
- Settlement info (QR token, collector, date)
- Submitted invoices list
- Amount breakdown
- Verification history (who, when, action)
- Discrepancy notes (jika ada)

---

## 4️⃣ FLOW COLLECTOR (DETAIL)

### Entry Point

**Option 1: Dedicated Button**
- Button "Setorkan" di collector dashboard
- Atau di collector assignment detail page

**Option 2: Menu Item**
- Menu "Settlement" di sidebar (untuk collector role)
- Sub-menu: "Submit Settlement"

**Recommended:** Kombinasi keduanya
- Button "Setorkan" di assignment detail (contextual)
- Menu "Settlement" di sidebar (always accessible)

### Aksi Collector

#### 1. Scan QR via Camera

**Flow:**
```
Collector clicks "Setorkan"
  ↓
System request camera permission
  ↓
Collector scans QR code
  ↓
System decode QR token
  ↓
System validate QR:
  - Valid token?
  - Not expired?
  - Matches collector ID?
  - Not used before?
  ↓
If valid:
  - Show confirmation screen
  - Display: Settlement date, Expected invoices (if any)
  - Button "Confirm Settlement"
If invalid:
  - Show error message
  - Options: Retry scan, Upload image
```

**Error Handling:**
- QR expired → "QR code sudah expired. Silakan minta QR baru ke admin."
- QR invalid → "QR code tidak valid. Pastikan QR dari admin yang benar."
- QR already used → "QR code sudah digunakan. Silakan minta QR baru."
- QR not for this collector → "QR code tidak untuk collector Anda."
- Camera permission denied → "Akses kamera diperlukan. Silakan aktifkan di settings."

#### 2. Upload Image QR

**Flow:**
```
Collector clicks "Upload QR Image"
  ↓
System open file picker
  ↓
Collector select image file
  ↓
System process image:
  - Extract QR code from image
  - Decode QR token
  ↓
System validate QR (same as scan flow)
  ↓
If valid: Show confirmation screen
If invalid: Show error message
```

**Supported Formats:**
- JPEG, PNG
- Max file size: 5MB
- Image processing: Auto-rotate, auto-crop QR area

### Feedback Collector

#### Sukses
- ✅ Success message: "Setoran Anda telah dikirim. Menunggu verifikasi admin."
- ✅ Settlement ID (untuk tracking)
- ✅ Estimated verification time: "Biasanya diverifikasi dalam 1-2 jam"
- ✅ Button "Lihat Status" → redirect ke settlement detail

#### Expired QR
- ❌ Error message: "QR code sudah expired. Silakan minta QR baru ke admin."
- ✅ Button "Request New QR" → redirect ke request form (optional feature)

#### Invalid QR
- ❌ Error message: "QR code tidak valid. Pastikan QR dari admin yang benar."
- ✅ Button "Retry" → kembali ke scan/upload screen
- ℹ️ Help text: "Pastikan QR code jelas dan tidak terpotong"

### Data yang Dikirim

**Minimal Data (dari QR token):**
- QR token (unique identifier)
- Collector ID (from authenticated user)
- Submission timestamp

**Optional Data (jika QR include):**
- Settlement date (from QR)
- Expected invoice IDs (from QR, untuk validation)
- Expected amount (from QR, untuk validation)

**System Auto-collect:**
- Collector ID (from auth context)
- Submission timestamp (server-side)
- Device info (optional, untuk audit)

**Tidak Dikirim oleh Collector:**
- ❌ Nominal (dari invoice, bukan input collector)
- ❌ Invoice list (dari assignment, bukan input collector)
- ❌ Settlement date (dari QR, bukan input collector)

**Prinsip:**
- Collector hanya **confirm** settlement, tidak input data
- Data berasal dari:
  - QR token (settlement context)
  - Invoice assignments (what collector collected)
  - System calculation (amount dari invoices)

---

## 5️⃣ DATA & ENTITY YANG DIPERLUKAN

### Entity Baru

#### 1. `collector_settlement`

**Purpose:** Record settlement submission dari collector

**Fields:**
- `id` (uuid, PK)
- `tenant_id` (uuid, FK)
- `collector_id` (uuid, FK to users)
- `qr_token_id` (uuid, FK to qr_tokens)
- `settlement_date` (date)
- `status` (enum: pending, verified, rejected, verified_with_discrepancy)
- `submitted_amount` (numeric, calculated from invoices)
- `verified_amount` (numeric, nullable, admin input jika mismatch)
- `verified_by` (uuid, FK to users, nullable)
- `verified_at` (timestamp, nullable)
- `rejection_reason` (text, nullable)
- `notes` (text, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Relasi:**
- `collector_id` → `users.id` (collector)
- `qr_token_id` → `qr_tokens.id`
- `verified_by` → `users.id` (admin)
- `tenant_id` → `tenants.id`

#### 2. `qr_tokens`

**Purpose:** Store QR token untuk settlement verification

**Fields:**
- `id` (uuid, PK)
- `tenant_id` (uuid, FK)
- `token` (string, unique, indexed)
- `collector_id` (uuid, FK to users)
- `generated_by` (uuid, FK to users, admin)
- `settlement_date` (date)
- `expected_invoice_ids` (uuid[], nullable, array of invoice IDs)
- `expected_amount` (numeric, nullable)
- `expires_at` (timestamp)
- `used_at` (timestamp, nullable)
- `used_by_settlement_id` (uuid, FK to collector_settlement, nullable)
- `is_multi_use` (boolean, default: false)
- `max_uses` (integer, nullable, untuk multi-use)
- `current_uses` (integer, default: 0)
- `created_at` (timestamp)

**Relasi:**
- `collector_id` → `users.id` (collector)
- `generated_by` → `users.id` (admin)
- `used_by_settlement_id` → `collector_settlement.id`
- `tenant_id` → `tenants.id`

**Indexes:**
- `token` (unique)
- `collector_id`, `expires_at` (composite, untuk query active QR)
- `used_at` (untuk query unused QR)

#### 3. `settlement_invoices` (Junction Table)

**Purpose:** Link settlement ke invoices yang disetorkan

**Fields:**
- `id` (uuid, PK)
- `settlement_id` (uuid, FK to collector_settlement)
- `invoice_id` (uuid, FK to invoices)
- `amount` (numeric, dari invoice)
- `created_at` (timestamp)

**Relasi:**
- `settlement_id` → `collector_settlement.id`
- `invoice_id` → `invoices.id`

**Purpose:** 
- Track which invoices included in settlement
- Calculate settlement amount
- Link settlement ke payment records

#### 4. `settlement_verification_history` (Optional, untuk audit)

**Purpose:** Audit trail untuk verification actions

**Fields:**
- `id` (uuid, PK)
- `settlement_id` (uuid, FK)
- `action` (enum: approve, reject, mark_mismatch)
- `performed_by` (uuid, FK to users)
- `performed_at` (timestamp)
- `reason` (text, nullable)
- `previous_status` (enum)
- `new_status` (enum)
- `metadata` (jsonb, untuk additional data)

**Relasi:**
- `settlement_id` → `collector_settlement.id`
- `performed_by` → `users.id`

### Entity Extension

#### Extend `payments` table (jika belum ada)

**Fields yang mungkin perlu:**
- `settlement_id` (uuid, FK to collector_settlement, nullable)
- `settlement_verified_at` (timestamp, nullable)

**Purpose:**
- Link payment records ke settlement
- Track verification status

#### Extend `collector_assignments` (jika ada)

**Fields yang mungkin perlu:**
- `settlement_id` (uuid, FK to collector_settlement, nullable)
- `settlement_status` (enum: not_settled, settlement_pending, settlement_verified)

**Purpose:**
- Link assignment ke settlement
- Track settlement status per assignment

### Relasi Kasar

```
tenants
  ↓
collector_settlement (1:N)
  ├─→ users (collector_id)
  ├─→ users (verified_by)
  ├─→ qr_tokens
  └─→ settlement_invoices (1:N)
       └─→ invoices

qr_tokens
  ├─→ users (collector_id)
  ├─→ users (generated_by)
  └─→ collector_settlement (1:1, via used_by_settlement_id)

settlement_invoices
  ├─→ collector_settlement
  └─→ invoices

payments (extended)
  └─→ collector_settlement (optional)

collector_assignments (extended, if exists)
  └─→ collector_settlement (optional)
```

---

## 6️⃣ FITUR TAMBAHAN YANG RELEVAN

### 1. Deteksi Selisih Otomatis

**Purpose:** Flag settlement dengan amount mismatch

**Logic:**
- Compare `submitted_amount` vs `expected_amount` (jika ada)
- Compare `submitted_amount` vs sum of invoice amounts
- Threshold: > 5% difference atau > Rp 10.000

**UI:**
- Warning badge di settlement list
- Highlight di verification screen
- Auto-suggest "Mark as Mismatch" action

**Benefit:**
- Catch errors early
- Reduce manual checking

### 2. Reminder Admin untuk Setoran Pending

**Purpose:** Notify admin jika ada setoran pending > 2 jam

**Trigger:**
- Cron job setiap 1 jam
- Check: `settlement.status = 'pending'` AND `created_at < now() - 2 hours`

**Notification:**
- In-app notification
- Optional: Email/WhatsApp (jika configured)

**UI:**
- Badge count di Settlement page header
- List "Pending Verifications" di dashboard

**Benefit:**
- Prevent settlement backlog
- Improve response time

### 3. Summary Harian per Collector

**Purpose:** Quick overview collection performance

**Display:**
- Date picker (default: today)
- Table:
  - Collector name
  - Total assigned invoices
  - Total collected (visit_success)
  - Total settled (settlement verified)
  - Total pending settlement
  - Total amount collected
  - Total amount settled

**Filter:**
- Date range
- Specific collector
- Status filter

**Export:**
- CSV export untuk reporting

**Benefit:**
- Quick performance check
- Identify collectors yang perlu follow-up

### 4. Flag Anomali (Nominal Jauh dari Rata-rata)

**Purpose:** Detect unusual settlement patterns

**Logic:**
- Calculate average settlement amount per collector (last 30 days)
- Flag if current settlement:
  - > 150% of average (suspiciously high)
  - < 50% of average (suspiciously low)
  - Or manual threshold (admin configurable)

**UI:**
- Warning icon di settlement list
- Detail explanation: "Amount 200% higher than average"
- Require additional verification (admin must add note)

**Benefit:**
- Fraud detection
- Error detection
- Quality control

### 5. Batch Settlement (Multi-Invoice)

**Purpose:** Allow collector to settle multiple invoices sekaligus

**Flow:**
- Admin generate QR dengan `is_multi_use = true`
- QR bisa dipakai untuk multiple settlements
- Collector scan QR, select invoices dari assignment list
- System calculate total amount
- Submit settlement dengan multiple invoices

**Benefit:**
- Reduce QR generation overhead
- Faster settlement process
- Better for daily end-of-day settlement

### 6. Settlement Reconciliation Report

**Purpose:** Compare settlement vs actual payments

**Report:**
- Date range
- Per collector
- Columns:
  - Settlement amount
  - Payment records amount
  - Difference
  - Status (match/mismatch)

**Benefit:**
- Financial reconciliation
- Audit trail
- Identify discrepancies

---

## 📦 CATATAN UX RISK & EDGE CASE

### UX Risks

**1. QR Expiration Confusion**
- **Risk:** Collector tidak tahu QR expired sampai scan
- **Mitigation:** 
  - Show expiration time di QR image
  - Admin bisa set custom expiration (default 1 jam)
  - Clear error message: "QR expired, request new one"

**2. Multiple QR Generation**
- **Risk:** Admin generate multiple QR untuk collector yang sama
- **Mitigation:**
  - Show active QR list di admin screen
  - Warning: "Collector X already has active QR"
  - Option: Revoke old QR before generate new

**3. QR Sharing Security**
- **Risk:** QR bisa di-share ke collector lain
- **Mitigation:**
  - QR token include collector ID
  - System validate: QR collector ID must match authenticated collector
  - Error: "QR not for this collector"

**4. Offline Scenario**
- **Risk:** Collector tidak bisa scan jika offline
- **Mitigation:**
  - Support upload image (tidak perlu real-time)
  - Queue submission jika offline, sync when online

**5. Camera Permission**
- **Risk:** User deny camera permission
- **Mitigation:**
  - Clear permission request message
  - Fallback to upload image
  - Help text: "You can also upload QR image"

### Edge Cases

**1. QR Expired During Scan**
- **Scenario:** Collector scan QR, but QR expired between scan start and submission
- **Handling:** Validate expiration at submission time, not scan time
- **Error:** "QR expired. Please request new QR from admin."

**2. Collector Submit Multiple Times**
- **Scenario:** Collector submit same QR multiple times
- **Handling:** QR single-use, second submission rejected
- **Error:** "QR already used. Please request new QR."

**3. Admin Verify After QR Expired**
- **Scenario:** Settlement submitted, but admin verify after QR expired
- **Handling:** QR expiration only affects submission, not verification
- **Note:** Admin can still verify even if QR expired (submission was valid at time)

**4. Amount Mismatch dengan Multiple Invoices**
- **Scenario:** Collector submit settlement dengan invoices, but amount doesn't match
- **Handling:** 
  - Auto-calculate from invoices
  - If mismatch, flag for admin review
  - Admin can approve with discrepancy note

**5. Collector Tidak Ada Assignment**
- **Scenario:** Collector scan QR, but no invoices assigned for settlement date
- **Handling:**
  - Allow settlement with 0 invoices (empty settlement)
  - Or require at least 1 invoice
  - Admin configurable: "Allow empty settlement"

**6. Concurrent Verification**
- **Scenario:** Multiple admins verify same settlement
- **Handling:**
  - First verification wins
  - Second verification rejected: "Settlement already verified"
  - Show who verified and when

**7. QR Revocation**
- **Scenario:** Admin revoke QR after collector scan but before submission
- **Handling:**
  - Revoke invalidates QR immediately
  - Pending submission rejected
  - Error: "QR revoked. Please request new QR."

---

## 🎯 KESIMPULAN & REKOMENDASI

### Struktur Halaman

**✅ Rekomendasi: Halaman Terpisah `/settlement`**

**Alasan:**
1. Clear separation: Billing = financial, Settlement = operational
2. Scalable untuk fitur operasional lain
3. Tidak clutter Billing page
4. Mental model admin lebih jelas

### Flow Summary

**Admin:**
1. Generate QR → Share ke collector
2. Receive notification → Verify settlement
3. Approve/Reject/Mark Mismatch
4. View history & reports

**Collector:**
1. Receive QR dari admin
2. Click "Setorkan" → Scan/Upload QR
3. Confirm settlement
4. Wait for admin verification
5. Receive notification hasil

### Entity Summary

**New Entities:**
- `collector_settlement` (main settlement record)
- `qr_tokens` (QR token management)
- `settlement_invoices` (junction table)
- `settlement_verification_history` (audit trail)

**Extended Entities:**
- `payments` (link ke settlement)
- `collector_assignments` (link ke settlement, jika ada)

### Fitur Tambahan Prioritas

**High Priority:**
1. ✅ Deteksi selisih otomatis
2. ✅ Reminder admin untuk pending
3. ✅ Summary harian per collector

**Medium Priority:**
4. ⚠️ Flag anomali
5. ⚠️ Batch settlement

**Low Priority:**
6. ℹ️ Reconciliation report

---

**Analisis selesai. Siap untuk implementasi.**

