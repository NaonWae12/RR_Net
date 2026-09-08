# Finance — Simple PPN Implementation Plan

> **STATUS: READY FOR IMPLEMENTATION**
>
> Dokumen ini merupakan implementasi awal Finance & Tax yang berfokus pada kebutuhan PPN.
>
> Scope dibuat sederhana dan praktis agar dapat segera digunakan tenant, tetapi struktur data dan business logic tetap harus cukup fleksibel untuk dikembangkan menjadi Advanced Tax Module di masa depan.

---

# 1. Objective

Menambahkan dukungan PPN pada modul Finance sehingga tenant dapat:

* mengaktifkan/nonaktifkan penggunaan PPN;
* menentukan tarif PPN;
* menerapkan PPN pada transaksi yang relevan;
* melihat nominal PPN pada transaksi;
* menyimpan data PPN secara historis;
* melihat ringkasan PPN berdasarkan periode.

Fitur ini **belum bertujuan menjadi Tax Engine lengkap**.

---

# 2. Scope

## Included

* PPN Configuration
* PPN pada Invoice
* PPN Calculation
* PPN Transaction Record
* PPN Summary
* PPN Period Report sederhana
* Tenant-level configuration
* Historical tax rate preservation

## Not Included

* PPh
* Withholding Tax
* Final Tax
* Tax Rule Engine
* Automatic Tax Decision
* Advanced Tax Liability
* Tax Compliance
* Tax Filing
* Revenue Sharing Automation
* Advanced Accounting Automation
* Tax Reconciliation
* Complex Tax Adjustment

---

# 3. Product Philosophy

Versi ini mengikuti prinsip:

> **Simple now, extensible later.**

Jangan membuat sistem terlalu kompleks hanya karena Advanced Tax sudah direncanakan.

Namun jangan membuat implementation yang secara fundamental menghambat penambahan:

* PPh;
* withholding tax;
* multiple tax;
* tax ledger;
* tax reporting;
* accounting integration.

---

# 4. Feature Availability

PPN merupakan fitur Finance.

Jika sistem subscription/feature entitlement sudah tersedia, PPN dapat dibatasi berdasarkan tier sesuai product strategy.

Target:

```text id="wq0b1c"
Basic
→ Basic Finance

Business
→ Finance + PPN

Enterprise
→ Finance + PPN
```

Exact tier harus mengikuti konfigurasi subscription yang sudah ada.

Jangan membuat sistem authorization baru jika feature entitlement existing sudah dapat digunakan.

---

# 5. PPN Configuration

Tenant memiliki konfigurasi PPN.

Minimal:

```text id="db2s9m"
PPN Configuration
├── Enabled
├── Rate
└── Effective Date
```

Contoh:

```text id="l9x7tv"
PPN:
Enabled = true

Rate:
Configured by tenant

Effective Date:
2026-01-01
```

Jangan hard-code tarif PPN di source code.

---

# 6. Tenant Scope

PPN configuration harus selalu scoped ke tenant.

Contoh:

```text id="8x9zj1"
Tenant A
PPN = Enabled
Rate = X

Tenant B
PPN = Disabled
```

Tenant tidak boleh membaca atau menggunakan PPN configuration tenant lain.

---

# 7. Effective Date

PPN configuration harus memiliki effective date.

Tujuannya agar perubahan rate di masa depan tidak mengubah historical transaction.

Contoh:

```text id="4u4qyk"
2026-01-01
Rate A

2027-01-01
Rate B
```

Invoice tahun 2026 harus tetap menggunakan Rate A.

Invoice tahun 2027 menggunakan Rate B.

Jangan menghitung ulang historical invoice menggunakan configuration terbaru.

---

# 8. Invoice PPN

Invoice harus dapat memiliki PPN.

Contoh:

```text id="m2e2c9"
Invoice
-------------------------
Subtotal       Rp100.000
PPN             RpX
-------------------------
Total           RpY
```

Jika PPN disabled:

```text id="1c2fxv"
Invoice
-------------------------
Subtotal       Rp100.000
PPN                  Rp0
-------------------------
Total           Rp100.000
```

---

# 9. PPN Calculation

Basic calculation:

```text id="q0f8w4"
Taxable Amount × PPN Rate
=
PPN Amount
```

Contoh:

```text id="cv9q62"
Subtotal:
Rp100.000

PPN:
10%

PPN Amount:
Rp10.000

Grand Total:
Rp110.000
```

Rate harus berasal dari PPN configuration yang berlaku pada tanggal transaksi.

---

# 10. Taxable Amount

Untuk V1, gunakan taxable amount yang sederhana dan jelas.

Default:

