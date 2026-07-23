# AI Migration v2 — Next Development Plan

> **Status**: Planned  
> **Target Paket**: Business (Tenant)  
> **Prioritas**: High  
> **Dibuat**: 2026-07-23

---

## 🎯 Tujuan & Latar Belakang

Versi saat ini (v1) dari fitur AI Migration sudah bisa membaca dokumen/gambar dan langsung memasukkan semua data ke tabel review. Namun pendekatan ini memiliki beberapa kebutuhan baru:

- AI bisa salah membaca data (terutama tulisan tangan atau scan kualitas rendah)
- User membutuhkan interaksi yang lebih intuitif via percakapan (chat)
- AI menginfokan data apa saja yang berhasil dibaca dan memerlukan konfirmasi
- User dapat memberikan koreksi melalui prompt chat ATAU mengedit langsung secara manual pada kartu data (hybrid interface)
- Tampilan UI lebih user friendly & modern (Chat-based Layout)

**Visi v2**: Ubah pengalaman migrasi menjadi **percakapan interaktif** antara user dan AI assistant, dengan opsi manual override tanpa wajib prompting.

---

## 🔐 Gating: Khusus Paket Business (Tenant Level)

Fitur AI Migration v2 **hanya tersedia untuk tenant dengan paket Business ke atas**.

### Implementasi Gating:
- **Backend**: Tambahkan feature flag `ai_migration_v2` di `FeatureResolver`
- **Frontend**: Cek plan di page load, tampilkan banner / modal upgrade jika bukan Business
- **API Endpoint Guard**: Endpoint `/api/v1/migrations/session/*` diproteksi dengan middleware `RequireFeature("ai_migration_v2")`
- **Paket Berhak**: `business`, `enterprise`

---

## 🗺️ Alur Pengalaman Pengguna (UX Flow)

```
[User] Upload file (gambar / PDF / dokumen migrasi)
         ↓
[AI] Analisis dokumen & ekstrak data awal
         ↓
[AI] Memberikan ringkasan via Chat:
     "Halo! Saya telah menganalisis dokumen kamu. Terbaca 12 data pelanggan:"
     - 10 data lengkap (Nama, Telp, Paket)
     - 2 data butuh konfirmasi (Alamat/Paket tidak terdeteksi)
         ↓
[User Interaksi (2 Cara)]:
     a) Prompting via Chat → "Paket untuk Siti Rahayu diubah jadi 20Mbps"
     b) Manual Edit Inline → Klik kolom pada kartu data Siti Rahayu & ubah langsung
         ↓
[AI / System] Real-time Sync & Update State
         ↓
[User] Klik [Finalize Migration] untuk mengeksekusi Pembuatan Client
```

---

## 🧩 Komponen Utama

### 1. Interactive Chat Assistant (Kiri)
- Interface percakapan real-time antara AI dan Tenant User.
- AI melaporkan temuan data, kolom yang kurang, atau ambigu.
- AI merespon instruksi koreksi dari user (misal: *"Ubah semua paket yang harganya 100rb jadi Paket Silver"*).

### 2. Live Data Board (Kanan / Split View)
- Card / Table interaktif berisi data pelanggan yang diekstraksi secara live.
- Menampilkan status readiness per pelanggan:
  - 🟢 `Siap Migrasi`
  - 🟡 `Butuh Perhatian` (misal: Paket belum di-mapping)
  - 🔴 `Kurang Data Utama` (misal: Nama kosong)
- **Direct Manual Edit**: User bisa mengedit field mana saja secara manual tanpa perlu mengetikkan prompt ke AI.

### 3. Session State Engine (Backend)
- Chat history dan current extracted state disimpan dalam sesi (`MigrationSession`).
- Mendukung pembaruan state baik via perintah LLM maupun update manual dari UI.

---

## 🎨 Konsep Layout UI

```
┌────────────────────────────────────────────────────────────────────────┐
│  🤖 AI Migration Assistant (Business Feature)      [Upload New File]  │
├──────────────────────────────────┬─────────────────────────────────────┤
│  💬 AI Chat Assistant            │  📋 Live Data Preview (12 items)    │
│  ──────────────────────────────  │  ─────────────────────────────────  │
│  🤖 AI:                          │  [🟢 Siap: 10]  [🟡 Review: 2]      │
│  "Saya telah membaca 12 data     │                                     │
│  pelanggan. Ada 2 data yang      │  ┌───────────────────────────────┐  │
│  butuh kelengkapan paket."       │  │ 🟢 Budi Santoso               │  │
│                                  │  │ PPPoE • Paket 50M • 08123xxx    │  │
│  👤 You:                         │  └───────────────────────────────┘  │
│  "Tolong set paket Siti jadi     │  ┌───────────────────────────────┐  │
│  Paket 20Mbps"                   │  │ 🟡 Siti Rahayu  [Edit Manual] │  │
│                                  │  │ Tanpa Paket ✎ • 08567xxx      │  │
│  🤖 AI:                          │  └───────────────────────────────┘  │
│  "Siap! Paket Siti Rahayu sudah  │                                     │
│  saya perbarui ke Paket 20Mbps." │                                     │
│                                  │                                     │
│  ┌────────────────────────────┐  │                                     │
│  │ Ketik pesan/koreksi...  [↵]│  │     [🚀 Finalize Migration (12)]  │
│  └────────────────────────────┘  │                                     │
└──────────────────────────────────┴─────────────────────────────────────┘
```

---

## 🔧 Perubahan Teknis Dibutuhkan

### Backend (Go)
1. **Migration Service**:
   - `StartSession(tenantID, file)`: Mengolah file & inisialisasi state JSON.
   - `ChatSession(sessionID, userMessage)`: Mengolah prompt koreksi user & update state data.
   - `UpdateRecordManual(sessionID, clientID, updates)`: Update manual dari UI direct edit.
   - `FinalizeSession(sessionID)`: Bulk create client ke DB/MikroTik.
2. **Feature Gate**:
   - Guard endpoint dengan check plan level tenant (minimal `Business`).

### Frontend (Next.js)
1. **Routing**: `src/app/(tenant)/clients/migration/page.tsx` (Refactor / Split-view Chat UI).
2. **Components**:
   - `MigrationChatPanel.tsx`: Area percakapan AI.
   - `MigrationDataBoard.tsx`: Board preview data real-time.
   - `EditableClientCard.tsx`: Card data pelanggan yang bisa direct edit.
   - `BusinessUpgradeBanner.tsx`: Gate banner untuk tenant non-Business.

---

## 📋 Tahapan Pengisian / Roadmap Dev

1. **Phase 1: Backend Session & LLM Context Engine**
   - Buat struktur data session & handler chat migration.
2. **Phase 2: Plan Gating Setup**
   - Tambahkan `ai_migration_v2` ke plan features `Business`.
3. **Phase 3: Interactive Split-View UI**
   - Implementasi komponen Chat Panel & Direct Edit Data Board.
4. **Phase 4: Testing & Polish**
   - Uji skenario prompt koreksi massal & direct manual edit.

---

## 📁 Lokasi Dokumen Rencana
Dokumen rencana ini disimpan secara permanen di:  
`docs_plan/next_dev/ai_migration/PLAN.md`
