# Arsitektur Wallet & Payment Infrastructure — ERP SaaS

## 1. Konteks Platform

ERP SaaS digunakan oleh bisnis RT/RW Net / ISP kecil.

Role utama:

- Super Admin → pemilik/platform ERP
- Tenant → pemilik bisnis yang menggunakan ERP
- Client → pelanggan Tenant
- NOC
- Admin
- Mitra
- Technician
- HR
- Finance
- Employee → karyawan Tenant

Payment infrastructure akan menggunakan payment provider/platform,
bukan ERP menjadi penerbit e-money sendiri.

---

# 2. Prinsip Utama

ERP bertindak sebagai:

- Orchestrator
- Payment management layer
- Internal ledger
- Mapping layer antara user ERP dan account provider

Provider menangani:

- Payment processing
- KYC/verification
- Holding/settlement dana
- Bank payout
- Payment methods
- Provider-level compliance

ERP tidak boleh menjadikan saldo provider sebagai satu-satunya
source of truth.

ERP tetap memiliki internal ledger untuk mencatat:

- transaction
- debit
- credit
- fee
- settlement
- withdrawal
- refund
- reversal
- status
- provider reference
- webhook
- reconciliation

---

# 3. Struktur Account

Konsep yang diinginkan:

ERP SaaS
│
└── Super Admin
    │
    └── Provider Master Account
        │
        ├── Tenant A
        │   ├── Mitra A1
        │   └── ...
        │
        ├── Tenant B
        │
        └── Tenant C

Namun tidak semua role ERP harus menjadi provider sub-account.

---

# 4. Super Admin

Super Admin adalah pemilik/platform ERP.

Super Admin mempunyai:

- Provider master account
- Platform balance/account
- Platform revenue
- Platform fee

Super Admin menerima pembayaran dari Tenant untuk:

- SaaS subscription
- layanan ERP
- layanan/produk komersial lain

Pembayaran tersebut dianggap TRANSAKSI KOMERSIAL.

---

# 5. Tenant

Tenant adalah entity utama yang menggunakan ERP.

Tenant idealnya mempunyai provider sub-account.

Tenant dapat:

### Incoming

Client
  ↓
Payment
  ↓
Tenant

### Outgoing

Tenant
  ↓
Supplier / Vendor

Tenant
  ↓
Mitra

Tenant
  ↓
Bank Account

Tenant juga dapat menerima settlement dari Mitra:

Mitra
  ↓
Tenant

---

# 6. Client

CLIENT TIDAK perlu mempunyai provider wallet/sub-account.

Client hanya:

- customer
- payer
- pengguna layanan Tenant

Contoh:

Client membayar tagihan internet:

Client
  ↓
Payment
  ↓
Tenant Account

Tidak perlu membuat ribuan sub-account provider untuk Client.

Ini sengaja dibuat agar:

- biaya platform lebih rendah
- KYC tidak diperlukan untuk setiap Client
- arsitektur jauh lebih sederhana
- onboarding Client tetap ringan

---

# 7. Employee

Employee TIDAK perlu mempunyai provider wallet/sub-account.

Flow yang diinginkan:

Tenant
  ↓
Payout / Withdrawal
  ↓
Rekening Employee

Contoh:

Finance
  ↓
Payroll
  ↓
Employee Bank Account

Dengan model ini:

- Employee tidak memiliki wallet provider
- Employee tidak perlu KYC provider
- Tidak ada activity fee sub-account Employee
- Tidak perlu menyimpan saldo Employee
- Employee langsung menerima uang ke rekening

CATATAN:

Jangan menganggap payout pasti gratis.

Provider bisa tetap mengenakan biaya disbursement/payout.

Yang perlu dicari nanti adalah provider dengan biaya payout
yang paling cocok untuk model ERP ini.

---

# 8. Mitra

Mitra berbeda dengan Employee.

Mitra berpotensi membutuhkan hubungan dua arah dengan Tenant.

Flow:

Tenant
  ↓
Payment / Settlement
  ↓
Mitra

dan:

Mitra
  ↓
Setoran / Settlement
  ↓
Tenant

Karena Mitra mempunyai transaksi dua arah dan berpotensi
menyimpan/mengelola saldo, Mitra masih menjadi kandidat
provider sub-account.

Tetapi ini BELUM FINAL.

Kita perlu mencari provider yang bisa melakukan:

- Tenant → Mitra
- Mitra → Tenant
- isolated balance
- payout
- KYC
- settlement

dengan biaya rendah.

---

