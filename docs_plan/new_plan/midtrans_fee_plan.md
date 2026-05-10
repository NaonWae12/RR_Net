# Dokumentasi Perhitungan Fee Sharing Midtrans (Gross-up Formula)

Dokumen ini menjelaskan bagaimana sistem menghitung biaya layanan (MDR - Merchant Discount Rate) Midtrans yang akan dibebankan kepada pelanggan (Customer Share) agar merchant (pemilik sistem) tetap menerima nominal pembayaran secara utuh sesuai dengan harga produk atau invoice.

## Konsep Dasar
Sistem pembayaran payment gateway selalu memotong sekian persen/rupiah dari total uang yang masuk. Jika sebuah tagihan adalah **Rp 100.000** dan potongannya adalah **2%**, maka merchant hanya menerima **Rp 98.000**.
Untuk mencegah kerugian ini, sistem menggunakan skema **Gross-up (Mark-up)**. Tagihan pelanggan akan dinaikkan sedemikian rupa sehingga ketika Midtrans memotong fee-nya, uang bersih yang masuk ke merchant akan kembali menjadi persis **Rp 100.000**.

Sistem ERP ini memungkinkan konfigurasi **Fee Sharing**, di mana beban biaya tersebut bisa diatur persentasenya antara merchant dan pelanggan.

---

## 1. Rumus Fixed Fee (Biaya Tetap)
Berlaku untuk metode pembayaran seperti **Bank Transfer (Virtual Account)** yang biasanya mengenakan biaya flat, misalnya Rp 4.000 per transaksi.

**Rumus:**
```text
Surcharge = FixedFee * (CustomerShare / 100)
Total Bayar = TargetAmount + Surcharge
```

**Contoh Kasus:**
- Tagihan (Target Amount): Rp 100.000
- Fee Bank VA (MDR Bank Fixed): Rp 4.000
- Customer Share: 100% (Pelanggan bayar full fee)

**Perhitungan:**
- Surcharge = 4.000 * (100 / 100) = 4.000
- Total Bayar = 100.000 + 4.000 = **Rp 104.000**

Jika *Customer Share* diset ke 50%, maka *Surcharge* hanya Rp 2.000 (total bayar Rp 102.000), sisa Rp 2.000 akan diserap otomatis oleh merchant.

---

## 2. Rumus Percentage Fee (Biaya Persentase / Gross-up)
Berlaku untuk metode seperti **QRIS, E-Wallet (GoPay/ShopeePay), dan Credit Card** yang mengenakan biaya persentase dari total tagihan (misal: 0.7%, 1.5%, atau 2.9%).

**Rumus Utama:**
```text
P = (MDR_Percent * (CustomerShare / 100)) / 100
Total Bayar = TargetAmount / (1 - P)
```
*(Nilai P tidak boleh lebih dari atau sama dengan 1, maka sistem akan melimit di 0.99 untuk keamanan).*

**Contoh Kasus:**
- Tagihan (Target Amount): Rp 100.000
- Fee E-Wallet (MDR Percent): 1.5%
- Customer Share: 100% (Pelanggan bayar full fee)

**Perhitungan:**
1. Hitung `P` (Nilai Desimal Persentase Beban):
   `P` = (1.5 * (100 / 100)) / 100 
   `P` = 1.5 / 100 = 0.015

2. Hitung Total Bayar menggunakan pembagian Gross-up:
   `Total Bayar` = 100.000 / (1 - 0.015)
   `Total Bayar` = 100.000 / 0.985
   `Total Bayar` = **Rp 101.522,84** (Sistem Go akan otomatis membulatkan ke integer).

**Pembuktian (Kenapa tidak menggunakan rumus `TargetAmount + 1.5%`?):**
- Jika kita tambah manual: Rp 100.000 + 1.5% = Rp 101.500.
- Ketika pelanggan bayar Rp 101.500, Midtrans akan memotong 1.5% dari uang yang masuk tersebut:
  101.500 * 1.5% = Rp 1.522,5.
- Uang bersih ke merchant = 101.500 - 1.522,5 = **Rp 99.977,5 (Nombok / Kurang)**.
- **Dengan skema Gross-up**: Pelanggan bayar Rp 101.522,84. Dipotong 1.5% oleh Midtrans (Rp 1.522,84). Bersih masuk merchant: **Rp 100.000 Pas!**

---

## Implementasi di Kode (Go)
Di dalam `be/internal/service/midtrans_service.go`, logika ini diimplementasikan di `CreateSnapToken` menggunakan block `switch category`:

```go
// Contoh untuk perhitungan E-Wallet
p := (config.MDREWalletPercent * (config.CustomerSharePercent / 100.0)) / 100.0
if p >= 1.0 {
    p = 0.99
}
finalAmount = int64(float64(amount) / (1.0 - p))
```

## Setup Default UI
- Konfigurasi MDR Global diatur oleh **Super Admin** berdasarkan tagihan asli payment gateway.
- Konfigurasi `CustomerSharePercent` diatur oleh masing-masing **Tenant**.
- **Nilai Default Customer Share adalah 0%** (berarti merchant akan menanggung seluruh admin fee / menombok).
- Jika tenant ingin membebankan biaya sepenuhnya ke pelanggan, tenant harus mengaturnya ke **100%**.
