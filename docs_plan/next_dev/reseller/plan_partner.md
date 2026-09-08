# Partner System — Implementation Planning

## 1. Overview

Implementasi ini bertujuan memperluas sistem `Partner` pada platform SaaS billing/ERP untuk RT/RW Net.

Saat ini sistem sudah memiliki fitur reseller untuk voucher hotspot. Fitur tersebut tetap dipertahankan, tetapi konsep `Partner` akan diperluas menjadi beberapa jenis:

1. `VOUCHER_RESELLER`
2. `CLIENT_RESELLER`
3. `PRINTING`

Untuk tahap ini fokus implementasi adalah:

> **CLIENT_RESELLER**

`VOUCHER_RESELLER` yang sudah ada harus tetap berjalan.

`PRINTING` belum perlu diimplementasikan pada tahap ini dan akan menjadi modul berikutnya.

Konsep `AFFILIATE` adalah sistem terpisah dari `PARTNER` dan tidak termasuk scope implementasi ini.

---

# 2. Core Domain Concept

## 2.1 Partner

`Partner` adalah pihak eksternal yang bekerja sama dengan tenant.

Partner dapat memiliki satu atau lebih tipe/capability:

```text
PARTNER
├── VOUCHER_RESELLER
├── CLIENT_RESELLER
└── PRINTING
```

Role/domain utama tetap:

```text
PARTNER
```

Jangan membuat role BE baru seperti:

```text
CLIENT_RESELLER_ROLE
VOUCHER_RESELLER_ROLE
PRINTING_ROLE
```

Jenis pekerjaan Partner harus dipisahkan sebagai `Partner Type` / `Partner Capability`, bukan role utama.

---

# 3. Terminology / Display Label

Istilah yang digunakan di UI tidak boleh di-hardcode sebagai `Partner`.

Karena aplikasi bersifat multi-tenant, setiap tenant dapat menentukan terminology sendiri.

Contoh:

```text
Tenant A → Partner
Tenant B → Reseller
Tenant C → Mitra
Tenant D → Agen
```

Namun terminology hanya memengaruhi presentation/UI.

Domain dan database tetap menggunakan istilah:

```text
Partner
```

Contoh:

```text
partner_id
partner_type
partner_commission
partner_assignment
```

Bukan:

```text
reseller_id
mitra_id
agen_id
```

Jika sistem terminology/configuration sudah tersedia, gunakan mekanisme tersebut.

Jika belum tersedia, implementasikan configuration yang dapat dikembangkan untuk terminology lain di masa depan.

---

# 4. Partner Types

## 4.1 Voucher Reseller

Sudah tersedia pada sistem.

Scope perubahan:

* Jangan merusak behavior existing.
* Pertahankan fitur reseller voucher.
* Jika struktur existing perlu disesuaikan agar kompatibel dengan konsep `Partner`, lakukan migration/refactor secara backward-compatible.
* Jangan mengubah business rule voucher reseller kecuali memang diperlukan untuk integrasi dengan Partner.

---

## 4.2 Client Reseller

Client Reseller adalah Partner yang:

* mendapatkan client baru;
* menjadi Partner aktif untuk client tersebut;
* bertanggung jawab sebagai PIC lapangan;
* melakukan follow-up terhadap client;
* dapat melaporkan kondisi infrastruktur/jalur kabel;
* mendapatkan recurring commission berdasarkan client yang membayar.

Client Reseller bukan employee.

Hubungan:

```text
Tenant
  │
  └── Partner
        │
        └── Client
```

---

## 4.3 Printing

Printing merupakan Partner Type berikutnya, tetapi:

> **BELUM MASUK SCOPE IMPLEMENTASI SAAT INI.**

Jangan implementasikan:

* printing order;
* printing agent panel;
* printer management;
* HVS inventory;
* printing commission;
* printing verification.

Namun struktur `Partner Type` harus dibuat cukup extensible sehingga `PRINTING` dapat ditambahkan di masa depan tanpa mengubah fundamental architecture.

---

# 5. Client ↔ Partner Assignment

Aturan utama:

> **Satu client hanya boleh memiliki satu Partner aktif pada satu waktu.**

Contoh valid:

