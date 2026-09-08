# Advanced Finance & Tax Module — Future Roadmap

> **STATUS: RESEARCH / FUTURE ROADMAP**
>
> Dokumen ini **belum menjadi implementation plan**.
>
> Tujuan dokumen ini adalah mendefinisikan arah pengembangan Advanced Finance & Tax agar arsitektur aplikasi sejak awal tidak menghambat kebutuhan finance dan tax di masa depan.
>
> Implementasi aktual hanya dilakukan setelah kebutuhan tenant tervalidasi dan business rules sudah cukup jelas.

---

# 1. Overview

Platform ERP ini ditujukan untuk berbagai jenis pengusaha RT/RW Net, mulai dari:

* Pengusaha perorangan
* CV
* PT kecil hingga menengah
* Model bisnis RT/RW Net dengan skema kerja sama yang berbeda

Kebutuhan finance dan tax setiap tenant dapat berbeda.

Karena itu sistem harus:

* fleksibel;
* configurable;
* tidak mengasumsikan seluruh tenant memiliki kewajiban pajak yang sama;
* tidak menghardcode tarif pajak;
* tidak menghardcode business scheme;
* mampu berkembang berdasarkan kebutuhan tenant.

Advanced Finance & Tax merupakan pengembangan jangka panjang yang akan dibangun setelah kebutuhan nyata tenant telah tervalidasi.

---

# 2. Product Strategy

Prinsip utama:

> **Jangan membangun tax engine berdasarkan asumsi developer.**

Kebutuhan pajak dapat berbeda berdasarkan:

* bentuk badan usaha;
* status PKP;
* jenis transaksi;
* jenis pelanggan;
* jenis vendor;
* skema kerja sama dengan ISP;
* model revenue sharing;
* perlakuan pajak berdasarkan transaksi;
* periode dan aturan yang berlaku.

Karena itu Advanced Tax harus dibangun berdasarkan:

```text
Tenant Need
    ↓
Research
    ↓
Business Rule Validation
    ↓
Configuration Design
    ↓
Implementation
```

Bukan:

```text
Developer Assumption
    ↓
Hardcoded Tax Logic
```

---

# 3. Design Principles

## 3.1 Business First

Finance dan Tax harus mengikuti model bisnis tenant.

Contoh:

```text
Business Scheme
      ↓
Transaction Model
      ↓
Revenue / Expense
      ↓
Tax Treatment
      ↓
Accounting
```

Bukan sebaliknya.

---

## 3.2 Tax Second

Tax merupakan konfigurasi dan treatment terhadap transaksi.

ERP tidak boleh secara otomatis menyimpulkan kewajiban pajak tenant tanpa rule/configuration yang jelas.

Sistem harus lebih banyak berperan sebagai:

* recorder;
* calculator;
* aggregator;
* reporter.

Bukan sebagai pengganti konsultan pajak.

---

## 3.3 Accounting Third

Accounting harus dapat menggunakan hasil transaksi dan tax sebagai sumber data.

Target arsitektur:

```text
Business Transaction
        ↓
Finance Transaction
        ↓
Tax Calculation
        ↓
Tax Ledger
        ↓
Accounting Journal
```

Namun implementasi accounting automation dilakukan secara bertahap.

---

# 4. Business Scheme

Sistem harus mendukung minimal:

## Reseller

```text
ISP
 ↓
RT/RW Net
 ↓
Customer
```

RT/RW Net membeli layanan/bandwidth dari ISP kemudian menjual kembali kepada customer.

---

## Revenue Sharing

```text
ISP
 ↓
Operational Cooperation
 ↓
RT/RW Net
 ↓
Customer
```

Dalam model ini perlakuan revenue dan expense dapat berbeda berdasarkan isi perjanjian/PKS.

Sistem tidak boleh mengasumsikan bahwa seluruh revenue sharing memiliki perlakuan accounting dan tax yang sama.

---

## Hybrid

Tenant dapat menggunakan kombinasi beberapa business scheme.

Contoh:

```text
ISP A
→ Reseller

ISP B
→ Revenue Sharing
```

---

# 5. Tenant Configuration

Advanced Finance harus memiliki configuration layer yang scoped per tenant.

Contoh:

```text
Tenant
│
├── Business Scheme
│
├── Tax Profile
│
├── Tax Configuration
│
├── Accounting Configuration
│
└── Finance Configuration
```

Semua configuration harus tenant-specific.

Jangan membuat global business rule yang menganggap semua tenant memiliki konfigurasi yang sama.

---

# 6. Tax Profile

Tax Profile menggambarkan konfigurasi dasar perpajakan tenant.

Contoh data:

```text
Tax Profile
├── PKP Status
├── Tax Identification Information
├── Default Tax Configuration
├── Tax Reporting Period
└── Other tenant-specific tax settings
```

Status dan field final harus ditentukan berdasarkan kebutuhan tenant dan validasi domain sebelum implementation.

---

# 7. Tax Master

Tax Master menyimpan definisi pajak yang dapat digunakan sistem.

Minimal konsep:

```text
Tax
├── Name
├── Code
├── Tax Type
├── Rate
├── Status
├── Effective Date
└── Expired Date
```

Contoh tipe:

```text
ADD_TAX
WITHHOLDING_TAX
FINAL_TAX
```

Namun daftar final Tax Type **jangan dianggap final** sebelum dilakukan research dan validasi kebutuhan tenant.

---

# 8. No Hardcoded Tax Rate

Tax rate tidak boleh di-hardcode di business logic.

Contoh yang harus dihindari:

```text
PPN = 11%
```

Sebagai gantinya:

```text
Tax Configuration
    ↓
Tax Rate
    ↓
Effective Date
    ↓
Transaction Calculation
```

Hal ini penting karena tarif dan perlakuan pajak dapat berubah.

Historical transaction harus tetap menggunakan tax configuration yang berlaku pada saat transaksi.

---

# 9. Effective Dating

Tax configuration harus mendukung periode berlaku.

Contoh:

```text
Tax Rule A
Effective:
2026-01-01
Expired:
2026-12-31

Tax Rule B
Effective:
2027-01-01
```

Ketika transaksi terjadi, sistem harus dapat menentukan configuration yang berlaku berdasarkan tanggal transaksi.

Jangan mengubah historical transaction hanya karena tax configuration saat ini berubah.

---

# 10. Transaction Tax

Satu transaction dapat memiliki lebih dari satu tax treatment.

Contoh konseptual:

```text
Invoice
│
├── Subtotal
│
├── PPN
│
├── Withholding Tax
│
└── Other Tax / Charge
```

Sistem harus memiliki struktur yang memungkinkan multiple tax pada satu transaction.

Namun jenis tax yang benar-benar digunakan tetap bergantung pada configuration tenant.

---

# 11. Tax Calculation

Tax Calculation bertugas menghitung tax berdasarkan:

* transaction;
* tax configuration;
* applicable rate;
* effective date;
* taxable amount;
* configured tax treatment.

Tax Calculation tidak boleh menjadi mesin yang secara otomatis menentukan kewajiban hukum tenant tanpa konfigurasi/rule.

Secara konseptual:

```text
Transaction
    ↓
Applicable Tax Configuration
    ↓
Taxable Base
    ↓
Tax Rate
    ↓
Tax Amount
```

---

# 12. Tax Ledger

Tax transaction tidak boleh hanya disimpan sebagai angka di invoice.

Advanced system membutuhkan konsep Tax Ledger.

Contoh:

```text
Tax Ledger
│
├── Tax Type
├── Transaction
├── Tax Period
├── Tax Amount
├── Direction / Nature
├── Status
└── Reference
```

Tujuan:

* audit;
* reconciliation;
* reporting;
* tax position calculation;
* accounting integration.

Historical tax data harus immutable atau memiliki mekanisme adjustment yang jelas.

---

# 13. Tax Position

Sistem perlu memiliki konsep Tax Position untuk menjawab:

> "Berdasarkan transaksi yang tercatat dan konfigurasi tenant, posisi pajak tenant pada periode tertentu adalah berapa?"

Contoh konseptual:

```text
Tax Period
     ↓
Tax Transactions
     ↓
Tax Ledger
     ↓
Tax Position
```

Tax Position bukan sekadar total seluruh tax transaction.

Perhitungan final harus mengikuti jenis pajak dan business rule yang relevan.

---

# 14. Tax Liability / Tax Payable