# 9. Jenis Transaksi

## A. Transaksi Komersial

Contoh:

Client → Tenant
Tenant → Super Admin
Tenant → Supplier

Transaksi seperti ini boleh dikenakan:

- provider transaction fee
- platform fee ERP
- tax jika applicable

---

## B. Transaksi Internal / Settlement

Contoh:

Tenant → Mitra
Mitra → Tenant

Tujuannya bukan membeli barang/jasa dari pihak luar,
tetapi settlement/internal movement.

Keinginan bisnis ERP:

- ERP tidak mengenakan commercial transaction fee

TETAPI:

Provider BELUM tentu gratis.

Jika menggunakan provider tertentu, transfer antar-account
bisa tetap dikenakan provider/in-house/platform fee.

Ini merupakan salah satu alasan Xendit XenPlatform
sementara DIHOLD.

---

## C. Payroll

Tenant → Employee Bank Account

Employee bukan provider sub-account.

ERP mencatat payroll secara internal.

Provider hanya digunakan untuk melakukan payout/disbursement.

---

# 10. Fee Model

Kita harus memisahkan fee menjadi beberapa layer.

## Provider Transaction Fee

Fee yang dikenakan provider berdasarkan jenis transaksi/payment method.

Contoh:

- VA
- QRIS
- E-wallet
- Card
- payment method lainnya

Besarnya tergantung provider dan metode pembayaran.

---

## Provider Platform / In-house Fee

Beberapa provider platform dapat mengenakan fee ketika terjadi:

- transfer antar-account
- split
- routing
- settlement tertentu

Contoh yang pernah kita temukan pada XenPlatform:

0.5% × amount tertentu yang masuk dalam split/in-house
dengan contoh cap Rp10.000.

CATATAN:

Angka tersebut BELUM dianggap harga final.

---

## Provider Activity Fee

XenPlatform juga mempunyai konsep:

Monthly Active Sub-account

Sub-account yang melakukan chargeable transaction
dapat dikenakan activity fee bulanan.

Activity fee bukan berarti:

"setiap transaksi dikenakan Rp25.000."

Melainkan:

"sub-account aktif pada bulan tersebut → dikenakan
activity fee sesuai pricing provider."

Withdraw/top-up tertentu tidak otomatis membuat account
menjadi chargeable transaction.

Harga yang pernah terlihat:

Rp25.000 / active sub-account / month

CATATAN:

Angka ini harus dikonfirmasi ulang ke provider karena
pricing dapat berubah / berdasarkan agreement.

---

# 11. ERP Platform Fee

Ini adalah fee MILIK ERP sendiri.

Contoh:

Client bayar Rp100.000 ke Tenant.

ERP dapat mengambil:

- fixed fee
- percentage
- fixed + percentage

Fee ini berbeda dari provider fee.

Contoh konsep:

Gross Payment = Rp100.000

Provider Fee = RpX

ERP Platform Fee = RpY

Tenant Net = Rp100.000 - RpX - RpY

Besarnya belum ditentukan.

---

# 12. Fee Allocation

ERP diharapkan fleksibel.

Kemungkinan konfigurasi:

### Sender Pays

Sender menanggung fee.

### Receiver Pays

Receiver menerima nominal setelah fee.

### Split Fee

Fee dibagi antara sender dan receiver.

### Platform Fee

ERP mengambil bagian sebagai revenue.

Namun implementasi final tergantung kemampuan provider yang
nantinya dipilih.

---

# 13. KYC

KYC tidak perlu dibuat sebagai sistem verifikasi sendiri.

Konsep UX:

User
  ↓
"Aktifkan Wallet"
  ↓
ERP menampilkan form KYC
  ↓
ERP mengirim data ke Provider
  ↓
Provider melakukan verification
  ↓
Webhook
  ↓
ERP update status
  ↓
Account ACTIVE

Status yang perlu dipertimbangkan:

- NOT_ACTIVATED
- KYC_REQUIRED
- PENDING_VERIFICATION
- ACTION_REQUIRED
- ACTIVE
- REJECTED

ERP hanya menjadi orchestration/UI layer.

Provider tetap melakukan verification/KYC.

---

# 14. Wallet Activation

Tidak semua user otomatis dibuatkan provider account.

Konsep yang lebih efisien:

Tenant:
  → Wallet wajib/diaktifkan saat onboarding

Mitra:
  → Aktifkan Wallet jika memang membutuhkan transaksi

Employee:
  → Tidak perlu wallet provider

Client:
  → Tidak perlu wallet provider