```text id="5s9e5r"
PPN Base
=
Invoice Subtotal
```

Namun implementasi harus memisahkan:

```text id="s7q5v8"
subtotal
taxable_amount
tax_amount
grand_total
```

Jangan hanya menyimpan:

```text id="8s2cyx"
total
```

Pemisahan field ini penting untuk future tax expansion.

---

# 11. Invoice Tax Snapshot

Ketika invoice dibuat, simpan snapshot PPN yang digunakan.

Minimal:

```text id="4f5zqj"
Invoice
├── subtotal
├── taxable_amount
├── tax_type
├── tax_rate
├── tax_amount
└── total
```

Tujuan:

> Historical invoice tidak bergantung pada current PPN configuration.

Contoh:

```text id="h9x5d3"
Invoice August
Rate = 10%
Tax = Rp10.000
```

Jika tenant kemudian mengubah configuration:

```text id="g8k2pr"
Rate = 11%
```

Invoice August tetap:

```text id="5y8j9f"
Rate = 10%
Tax = Rp10.000
```

---

# 12. Payment

Payment tidak menghitung ulang PPN.

PPN berasal dari invoice/transaction yang sudah dibuat.

Flow:

```text id="2g5qvi"
Invoice
  ↓
PPN calculated
  ↓
Invoice finalized
  ↓
Payment
```

Payment hanya menyelesaikan kewajiban invoice.

Jangan membuat:

```text id="7r6h7v"
Payment
  ↓
Recalculate PPN
```

---

# 13. PPN Transaction Record

Setiap invoice yang memiliki PPN harus dapat ditelusuri.

Contoh:

```text id="w6qfbr"
Invoice #INV-001

Subtotal:
Rp100.000

Tax Type:
PPN

Tax Rate:
10%

Taxable Amount:
Rp100.000

Tax Amount:
Rp10.000
```

Tujuannya agar finance dapat mengetahui:

> transaksi mana yang menghasilkan PPN.

---

# 14. PPN Summary

Tambahkan summary sederhana berdasarkan periode.

Contoh:

```text id="5n1k1v"
PPN Summary
August 2026

Total Taxable Amount:
Rp100.000.000

Total PPN:
Rp10.000.000

Number of Invoices:
250
```

Summary harus dapat difilter berdasarkan:

* periode;
* tanggal;
* status invoice jika existing system sudah memilikinya.

---

# 15. PPN Period Report

Tambahkan report sederhana:

```text id="1r6jtc"
PPN Report
August 2026
----------------------------

Total Transaction:
250

Taxable Amount:
Rp100.000.000

PPN:
Rp10.000.000
```

Report ini merupakan:

> **informational report**

bukan tax compliance/filling report.

Jangan menggunakan wording yang menyatakan sistem menjamin nominal kewajiban pajak legal tenant.

---

# 16. PPN by Period

Minimal support:

```text id="rj6u0d"
Monthly
```

Contoh:

```text id="w2s2l9"
January 2026
February 2026
March 2026
...
August 2026
```

Gunakan tanggal transaksi/invoice sebagai dasar periode.

---

# 17. PPN Dashboard

Jika Finance dashboard sudah tersedia, tambahkan card sederhana:

```text id="1t8j4r"
PPN This Month

Rp10.000.000
```

Optional:

```text id="b1i1z3"
Taxable Amount
Rp100.000.000
```

Dan:

```text id="a4d4t8"
PPN Transactions
250
```

Jangan membuat dashboard baru jika existing Finance dashboard dapat diperluas.

---

# 18. Configuration UI

Tambahkan halaman/configuration section di Finance.

Contoh:

```text id="d1a0h8"
Finance
 └── Tax
      └── PPN
```

Isi:

```text id="8w7r2q"
[✓] Enable PPN

Rate:
[ 10 ] %

Effective Date:
[ 01/01/2026 ]
```

Gunakan terminology existing tenant jika platform sudah memiliki configurable terminology.

---

# 19. Invoice UI

Invoice harus menunjukkan PPN secara jelas.

Contoh:

```text id="a2j9v6"
Subtotal       Rp100.000
PPN 10%         Rp10.000
-------------------------
Total           Rp110.000
```

Jika PPN tidak diterapkan:

```text id="5k9c7x"
Subtotal       Rp100.000
Total           Rp100.000
```

Jangan menampilkan PPN sebagai biaya admin atau surcharge.

PPN harus memiliki identity sendiri.

---

# 20. PPN Enable / Disable

Jika tenant menonaktifkan PPN:

* invoice baru tidak otomatis menerapkan PPN;
* historical invoice tetap menyimpan PPN;
* historical report tetap dapat menampilkan PPN;
* data PPN tidak boleh dihapus.