Advanced Finance harus dapat membedakan:

* tax yang tercatat;
* tax yang dihitung;
* tax yang menjadi liability;
* tax yang sudah dibayar;
* tax yang masih outstanding.

Contoh konsep:

```text
Tax Calculation
      ↓
Tax Liability
      ↓
Tax Payment
      ↓
Outstanding Balance
```

Jangan menyamakan:

```text
Tax Amount
=
Tax Payable
```

karena pada beberapa jenis pajak dapat terdapat mekanisme lain seperti:

* credit;
* adjustment;
* offset;
* reversal;
* payment;
* carry-forward;

sesuai business rule yang nantinya divalidasi.

---

# 15. Tax Period

Sistem harus mendukung Tax Period.

Contoh:

```text
August 2026
September 2026
October 2026
```

Setiap Tax Period dapat memiliki lifecycle.

Contoh:

```text
OPEN
CLOSED
```

Tax period diperlukan untuk:

* reporting;
* reconciliation;
* tax payable;
* tax payment;
* historical audit.

Detail closing/reopening mechanism ditentukan pada fase implementation setelah kebutuhan tenant tervalidasi.

---

# 16. Tax Reporting

Advanced Finance harus menyediakan Tax Reporting.

Tujuan utamanya:

> Memberikan gambaran kepada tenant mengenai tax yang tercatat, tax position, dan estimasi/current liability berdasarkan data transaksi dan konfigurasi yang digunakan.

Minimal arah laporan:

### Tax Summary

```text
Tax Period
August 2026

Tax Type A
Amount: ...

Tax Type B
Amount: ...

Tax Type C
Amount: ...
```

### Tax Payable

```text
Tax Period
August 2026

Tax Type
Outstanding
Paid
Payable
```

### Tax by Type

```text
PPN
PPh
Other Tax
```

Namun format laporan final **belum dikunci**.

Format harus ditentukan setelah kebutuhan tenant dan kebutuhan reporting nyata tervalidasi.

---

# 17. Tax Payment Tracking

Future system harus dapat mencatat pembayaran tax.

Contoh:

```text
Tax Liability
      ↓
Tax Payment
      ↓
Paid Amount
      ↓
Remaining Liability
```

Payment history harus tetap tersimpan untuk audit.

Tax payment tidak boleh menghapus tax liability.

---

# 18. Tax Reconciliation

Future feature:

```text
Transaction
      ↓
Tax Ledger
      ↓
Tax Report
      ↓
Tax Payment
```

Finance dapat melakukan reconciliation antara:

* transaction;
* tax ledger;
* tax payable;
* payment;
* accounting journal.

Tujuannya adalah menemukan discrepancy.

---

# 19. Tax Adjustment

Sistem harus disiapkan untuk kemungkinan:

* correction;
* reversal;
* adjustment;
* refund;
* void;
* transaction amendment.

Jangan mengubah historical tax transaction secara destructive.

Jika historical transaction harus diperbaiki, gunakan adjustment/reversal mechanism sesuai accounting design yang akan ditentukan kemudian.

---

# 20. Accounting Integration

Advanced Tax harus dapat menjadi sumber accounting entry.

Konseptual flow:

```text
Business Transaction
       ↓
Finance
       ↓
Tax Calculation
       ↓
Tax Ledger
       ↓
Accounting Journal
```

Contoh:

```text
Invoice
   ↓
Revenue
   ↓
Tax
   ↓
Receivable
```

Detail journal rule belum dikunci.

Accounting automation akan dikembangkan setelah business dan tax requirements cukup jelas.

---

# 21. Finance Module Structure

Target jangka panjang:

```text
Finance
│
├── Income
├── Expense
├── Invoice
├── Payment
├── Bank Account
├── Payroll
│
├── Tax
│   ├── Tax Profile
│   ├── Tax Master
│   ├── Tax Configuration
│   ├── Tax Calculation
│   ├── Tax Ledger
│   ├── Tax Position
│   ├── Tax Payable
│   ├── Tax Payment
│   └── Tax Reports
│
└── Accounting
    ├── Journal
    ├── Ledger
    ├── Account
    └── Reports
```

---

# 22. Role & Tier

Advanced Finance & Tax merupakan fitur premium.

Target availability:

```text
FREE / BASIC
    ↓
Basic Finance

BUSINESS
    ↓
Advanced Finance
    ↓
Tax Configuration
    ↓
Tax Reporting

ENTERPRISE
    ↓
Advanced Finance
    ↓
Advanced Tax
    ↓
Accounting Automation
    ↓
Future Compliance Features
```

Exact feature gating harus mengikuti sistem subscription/tier existing.

Jangan membuat authorization logic terpisah jika existing subscription/feature entitlement system sudah tersedia.

---

# 23. Finance Role

Advanced Tax merupakan bagian dari Finance.

Tidak perlu membuat role khusus:

```text
TAX_ADMIN
```

kecuali kebutuhan nyata tenant di masa depan memang mengharuskannya.

Struktur yang diharapkan:

```text
Finance Role
   ↓
Finance
   ├── Basic Finance
   ├── Tax
   └── Accounting
```

Access control dapat dibagi berdasarkan permission jika dibutuhkan.

---

# 24. Business Scheme Integration

Business Scheme harus dapat memengaruhi finance configuration.

Contoh:

```text
Business Scheme
      ↓
Transaction Model
      ↓
Revenue Recognition
      ↓
Tax Treatment
      ↓
Accounting
```

Namun Business Scheme tidak boleh secara otomatis menentukan tax obligation.

Business Scheme hanya menjadi context.

Tax treatment tetap membutuhkan configuration/rule yang valid.

---

# 25. Revenue Sharing

Revenue Sharing membutuhkan perhatian khusus.

Sistem tidak boleh menganggap:

```text
Customer Payment
=
Full Revenue RT/RW Net
```

atau:

```text
Customer Payment
=
Full Revenue ISP
```

Perlakuan revenue dapat bergantung pada PKS.

Future Settlement Engine harus memungkinkan konfigurasi:

```text
Customer Revenue
      ↓
Settlement Rule
      ↓
ISP Share
      ↓
Tenant Share
```

Detail implementation ditunda.

---

# 26. Partner ISP

Tenant dapat memiliki informasi Partner ISP.

Minimal future data:

```text
ISP
├── Name
├── Agreement / PKS Number
├── Agreement Date
├── Tax Profile
└── Business Scheme
```

Informasi ISP digunakan sebagai context untuk finance configuration.

Sistem tidak boleh mengasumsikan status pajak ISP tanpa data/configuration yang valid.

---

# 27. Auditability

Advanced Finance harus memiliki audit trail.

Perubahan terhadap:

* Tax configuration;
* Tax rate;
* Tax rule;
* Tax profile;
* Tax period;
* Tax adjustment;
* Tax payment;
* Commission/finance related data;

harus dapat ditelusuri jika feature tersebut sudah tersedia pada infrastructure platform.

Minimal informasi yang diharapkan:

```text
Who
What
When
Before
After
Reason
```

---

# 28. Historical Integrity

Historical finance dan tax data harus tetap konsisten ketika configuration berubah.

Contoh:

```text
2026
Tax Rate A

2027
Tax Rate B
```

Historical transaction tahun 2026 tidak boleh dihitung ulang menggunakan Tax Rate B hanya karena configuration saat ini sudah berubah.

---

# 29. Configuration vs Rule Engine

Advanced version nantinya dapat berkembang menjadi dua layer:

```text
Configuration
    ↓
Simple explicit settings
```

dan:

```text
Rule Engine
    ↓
Conditional tax/business logic
```

Contoh rule engine future:

```text
IF
  transaction.type = X
AND
  tenant.tax_profile = Y
THEN
  apply_tax = Z
```

Namun Rule Engine **bukan bagian implementation tahap awal**.

Jangan membangun generic rule engine hanya untuk memenuhi roadmap ini jika belum ada kebutuhan nyata.

---

# 30. Compliance Boundary

ERP bukan pengganti:

* konsultan pajak;
* akuntan;
* otoritas pajak;
* legal advisor.

ERP menyediakan:

```text
Recorded Data
+
Configured Rules
+
Calculated Results
+
Reports
```

Tenant tetap bertanggung jawab memastikan konfigurasi dan kewajiban pajaknya benar.

Jika nantinya terdapat fitur compliance, scope harus didefinisikan secara terpisah dan divalidasi secara khusus.

