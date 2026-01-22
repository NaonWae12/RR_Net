# 🔍 Auth Bootstrap Timing Issue - Audit Report

## 📋 Tujuan
Memastikan apakah request API pertama dikirim sebelum Authorization token benar-benar siap / terpasang di axios, yang menyebabkan 401 di initial load tapi normal setelah refresh.

## 📊 Timeline Eksekusi Auth → Axios → Fetch

### 1. Module Load (Synchronous - authStore.ts:181-201)

```
1. authStore.ts module di-import
2. loadPersisted() membaca dari localStorage
3. hydrate() dipanggil dengan data dari localStorage
   - isAuthenticated = !!snapshot.token (SET IMMEDIATELY)
   - isHydrated = true
4. setAccessToken(snapshot.token) dipanggil (SYNCHRONOUS)
   - accessToken variable di apiClient.ts di-set
```

**⚠️ POINT KRITIS**: 
- `isAuthenticated` di-set ke `true` SYNCHRONOUSLY
- `setAccessToken()` dipanggil SYNCHRONOUSLY
- TAPI: axios interceptor belum tentu sudah "aware" karena interceptor adalah async function

### 2. React Component Render (dashboard/page.tsx:20-26)

```
1. Component mount
2. useEffect trigger ketika isAuthenticated === true
3. fetchDashboardData() dipanggil IMMEDIATELY
```

**⚠️ POTENTIAL RACE CONDITION**:
- useEffect bisa trigger SEBELUM axios interceptor sempat sync dengan authStore
- Terutama jika ada multiple useEffect yang trigger bersamaan

### 3. Axios Request Interceptor (apiClient.ts:254-396)

```
1. Request interceptor dipanggil (ASYNC)
2. Mencoba get token dari authStore (lines 264-278)
   - Dynamic import authStore
   - Get state.token
   - Sync dengan accessToken variable
3. Set Authorization header (lines 335-337)
   - HANYA jika currentToken ada
```

**⚠️ POTENTIAL ISSUE**:
- Interceptor adalah async, jadi ada delay
- Jika authStore belum fully hydrated atau ada timing issue, token bisa null
- Multiple requests concurrent bisa race condition

### 4. API Calls (dashboardService.ts, tenantService.ts)

```
1. getClientStats() → /clients/stats
2. getPlan() → /my/plan
3. getFeatures() → /my/features
4. getLimits() → /my/limits
5. getCurrentTenant() → /tenant/me
```

Semua dipanggil via `Promise.allSettled()` dalam `getDashboardData()`, jadi bisa concurrent.

## 🔬 Analisis Potensi Masalah

### Scenario 1: Race Condition pada Hydration

**Kemungkinan**:
1. authStore module load → hydrate() set isAuthenticated = true
2. React component render → useEffect trigger → fetchDashboardData()
3. Axios interceptor belum sempat sync dengan authStore
4. Request dikirim tanpa Authorization header → 401

**Bukti yang dicari**:
- Log menunjukkan `isAuthenticated: true` tapi `token: null` di interceptor
- Log menunjukkan `authHeader: MISSING` di 401 debug

### Scenario 2: Multiple Concurrent Requests

**Kemungkinan**:
1. Layout useEffect trigger fetchDashboardData()
2. Dashboard page useEffect trigger fetchDashboardData()
3. Keduanya concurrent, salah satu bisa kena race condition

**Bukti yang dicari**:
- Multiple `[API CALL]` logs dengan timing sangat dekat
- Salah satu request punya token, yang lain tidak

### Scenario 3: Token Sync Issue

**Kemungkinan**:
1. setAccessToken() dipanggil
2. Tapi axios interceptor masih pakai old accessToken variable
3. authStore.token sudah ada, tapi accessToken variable belum update

**Bukti yang dicari**:
- Log menunjukkan `accessToken: null` tapi `authStore.token: <exists>`
- Log menunjukkan "Syncing accessToken from authStore"

## 📝 Instrumentasi yang Ditambahkan

### A. Auth State Changes (authStore.ts)

```javascript
[AUTH] Module load - starting hydration
[AUTH] Loaded from localStorage: { hasToken, token, isAuthenticated }
[AUTH] Calling hydrate with: { isAuthenticated, token }
[AUTH] hydrate called: { isAuthenticated, token, hasToken }
[AUTH] after hydrate - isAuthenticated: <bool>, token: <string>
[AUTH] Setting accessToken in apiClient: <token>
[AUTH] Hydration complete: { isAuthenticated, token, isHydrated }
```

### B. Axios Interceptor (apiClient.ts)

```javascript
[AXIOS] setAccessToken called: { hasToken, token, stackTrace }
[AXIOS] Request interceptor - initial state: { url, method, accessToken }
[AXIOS] Request interceptor - authStore state: { url, isAuthenticated, hasToken, token }
[AXIOS] Authorization header set in interceptor: { url, method, hasToken, tokenPreview }
[AXIOS] WARNING: No token available in interceptor: { url, method, accessToken, currentToken }
```