Contoh:

```text id="v7v4u5"
PPN Enabled
    ↓
Invoice A → PPN

PPN Disabled
    ↓
Invoice B → No PPN

Invoice A tetap memiliki PPN.
```

---

# 21. Rate Change

Jika rate berubah:

```text id="jjg0fc"
Old Rate
   ↓
Historical Transactions

New Rate
   ↓
New Transactions
```

Jangan update massal historical invoice.

Jika existing configuration architecture mendukung versioning/effective dating, gunakan mechanism tersebut.

---

# 22. Rounding

PPN calculation harus memiliki aturan rounding yang konsisten.

Minimal:

```text id="7i0g6k"
PPN Amount
=
round(Taxable Amount × Rate)
```

Gunakan numeric/decimal type yang sesuai.

Jangan menggunakan floating-point calculation yang dapat menghasilkan rounding error pada nilai uang.

Ikuti money/decimal convention yang sudah digunakan existing finance module.

---

# 23. Currency

Gunakan currency existing dari Finance module.

V1 tidak perlu membuat multi-currency tax engine baru.

PPN calculation mengikuti currency transaksi.

---

# 24. Data Model Direction

Gunakan existing Finance/Invoice structure jika tersedia.

Secara konseptual minimal membutuhkan:

```text id="3qcxz6"
PPN Configuration
├── tenant_id
├── enabled
├── rate
├── effective_from
└── effective_to

Invoice
├── subtotal
├── taxable_amount
├── tax_type
├── tax_rate
├── tax_amount
└── total
```

Jika existing invoice sudah memiliki generic tax structure yang dapat digunakan, **reuse existing structure**.

Jangan membuat `PPNInvoice` entity terpisah hanya untuk V1.

---

# 25. Future Compatibility

Walaupun V1 hanya PPN, hindari naming yang terlalu spesifik pada core transaction model.

Contoh yang kurang ideal:

```text id="0cnv7p"
invoice.ppn_amount
invoice.ppn_rate
```

Jika existing architecture memungkinkan, lebih baik:

```text id="2p7lqv"
invoice_tax
├── tax_type
├── rate
├── taxable_amount
└── tax_amount
```

Sehingga future dapat menjadi:

```text id="qv7v75"
Invoice
├── PPN
├── PPh
└── Other Tax
```

Namun:

> Jika codebase saat ini belum memiliki generic tax abstraction, jangan over-engineer. Buat abstraction sederhana yang masih mudah diekstrak/di-extend ketika tax kedua benar-benar dibutuhkan.

---

# 26. Accounting

V1 belum membutuhkan full accounting automation.

Namun transaction data harus disimpan secara cukup jelas agar future accounting dapat mengetahui:

```text id="h9a6o2"
Revenue
Tax
Receivable / Payment
```

Jangan membuat full journal engine hanya untuk PPN V1 jika accounting module belum membutuhkannya.

---

# 27. Tax Liability

V1 **belum menghitung tax liability secara kompleks**.

Report hanya menunjukkan:

> Total PPN yang tercatat berdasarkan transaksi pada periode tertentu.

Jangan menyebut report V1 sebagai:

> "Nominal pajak yang secara hukum wajib disetor."

Gunakan wording seperti:

> PPN Tercatat

atau:

> PPN Berdasarkan Transaksi

Advanced `Tax Liability / Tax Payable` akan masuk roadmap berikutnya setelah business rule tervalidasi.

---

# 28. Tax Payment

V1 belum perlu membuat dedicated Tax Payment module.

Payment yang dimaksud pada fase ini adalah payment invoice/customer.

Contoh:

```text id="g1kwy6"
Customer
  ↓
Invoice
  ↓
PPN
  ↓
Customer Payment
```

Pembayaran PPN kepada otoritas pajak berada di luar scope V1.

---

# 29. Permissions

Gunakan existing Finance permission system.

Minimal permission concept:

```text id="0yd5gn"
finance.tax.view
finance.tax.manage
finance.tax.report
```

Jika existing permission convention berbeda, ikuti convention existing.

Tidak perlu membuat role `Tax Admin` khusus untuk V1.

---

# 30. Audit Trail

Jika existing Finance configuration memiliki audit trail, perubahan PPN configuration harus tercatat.

Minimal:

```text id="7msr35"
Changed By
Changed At
Old Rate
New Rate
Old Status
New Status
Effective Date
```

Jika audit infrastructure belum tersedia, jangan membuat audit system global baru hanya untuk PPN.

Gunakan pattern existing.

---

# 31. Tenant Isolation