```text
Client A
  └── Partner Budi (ACTIVE)
```

Tidak boleh:

```text
Client A
  ├── Partner Budi (ACTIVE)
  └── Partner Andi (ACTIVE)
```

Historical assignment tetap boleh disimpan.

Contoh:

```text
Client A
├── Partner Budi
│   └── ended_at: 2026-08-01
│
└── Partner Andi
    └── started_at: 2026-08-02
```

Sehingga sistem dapat mengetahui siapa Partner yang pernah menangani client tersebut.

---

# 6. Client Reseller Commission

## 6.1 Commission Model

Client Reseller menggunakan recurring commission.

Komisi dihitung berdasarkan client yang memenuhi eligibility pada periode tertentu.

Contoh:

```text
Commission Rate:
Rp10.000 / client / month
```

Jika Partner memiliki:

```text
50 eligible clients
```

maka:

```text
50 × Rp10.000
= Rp500.000
```

---

# 7. Payment Dependency

Komisi **tidak otomatis diberikan hanya karena client aktif**.

Rule utama:

> **Client harus membayar tagihan agar commission pada periode tersebut menjadi eligible/generated.**

Jika client belum membayar:

```text
Client
  ↓
Invoice
  ↓
UNPAID / OVERDUE
  ↓
Commission = HELD / NOT ELIGIBLE YET
```

Ketika client akhirnya membayar:

```text
Client
  ↓
Payment successful
  ↓
Commission eligibility fulfilled
  ↓
Commission generated
```

Jangan membuat commission final sebelum kondisi payment terpenuhi.

---

# 8. Commission Activation Rule

Periode mulai berlakunya recurring commission harus configurable per tenant.

Contoh konfigurasi:

```text
commission_activation_period = 1 month
```

Tetapi tenant lain dapat menggunakan:

```text
0 month
1 month
2 month
3 month
```

atau aturan lain sesuai kemampuan configuration system.

Jangan hard-code:

```text
commission starts after 1 month
```

Business logic harus membaca konfigurasi tenant.

---

# 9. Commission Rule

Minimal konsep rule yang perlu didukung:

```text
Partner Type:
CLIENT_RESELLER

Commission Basis:
PER_CLIENT

Commission Amount:
Rp10.000

Activation Rule:
tenant-configurable

Payment Requirement:
CLIENT_PAYMENT_REQUIRED
```

Contoh:

```text
Client A
Activated: August 2026

Tenant Rule:
Commission starts after 1 month

August:
Not eligible

September:
Eligible if required invoice/payment condition is fulfilled
```

---

# 10. Commission Ledger

Jangan menyimpan total commission Partner hanya sebagai angka agregat.

Gunakan transaction/ledger concept.

Contoh:

```text
Commission Ledger
-------------------------
Partner: Budi
Client: Client A
Period: August 2026
Type: CLIENT_RESELLER
Amount: Rp10.000
Status: HELD
```

Setelah payment terpenuhi:

```text
Commission Ledger
-------------------------
Partner: Budi
Client: Client A
Period: August 2026
Type: CLIENT_RESELLER
Amount: Rp10.000
Status: GENERATED
```

Kemudian setelah dibayarkan:

```text
Status:
PAID
```

Status exact naming dapat mengikuti convention existing project.

Minimal lifecycle harus dapat membedakan:

```text
HELD / PENDING
GENERATED / EARNED
PAID
```

Jangan menghapus historical commission.

---

# 11. Recommended Commission Lifecycle

Secara konsep:

```text
Client assigned to Partner
        ↓
Activation rule evaluated
        ↓
Commission period becomes eligible
        ↓
Check client payment
        │
        ├── Not paid
        │      ↓
        │    HELD
        │
        └── Paid
               ↓
          Commission GENERATED
               ↓
          Payout processing
               ↓
              PAID
```

Jika client membayar setelah overdue, sistem harus dapat menghasilkan commission berdasarkan rule yang berlaku.

Jangan membuat commission hilang hanya karena pembayaran terlambat.

---

# 12. Client Reseller Responsibilities

Client Reseller memiliki dua fungsi utama:

## 12.1 Client Acquisition

Partner dapat membawa client baru.

Flow:

```text
Partner
  ↓
Acquire client
  ↓
Client registered
  ↓
Client becomes active
  ↓
Client assigned to Partner
```

Assignment harus tercatat secara eksplisit.

---

## 12.2 Field Responsibility

Partner menjadi PIC lapangan untuk client yang di-assign kepadanya.

Contoh aktivitas:

### Payment Follow-up

Jika client overdue:

```text
System
  ↓
Detect overdue
  ↓
Partner notified / task created
  ↓
Partner contacts client
  ↓
Partner records follow-up result
```

Partner dapat:

* menanyakan alasan keterlambatan;
* melakukan penagihan jika client meminta kunjungan;
* mencatat hasil follow-up.

Detail task/activity system dapat mengikuti existing architecture.

---

## 12.3 Infrastructure Observation

Partner dapat melaporkan kondisi lapangan yang berpotensi menyebabkan gangguan.

Contoh:

```text
Pohon akan ditebang
        ↓
Berpotensi mengenai jalur kabel
        ↓
Partner membuat report
        ↓
Technical Team menerima report
        ↓
Technical Team melakukan tindakan preventif
```

Partner bukan technical team.

Partner hanya berperan sebagai:

> field observer / local representative.

Technical execution tetap menjadi tanggung jawab role/team teknis.

---

# 13. Client Reseller UI

Gunakan UI reseller/partner yang sudah tersedia jika memungkinkan.

Tidak perlu membuat panel role baru untuk Client Reseller.

Existing Partner/Reseller UI harus diperluas dengan capability:

```text
Client Reseller
```

Contoh informasi yang dapat ditampilkan:

```text
Partner
----------------------------
Name: Budi
Type:
  ✓ Voucher Reseller
  ✓ Client Reseller

Managed Clients: 47

Current Commission:
Rp470.000

Pending Commission:
Rp80.000
```

UI harus menggunakan tenant terminology untuk label `Partner`.

---

# 14. Client Assignment UI

Admin/tenant operator harus dapat:

* assign client ke Partner;
* melihat Partner aktif client;
* mengganti Partner;
* melihat historical Partner;
* mencegah dua Partner aktif untuk client yang sama.

Contoh:

```text
Client A

Current Partner:
Budi

Assignment History:
- Andi
  Jan 2026 - Apr 2026

- Budi
  Apr 2026 - Present
```

Saat melakukan reassignment:

```text
Old Partner
    ↓
Assignment ended

New Partner
    ↓
Assignment started
```

Jangan overwrite historical assignment jika audit/history diperlukan.

---

# 15. Partner Dashboard

Jika dashboard Partner sudah tersedia, extend dashboard tersebut.

Minimal informasi Client Reseller:

```text
Total Clients
Active Clients
Overdue Clients
Commission This Period
Pending Commission
Paid Commission
```

Optional:

```text
Recent Payment Follow-ups
Recent Infrastructure Reports
```

Jangan membuat dashboard baru jika existing Partner/Reseller dashboard dapat diperluas.

---

# 16. Tenant Configuration

Tenant harus dapat mengatur rule Client Reseller.

Minimal:

```text
Client Reseller Commission
----------------------------
Commission amount
Activation period
Payment requirement
```

Contoh:

```text
Amount:
Rp10.000 / client

Activation:
1 month

Payment requirement:
Client must have paid
```

Jika sistem configuration sudah memiliki pola existing, gunakan pola tersebut daripada membuat configuration mechanism baru.

---

# 17. Important Business Constraints

## Constraint 1 — One Active Partner

```text
1 Client = max 1 active Client Reseller
```

Historical Partner tetap diperbolehkan.

---

## Constraint 2 — Payment Required

```text
No client payment
    ≠
Commission generated
```

---

## Constraint 3 — Tenant-specific Rule

Commission activation tidak boleh hard-coded.

---

## Constraint 4 — Historical Data

Commission dan Partner assignment yang sudah terjadi tidak boleh hilang ketika:

* Partner dinonaktifkan;
* Partner diganti;
* client berhenti;
* commission rule berubah.

---

## Constraint 5 — Tenant Isolation

Semua Partner, Client Assignment, Commission, dan configuration harus tetap scoped ke tenant.

Tidak boleh ada cross-tenant access.