Dengan begitu kita menghindari biaya sub-account yang tidak perlu.

---

# 15. Internal Ledger ERP

Minimal entity yang direncanakan:

wallet_accounts

wallet_transactions

ledger_entries

payment_transactions

payout_transactions

fee_transactions

provider_accounts

provider_webhooks

settlements

reconciliation_records

Setiap transaksi idealnya mempunyai:

- internal transaction ID
- provider transaction ID
- tenant ID
- source account
- destination account
- gross amount
- provider fee
- platform fee
- tax
- net amount
- transaction type
- status
- created_at
- completed_at
- idempotency key
- provider reference

---

# 16. Payment Service Architecture

Jangan hard-code business logic langsung ke Xendit.

Gunakan abstraction:

ERP
 ↓
Payment Service
 ↓
Provider Interface
 ├── XenditProvider
 ├── ProviderB
 └── ProviderC

Contoh interface:

createPayment()
createPayout()
getBalance()
createTransfer()
createSubAccount()
getAccountStatus()
handleWebhook()

Dengan begitu provider dapat diganti tanpa membongkar
seluruh ERP.

---

# 17. Arsitektur Ideal Sementara

                     ERP SaaS
                         │
                  Payment Service
                         │
                  Provider Layer
                         │
              ┌──────────┴──────────┐
              │                     │
          Master Account        Sub Accounts
              │                     │
         Super Admin           Tenant / Mitra
                                    │
                    ┌───────────────┴──────────────┐
                    │                              │
                  Client                        Mitra
                    │                              │
                PAY ONLY                    TWO-WAY FLOW


Employee:

Tenant
  ↓
Provider Payout
  ↓
Employee Bank Account


Client:

Client
  ↓
Payment
  ↓
Tenant Account


Mitra:

Tenant
  ↔
Mitra Account


Tenant:

Tenant
  ↓
Supplier / Vendor


Tenant:

Tenant
  ↓
Super Admin
(SaaS subscription)

---

# 18. Kenapa Xendit Sementara Di-HOLD?

Xendit XenPlatform secara teknis sangat dekat dengan kebutuhan
arsitektur kita.

Tetapi ada concern:

1. Internal transfer bisa memiliki in-house fee.
2. Ada kemungkinan activity fee per active sub-account.
3. Ada transaction/payment fee.
4. Ada kemungkinan payout/disbursement fee.
5. Economics bisa menjadi mahal jika jumlah Tenant/Mitra besar.
6. Kita ingin transaksi internal terasa "gratis" dari sisi
   bisnis ERP.

Jadi:

Xendit BUKAN ditolak.

Statusnya:

"HOLD / kandidat kuat, menunggu perbandingan economics
dan provider lain."

---

# 19. Keputusan Bisnis yang SUDAH JELAS

CLIENT:
→ Tidak punya wallet provider.

EMPLOYEE:
→ Tidak punya wallet provider.
→ Gaji langsung ke rekening employee.

TENANT:
→ Membutuhkan account/balance terisolasi.

MITRA:
→ Kemungkinan mempunyai account/balance terisolasi
  karena membutuhkan transaksi dua arah.

SUPER ADMIN:
→ Master/platform account.

ERP:
→ Memiliki internal ledger.

Provider:
→ Menangani payment/KYC/payout/compliance.

---

# 20. Hal yang MASIH HARUS DITENTUKAN

1. Provider terbaik selain Xendit.

2. Apakah Mitra benar-benar perlu menyimpan saldo
   atau cukup settlement langsung.

3. Bagaimana membuat:
   Tenant → Mitra
   Mitra → Tenant
   semurah mungkin.

4. Biaya payout Employee.

5. Biaya payment Client → Tenant.

6. Fee Tenant → Supplier.

7. Fee Tenant → Super Admin.

8. Apakah provider mendukung isolated balance
   untuk setiap Tenant/Mitra.

9. KYC dan onboarding Mitra.

10. Apakah provider menyediakan platform/marketplace
    infrastructure, bukan sekadar payment gateway biasa.

---

# 21. Target Arsitektur Bisnis

Tujuan utama:

"ERP terasa seperti mempunyai Wallet Infrastructure sendiri,
tetapi dana dan regulated payment infrastructure tetap
ditangani oleh payment provider."

User melihat:

Wallet Tenant
Wallet Mitra
Payment
Transfer
Settlement
Withdrawal
Payroll

Tetapi secara backend:

ERP = orchestration + ledger + business rules

Provider = regulated payment infrastructure