### C. Before API Calls

```javascript
[API CALL] fetchDashboardData - BEFORE call: { endpoint, isAuthenticated, token, authHeader }
[API CALL] getClientStats - BEFORE call: { endpoint, isAuthenticated, token }
[API CALL] getPlan - BEFORE call: { endpoint, isAuthenticated, token }
[API CALL] getFeatures - BEFORE call: { endpoint, isAuthenticated, token }
[API CALL] getLimits - BEFORE call: { endpoint, isAuthenticated, token }
[API CALL] getCurrentTenant - BEFORE call: { endpoint, isAuthenticated, token, slug }
```

### D. 401 Debug (apiClient.ts)

```javascript
[401 DEBUG] Unauthorized response: {
  url, method, authHeader, hasAuthHeader, accessToken, _retry
}
```

### E. Component Lifecycle

```javascript
[DASHBOARD PAGE] useEffect triggered: { isAuthenticated, token }
[DASHBOARD PAGE] Calling fetchDashboardData
[TENANT LAYOUT] TenantFeatureBootstrap useEffect: { isAuthenticated, hasData, loading, willFetch }
[TENANT LAYOUT] Calling fetchDashboardData from layout
```

## 🧪 Cara Reproduksi Bug

### Step 1: Hard Reload
1. Buka aplikasi di browser
2. Tekan `Ctrl+Shift+R` (Windows/Linux) atau `Cmd+Shift+R` (Mac)
3. Ini akan clear cache dan force reload semua modules

### Step 2: Enable CPU Throttling
1. Buka DevTools (F12)
2. Go to Performance tab
3. Enable CPU throttling: 6x slowdown
4. Ini akan memperlambat eksekusi dan membuat race condition lebih mudah terlihat

### Step 3: Monitor Console Logs
1. Buka Console tab di DevTools
2. Filter logs dengan prefix:
   - `[AUTH]`
   - `[AXIOS]`
   - `[API CALL]`
   - `[401 DEBUG]`
   - `[DASHBOARD PAGE]`
   - `[TENANT LAYOUT]`

### Step 4: Analisis Logs

**Cari pola berikut**:

#### Pattern 1: Token Missing di Interceptor
```
[AUTH] Hydration complete: { isAuthenticated: true, token: "abc..." }
[API CALL] fetchDashboardData - BEFORE call: { isAuthenticated: true, token: "abc..." }
[AXIOS] Request interceptor - authStore state: { isAuthenticated: true, hasToken: false }
[AXIOS] WARNING: No token available in interceptor
[401 DEBUG] { authHeader: "MISSING" }
```
**→ TERBUKTI: Race condition antara hydration dan interceptor**

#### Pattern 2: Multiple Concurrent Calls
```
[TENANT LAYOUT] Calling fetchDashboardData from layout
[DASHBOARD PAGE] Calling fetchDashboardData
[API CALL] fetchDashboardData - BEFORE call (dari layout)
[API CALL] fetchDashboardData - BEFORE call (dari page)
[AXIOS] Request interceptor - salah satu punya token, yang lain tidak
```
**→ TERBUKTI: Concurrent requests race condition**

#### Pattern 3: Token Sync Issue
```
[AXIOS] setAccessToken called: { hasToken: true }
[AXIOS] Request interceptor - initial state: { accessToken: null }
[AXIOS] Request interceptor - authStore state: { hasToken: true }
[AXIOS] Syncing accessToken from authStore
```
**→ TERBUKTI: accessToken variable belum sync dengan authStore**

## ✅ Kriteria Validasi

### Kecurigaan TERBUKTI jika ditemukan:

1. **API call dikirim** (ada log `[API CALL]`)
2. **isAuthenticated === true** (ada di log)
3. **Authorization header === undefined / kosong** (ada di log `[401 DEBUG]` dengan `authHeader: "MISSING"`)

### Kecurigaan TIDAK TERBUKTI jika:

- Semua API call selalu punya Authorization header (semua log `[AXIOS] Authorization header set`)
- Tidak ada log `[401 DEBUG]` dengan `authHeader: "MISSING"`
- Semua request sukses tanpa 401

## 📌 Catatan Penting

1. **Logging adalah TEMPORARY** - hanya untuk debugging
2. **JANGAN refactor** auth logic berdasarkan temuan ini
3. **JANGAN tambahkan** authReady atau logic baru
4. **Fokus** pada identifikasi timing issue saja

## 🔄 Next Steps Setelah Audit

Setelah mendapatkan logs dari reproduksi:

1. **Analisis urutan log** - buat timeline exact
2. **Identifikasi gap** - di mana token hilang?
3. **Dokumentasikan** - screenshot/logs sebagai bukti
4. **Kesimpulan** - TERBUKTI atau TIDAK TERBUKTI

Jika TERBUKTI, solusi potensial (untuk diimplementasikan nanti):
- Tambahkan authReady flag
- Wait untuk token ready sebelum trigger API calls
- Sync mechanism yang lebih robust antara authStore dan apiClient