---

# 18. Commission Rule Changes

Perubahan commission rule di masa depan tidak boleh secara otomatis mengubah historical commission.

Contoh:

```text
January:
Rp10.000 / client

February:
Rp15.000 / client
```

Commission January tetap:

```text
Rp10.000
```

Commission February menggunakan:

```text
Rp15.000
```

Jika existing architecture mendukung versioning/effective date, gunakan mekanisme tersebut.

---

# 19. Partner Deactivation

Jika Partner dinonaktifkan:

* jangan hapus historical assignment;
* jangan hapus historical commission;
* jangan menghapus payout history;
* jangan menghapus activity history.

Client yang sebelumnya dimiliki Partner tersebut dapat:

```text
remain unassigned
```

atau

```text
reassigned to another Partner
```

sesuai action admin.

Jangan otomatis menghapus client.

---

# 20. Client Deactivation

Jika client berhenti/tidak aktif:

```text
Client inactive
    ↓
No future recurring commission
```

Historical commission tetap dipertahankan.

---

# 21. Affiliate Separation

`AFFILIATE` adalah domain/program terpisah.

Jangan membuat:

```text
AFFILIATE = PARTNER
```

dan jangan memasukkan affiliate sebagai `Partner Type`.

Struktur konseptual:

```text
PARTNER
├── VOUCHER_RESELLER
├── CLIENT_RESELLER
└── PRINTING


AFFILIATE
└── Referral / Acquisition
```

Affiliate saat ini sudah tersedia di sisi tenant dan dapat diperluas ke client tenant pada fase berikutnya.

Implementasi Client Reseller tidak boleh bergantung pada Affiliate.

---

# 22. Future Printing Partner

Printing akan menggunakan:

```text
PARTNER
└── PRINTING
```

tetapi belum diimplementasikan sekarang.

Future scope kemungkinan meliputi:

* Printing Agent panel;
* Printer information;
* HVS supply;
* Printing order;
* Voucher print job;
* Print verification;
* Per-sheet/per-unit commission;
* Printing payout.

Architecture Client Reseller saat ini harus tidak menghambat implementasi tersebut.

---

# 23. Avoid Overengineering

Untuk fase ini:

DO:

* gunakan existing Partner/Reseller infrastructure;
* extend existing UI;
* tambahkan Client Reseller capability;
* buat assignment model;
* buat commission rule;
* buat commission ledger jika belum tersedia;
* gunakan tenant configuration;
* preserve existing voucher reseller behavior.

DON'T:

* membuat role baru untuk Client Reseller;
* membuat role baru untuk Printing;
* membuat Affiliate menjadi Partner;
* membuat Printing module sekarang;
* membuat employee management;
* membuat HR/payroll;
* menganggap Partner sebagai employee;
* hard-code terminology;
* hard-code activation period;
* overwrite historical assignment;
* overwrite historical commission.

---

# 24. Suggested Domain Structure

Gunakan naming convention project yang sudah ada, tetapi secara konseptual struktur harus mendukung:

```text
Partner
├── id
├── tenant_id
├── user/client reference
├── status
└── ...

PartnerType / PartnerCapability
├── VOUCHER_RESELLER
├── CLIENT_RESELLER
└── PRINTING

ClientPartnerAssignment
├── id
├── tenant_id
├── client_id
├── partner_id
├── started_at
├── ended_at
└── status

CommissionRule
├── tenant_id
├── partner_type
├── amount
├── activation_rule
├── payment_requirement
└── effective period

CommissionLedger
├── id
├── tenant_id
├── partner_id
├── client_id
├── period
├── commission_type
├── amount
├── status
└── timestamps
```

Nama field final harus mengikuti convention existing codebase.

Jangan membuat duplicate entity jika equivalent entity sudah tersedia.

---

# 25. Implementation Strategy

AI coder harus terlebih dahulu melakukan codebase discovery.

Sebelum mengubah kode:

1. Cari existing Partner/Reseller entity.
2. Cari existing role/permission system.
3. Cari existing voucher reseller implementation.
4. Cari existing commission implementation.
5. Cari existing payout/payment implementation.
6. Cari existing client/customer entity.
7. Cari existing tenant configuration mechanism.
8. Cari existing terminology/i18n mechanism.
9. Cari existing assignment/history pattern.
10. Cari existing notification/task/activity system.