Semua:

* PPN configuration;
* invoice tax;
* PPN report;
* PPN summary;

harus scoped ke tenant.

Tidak boleh ada cross-tenant data access.

---

# 32. Codebase Discovery

Sebelum implementasi, AI coder wajib melakukan discovery:

1. Cari existing Finance module.
2. Cari Invoice entity.
3. Cari Invoice calculation logic.
4. Cari Payment logic.
5. Cari existing money/decimal handling.
6. Cari existing currency handling.
7. Cari existing tenant configuration.
8. Cari existing subscription/feature gating.
9. Cari existing Finance permissions.
10. Cari existing reporting pattern.
11. Cari existing tax-related implementation jika ada.
12. Cari existing audit trail.

Prioritas:

> **Reuse existing architecture sebelum membuat abstraction baru.**

---

# 33. Migration Safety

Jika invoice production sudah tersedia:

* jangan mengubah historical invoice;
* jangan menghitung ulang invoice lama secara otomatis;
* jangan merusak existing total;
* jangan mengubah payment history;
* migration harus backward-compatible.

Jika existing invoice belum memiliki tax fields, migration harus menggunakan nullable/default-safe approach.

---

# 34. Acceptance Criteria

## Configuration

* [ ] Tenant dapat enable/disable PPN.
* [ ] Tenant dapat menentukan PPN rate.
* [ ] Tenant dapat menentukan effective date.
* [ ] Configuration scoped ke tenant.
* [ ] Rate tidak hard-coded.

## Invoice

* [ ] Invoice dapat menghitung PPN.
* [ ] Taxable amount dapat diketahui.
* [ ] Tax rate tersimpan pada transaction.
* [ ] Tax amount tersimpan pada transaction.
* [ ] Total invoice menghitung PPN dengan benar.
* [ ] Invoice tanpa PPN tetap berjalan.
* [ ] Historical invoice tidak berubah ketika rate berubah.

## Reporting

* [ ] Finance dapat melihat total PPN berdasarkan periode.
* [ ] Finance dapat melihat taxable amount.
* [ ] Finance dapat melihat jumlah transaction/invoice.
* [ ] Report dapat difilter berdasarkan periode.
* [ ] Report tidak mengklaim sebagai tax compliance report.

## Payment

* [ ] Payment invoice tidak menghitung ulang PPN.
* [ ] Historical PPN tetap terkait dengan invoice.

## Security

* [ ] Tenant isolation berjalan.
* [ ] Finance permission diterapkan.
* [ ] Feature tier restriction mengikuti existing subscription system.

## Future Compatibility

* [ ] Struktur tidak menghambat penambahan tax type lain.
* [ ] Historical transaction tetap immutable/terlindungi.
* [ ] Tax rate dapat memiliki effective period.
* [ ] Tidak membuat dependency terhadap Advanced Tax Engine.

---

# 35. Explicit Non-Goals

Jangan implementasikan pada fase ini:

* PPh;
* PPh 21;
* PPh 23;
* PPh Final;
* withholding tax;
* tax credit;
* tax reconciliation;
* tax liability engine;
* tax payable engine;
* tax payment tracking;
* tax filing;
* compliance automation;
* generic tax rule engine;
* automatic tax decision;
* revenue sharing tax automation;
* advanced accounting automation.

---

# 36. Future Expansion Path

Setelah PPN V1 stabil dan kebutuhan tenant mulai tervalidasi:

```text id="v3s3pb"
PPN V1
  ↓
Multiple Tax
  ↓
Tax Configuration
  ↓
Tax Ledger
  ↓
Tax Position
  ↓
Tax Payable
  ↓
Tax Payment
  ↓
Tax Reporting
  ↓
Tax Rule Engine
  ↓
Accounting / Compliance
```

Urutan tersebut bukan commitment final.

Roadmap dapat berubah berdasarkan feedback tenant dan hasil research.

---

# 37. Final Principle

PPN V1 harus mengikuti prinsip:

> **Simple enough to implement now, structured enough to evolve later.**

Jangan membangun seluruh Advanced Tax Module hanya karena PPN membutuhkan sedikit abstraction.

Namun jangan pula membuat implementation yang hanya bekerja untuk satu hard-coded PPN rate.

Target V1:

```text
Tenant Configuration
       ↓
PPN Calculation
       ↓
Invoice
       ↓
Transaction Record
       ↓
Simple PPN Report
```

Sedangkan:

```text
Tax Liability
Tax Payable
Tax Payment
Tax Reconciliation
Tax Rule Engine
Compliance
```

tetap menjadi bagian dari Advanced Finance & Tax Roadmap.
