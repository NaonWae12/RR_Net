# 🔧 Auth Timing Issue - Fix Implementation

## 📋 Solusi yang Diimplementasikan

**Opsi A: Retry-once saat 401** (RECOMMENDED)

### Perubahan Kode

**File**: `fe/src/lib/api/apiClient.ts`

**Lokasi**: Response interceptor, sebelum refresh token logic

**Perubahan**:
- Menambahkan flag `_retryOnce` untuk membedakan dengan `_retry` (refresh token)
- Retry-once logic berjalan SEBELUM refresh token logic
- Hanya retry sekali jika token tersedia di authStore

### Alur Eksekusi

```
1. Request 401 (tanpa Authorization header)
   ↓
2. Check: status === 401 && !_retryOnce
   ↓
3. Set _retryOnce = true
   ↓
4. Ambil token dari authStore
   ↓
5. Jika token ada:
   - Set Authorization header
   - Sync accessToken variable
   - Retry request sekali
   ↓
6. Jika retry berhasil → SUCCESS
   Jika retry masih 401 → Masuk ke refresh token logic (existing)
```

### Mengapa Solusi Ini Aman

1. **Localized**: Hanya mengubah response interceptor, tidak mengubah auth flow
2. **Defensive**: Hanya retry sekali, tidak loop
3. **Non-breaking**: Tidak mengubah struktur store atau auth logic
4. **Low-risk**: Jika retry-once gagal, fall through ke refresh token logic yang sudah ada
5. **Minimal diff**: Hanya ~30 baris kode baru

### Test Case Coverage

✅ **Hard reload + CPU throttling**
- Retry-once akan catch timing issue
- Tidak ada infinite loop (flag `_retryOnce` mencegah)

✅ **Tidak ada infinite loading**
- Retry hanya sekali
- Jika masih 401, masuk ke refresh token logic yang sudah ada

✅ **Tidak ada loop retry**
- Flag `_retryOnce` mencegah retry berulang
- Flag `_retry` mencegah refresh token loop

✅ **Refresh normal tetap cepat**
- Retry-once hanya untuk initial load timing issue
- Steady state tidak terpengaruh

✅ **Tidak ada behavior change di steady state**
- Logic hanya aktif saat 401
- Tidak mengubah flow normal

### Edge Cases yang Ditangani

1. **Token tidak ada di authStore**
   - Fall through ke refresh token logic
   - Tidak crash

2. **Retry-once masih 401**
   - Masuk ke refresh token logic
   - Tidak loop karena `_retry` flag

3. **Multiple concurrent 401**
   - Setiap request punya flag sendiri
   - Tidak saling interfere

4. **authStore belum ready**
   - Try-catch mencegah crash
   - Fall through ke refresh token logic

### Logging

Log yang ditambahkan untuk debugging:
- `[401 RETRY] Retrying once with token from authStore`
- `[401 RETRY] Failed to get token from authStore, falling through to refresh logic`

### Diff Summary

```
+ // OPTION A: Retry-once dengan token dari authStore
+ if (status === 401 && !originalRequest._retryOnce) {
+   originalRequest._retryOnce = true;
+   // ... retry logic
+ }
```

**Total lines changed**: ~30 lines
**Files changed**: 1 file
**Breaking changes**: None
**Linter warnings**: None