Setelah discovery:

> **Reuse existing infrastructure wherever possible.**

Jangan membuat abstraction baru jika codebase sudah memiliki abstraction yang memenuhi kebutuhan.

---

# 26. Migration Safety

Jika existing reseller voucher memiliki data production:

* jangan merusak existing reseller;
* jangan kehilangan existing voucher commission;
* jangan menghapus existing relationship;
* migration harus backward-compatible;
* existing records harus tetap dapat dibaca.

Jika diperlukan migrasi:

```text
Existing Reseller
       ↓
Partner
       ↓
Partner Type = VOUCHER_RESELLER
```

Pastikan seluruh existing data tetap memiliki referensi yang valid.

---

# 27. Acceptance Criteria

Implementation dianggap selesai jika:

### Partner

* [ ] Existing reseller tetap berfungsi.
* [ ] Partner role dapat digunakan.
* [ ] Partner Type dapat membedakan Voucher Reseller dan Client Reseller.
* [ ] Printing dapat ditambahkan di masa depan tanpa redesign role.

### Client Assignment

* [ ] Client dapat di-assign ke Client Reseller.
* [ ] Satu client tidak dapat memiliki lebih dari satu active Partner.
* [ ] Reassignment menyimpan history.
* [ ] Historical assignment tidak hilang.

### Commission

* [ ] Commission rule dapat dikonfigurasi per tenant.
* [ ] Activation period tidak hard-coded.
* [ ] Payment requirement diterapkan.
* [ ] Client yang belum membayar tidak menghasilkan commission yang payable.
* [ ] Client yang membayar setelah overdue dapat memenuhi commission eligibility sesuai rule.
* [ ] Historical commission tidak berubah ketika rule berubah.
* [ ] Commission dapat dilacak per Partner dan per Client.
* [ ] Commission dapat dibedakan berdasarkan period.
* [ ] Commission memiliki lifecycle/status yang jelas.

### Client Responsibility

* [ ] Partner dapat melihat client yang menjadi tanggung jawabnya.
* [ ] Overdue client dapat diidentifikasi.
* [ ] Partner dapat melakukan/record payment follow-up jika activity system mendukung.
* [ ] Partner dapat membuat infrastructure report jika reporting system tersedia/dibutuhkan.
* [ ] Technical team tetap menjadi executor untuk pekerjaan teknis.

### Tenant

* [ ] Semua data scoped berdasarkan tenant.
* [ ] Terminology Partner dapat dikustomisasi.
* [ ] UI menggunakan terminology tenant.
* [ ] Domain/database tetap menggunakan stable technical naming.

### Affiliate

* [ ] Affiliate tidak tercampur dengan Partner.
* [ ] Existing Affiliate functionality tidak rusak.
* [ ] Client Affiliate tetap menjadi future extension dan tidak menjadi dependency Client Reseller.

---

# 28. Final Architecture Principle

Gunakan prinsip berikut sebagai pedoman utama implementasi:

```text
ROLE
  ↓
WHO IS THIS?
  → PARTNER

PARTNER TYPE / CAPABILITY
  ↓
WHAT DOES THE PARTNER DO?
  → VOUCHER_RESELLER
  → CLIENT_RESELLER
  → PRINTING

ASSIGNMENT
  ↓
WHO IS RESPONSIBLE FOR WHICH CLIENT?
  → Client ↔ Partner

COMMISSION RULE
  ↓
WHEN AND HOW MUCH DOES PARTNER EARN?

COMMISSION LEDGER
  ↓
WHAT WAS ACTUALLY EARNED?

PAYOUT
  ↓
WHEN WAS THE COMMISSION PAID?

TERMINOLOGY
  ↓
WHAT DOES THIS TENANT CALL THE PARTNER?
  → Partner / Reseller / Mitra / Agen / etc.

AFFILIATE
  ↓
SEPARATE ACQUISITION / REFERRAL PROGRAM
```

The implementation should prioritize **domain stability, tenant configurability, historical integrity, and reuse of existing codebase patterns** over introducing new abstractions unnecessarily.