---

# 31. Research Requirements Before Implementation

Sebelum Advanced Tax diimplementasikan, lakukan research terhadap tenant.

Minimal cari tahu:

* bentuk badan usaha;
* status PKP;
* jenis transaksi;
* jenis pelanggan;
* model billing;
* model revenue;
* model ISP;
* jenis tax yang benar-benar digunakan;
* bagaimana tenant menghitung tax saat ini;
* bagaimana tenant membuat laporan;
* kapan tax dibayar;
* siapa yang melakukan reporting;
* kebutuhan konsultan pajak;
* dokumen/report yang benar-benar diperlukan.

Jangan menganggap kebutuhan satu tenant berlaku untuk semua tenant.

---

# 32. Tenant Feedback Loop

Advanced Tax harus dikembangkan berdasarkan feedback.

Flow:

```text
Tenant Problem
      ↓
Interview / Feedback
      ↓
Requirement
      ↓
Validation
      ↓
Architecture
      ↓
Implementation
      ↓
Pilot Tenant
      ↓
Feedback
      ↓
Iteration
```

Jika suatu feature hanya dibutuhkan oleh satu tenant dan sangat spesifik, pertimbangkan apakah feature tersebut:

* configurable;
* optional;
* enterprise-only;
* atau sebaiknya tidak dimasukkan ke core product.

---

# 33. Versioning Strategy

Advanced Tax tidak perlu langsung dibuat lengkap.

Recommended progression:

```text
V1
Basic PPN / Simple Tax Support
```

↓

```text
V2
Tax Configuration
Tax Ledger
Tax Reporting
```

↓

```text
V3
Multiple Tax
Tax Position
Tax Payable
Tax Payment
```

↓

```text
V4
Accounting Integration
Settlement
```

↓

```text
V5
Advanced Rule Engine
Automation
Compliance Support
```

Versi final dapat berubah berdasarkan feedback tenant.

---

# 34. Future Roadmap

Potential future features:

* Advanced Tax Engine
* Tax Rule Engine
* Tax Position
* Tax Payable
* Tax Payment Tracking
* Tax Reconciliation
* Tax Adjustment
* Advanced Tax Reporting
* Settlement Engine
* ISP Integration
* Revenue Sharing Automation
* Accounting Automation
* Advanced Payroll Tax
* Compliance-oriented Reporting

Semua fitur tersebut bersifat future roadmap dan tidak otomatis menjadi commitment implementation.

---

# 35. Non-Goals

Advanced Tax tidak bertujuan:

* menentukan kewajiban pajak secara otomatis tanpa configuration;
* menggantikan konsultan pajak;
* menjamin compliance hukum;
* menghardcode seluruh tarif pajak;
* memaksakan satu business scheme;
* memaksakan satu model revenue sharing;
* membuat generic rule engine sebelum diperlukan;
* membuat seluruh fitur accounting sekaligus;
* membuat seluruh jenis tax pada versi pertama.

---

# 36. Final Architecture Principle

Gunakan prinsip berikut sebagai dasar pengembangan:

```text
BUSINESS
   ↓
BUSINESS SCHEME
   ↓
FINANCE TRANSACTION
   ↓
TAX CONFIGURATION
   ↓
TAX CALCULATION
   ↓
TAX LEDGER
   ↓
TAX POSITION / LIABILITY
   ↓
TAX REPORT
   ↓
TAX PAYMENT
   ↓
ACCOUNTING
```

Namun tidak semua tenant harus menggunakan seluruh flow.

Configuration dan feature availability harus tetap tenant-aware.

---

# 37. Final Product Direction

Advanced Finance & Tax harus dibangun sebagai:

> **Flexible Finance & Tax Infrastructure for RT/RW Net**

bukan:

> **Hardcoded Indonesian Tax Calculator.**

Prioritas utama:

1. Fleksibilitas
2. Historical integrity
3. Tenant configuration
4. Auditability
5. Extensibility
6. Simplicity where possible

Advanced Tax akan tetap berada dalam status **Research / Future Roadmap** sampai kebutuhan tenant cukup tervalidasi.

Implementation detail hanya boleh dikunci setelah requirement nyata diperoleh dari tenant dan business/tax rules telah dipahami dengan baik.
