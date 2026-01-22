# 🔍 ANALISIS: Employees Page Gagal First Load

## 📋 Executive Summary

**Problem:** Employees page gagal menampilkan data di first load, tapi berhasil setelah refresh, meskipun API employees sudah terpanggil dan console menunjukkan 401 Unauthorized dari endpoint lain.

**Root Cause Ranking:**
1. ⚠️ **RACE CONDITION: Token sync timing antara authStore hydration dan API calls**
2. ⚠️ **DEPENDENCY CHAIN: Employees page bergantung pada dashboard data yang mungkin gagal load**
3. ⚠️ **PARALLEL 401s: Multiple dashboard endpoints return 401 bersamaan, interceptor refresh hanya handle satu**

---

## 🎯 Root Cause Analysis (Ranked)

### 1. 🥇 **RACE CONDITION: Token Sync Timing Issue**

**File:** `fe/src/stores/authStore.ts:204-244`, `fe/src/lib/api/apiClient.ts:259-301`

**Problem:**
- `authStore` hydrates dari localStorage **synchronously** saat module load (line 204-244)
- Token diset ke `apiClient` via `setAccessToken()` (line 230-232)
- Tapi request interceptor di `apiClient.ts` (line 259-301) melakukan **dynamic import** untuk get token dari authStore
- Ada **race condition** dimana:
  - Dashboard auto-fetch dipanggil dari `TenantLayout` (line 26-30) **segera setelah** `isAuthenticated` menjadi true
  - Tapi token mungkin belum fully synced ke `apiClient.accessToken` variable
  - Request interceptor coba sync dari authStore (line 275-297), tapi ada timing window dimana token belum tersedia

**Evidence:**
```typescript
// authStore.ts:230-236
if (snapshot.token) {
  setAccessToken(snapshot.token);  // Set token
}
// Tapi di apiClient.ts:267, variable accessToken mungkin belum ter-update
let currentToken = accessToken;  // Bisa null/undefined
```

**Kenapa refresh berhasil:**
- Setelah refresh, semua state sudah fully hydrated dan token sudah tersync
- Tidak ada race condition karena semua sudah ready

---

### 2. 🥈 **DEPENDENCY CHAIN: Dashboard Data Required untuk Employees**

**File:** `fe/src/app/(tenant)/employees/page.tsx:44-87`

**Problem:**
- Employees page **bergantung** pada `dashboardStore.data` untuk menentukan `hasRbacEmployee` (line 44-48)
- `loadEmployees()` hanya dipanggil jika `hasRbacEmployee === true` (line 83-85)
- Jika dashboard data gagal load (karena 401 dari race condition di atas), maka:
  - `data` tetap `null` atau `undefined`
  - `hasRbacEmployee` menjadi `false`
  - `loadEmployees()` **tidak pernah dipanggil**

**Flow:**
```typescript
// Line 58-62: Wait for dashboard data
useEffect(() => {
  if (!data && !dashboardLoading) {
    fetchDashboardData();  // Might fail with 401
  }
}, [data, dashboardLoading, fetchDashboardData]);

// Line 77-87: Only load employees if hasRbacEmployee
useEffect(() => {
  if (!hasRbacEmployee && data) {
    router.replace('/dashboard');  // Redirect if no feature
    return;
  }
  if (hasRbacEmployee) {  // ⚠️ This might be false if data failed to load
    loadEmployees();
  }
}, [hasRbacEmployee, data]);
```

**Kenapa refresh berhasil:**
- Setelah refresh, dashboard data sudah berhasil load (token sudah ready)
- `hasRbacEmployee` menjadi `true`
- `loadEmployees()` dipanggil dan berhasil

---

### 3. 🥉 **PARALLEL 401s: Multiple Dashboard Endpoints Fail Bersamaan**

**File:** `fe/src/lib/api/dashboardService.ts:130-142`, `fe/src/lib/api/apiClient.ts:637-690`

**Problem:**
- `getDashboardData()` menggunakan `Promise.allSettled()` untuk call 4 endpoints bersamaan:
  - `/clients/stats` (line 59)
  - `/my/plan` (line 81)
  - `/my/features` (line 103)
  - `/my/limits` (line 125)
- Jika token belum ready, **semua 4 endpoints bisa return 401 bersamaan**
- Response interceptor (line 637-690) punya refresh token logic, tapi:
  - Ada flag `isRefreshing` yang prevent concurrent refresh (line 642)
  - Hanya **satu request** yang trigger refresh, yang lain subscribe ke `refreshSubscribers` (line 680-688)
  - Tapi jika refresh **gagal** atau **belum selesai** saat employees API dipanggil, employees API juga bisa dapat 401

**Evidence:**
```typescript
// dashboardService.ts:130-135
const [clientStats, plan, features, limits] = await Promise.allSettled([
  this.getClientStats(),    // Might 401
  this.getPlan(),           // Might 401
  this.getFeatures(),       // Might 401
  this.getLimits(),         // Might 401
]);
// Promise.allSettled doesn't throw, but all might be rejected
```

**Kenapa employees API sukses tapi UI kosong:**
- Employees API mungkin dipanggil **setelah** token sudah ready (karena delay dari dependency chain)
- Tapi jika `hasRbacEmployee` masih `false` (karena dashboard data gagal), `loadEmployees()` tidak dipanggil
- Atau `loadEmployees()` dipanggil tapi `setEmployees()` tidak ter-trigger karena state update issue

---

## 🔄 Lifecycle Flow Diagram

### First Load (FAILING)

```
1. Module Load
   ├─ authStore.ts:204-244
   │  ├─ Load from localStorage
   │  ├─ hydrate({ token, isAuthenticated: !!token })
   │  ├─ setAccessToken(token)  ⚠️ Might not be immediately available
   │  └─ setApiTenantSlug(tenantSlug)
   │
2. AuthProvider Mount
   ├─ authStore.ts:22-28
   │  └─ If !token && refreshToken → refresh()
   │
3. TenantLayout Mount
   ├─ TenantFeatureBootstrap:26-30
   │  └─ If isAuthenticated && !data → fetchDashboardData()
   │     └─ dashboardService.getDashboardData()
   │        └─ Promise.allSettled([
   │             /clients/stats,    ⚠️ 401 (token not ready)
   │             /my/plan,         ⚠️ 401 (token not ready)
   │             /my/features,     ⚠️ 401 (token not ready)
   │             /my/limits        ⚠️ 401 (token not ready)
   │           ])
   │        └─ data = { clientStats: default, plan: null, ... }
   │
4. EmployeesPage Mount
   ├─ Line 58-62: Wait for dashboard data
   │  └─ If !data → fetchDashboardData() (might already be called)
   │
   ├─ Line 44-48: Calculate hasRbacEmployee
   │  └─ hasRbacEmployee = !!data?.features?.rbac_employee
   │     └─ ⚠️ FALSE (because data.features is empty/default)
   │
   └─ Line 77-87: Load employees
      └─ If hasRbacEmployee → loadEmployees()
         └─ ⚠️ NOT CALLED (hasRbacEmployee is false)
```

### After Refresh (WORKING)

```
1. Module Load (same as above, but token already synced)
   └─ Token ready, no race condition

2. TenantLayout Mount
   └─ fetchDashboardData() → SUCCESS (token ready)
      └─ data = { features: { rbac_employee: true }, ... }

3. EmployeesPage Mount
   └─ hasRbacEmployee = true ✅
      └─ loadEmployees() → SUCCESS ✅
         └─ setEmployees(res.data) ✅
```

---

## 📁 File / Store / Hook yang Dicurigai

### 🔴 **Critical Files**

1. **`fe/src/stores/authStore.ts:204-244`**
   - Hydration logic yang set token ke apiClient
   - **Issue:** Synchronous hydration tapi async token sync ke apiClient

2. **`fe/src/lib/api/apiClient.ts:259-301`**
   - Request interceptor yang sync token dari authStore
   - **Issue:** Dynamic import + timing window untuk token availability

3. **`fe/src/app/(tenant)/employees/page.tsx:77-87`**
   - useEffect yang trigger `loadEmployees()` berdasarkan `hasRbacEmployee`
   - **Issue:** Dependency pada dashboard data yang mungkin gagal load

4. **`fe/src/lib/api/dashboardService.ts:130-142`**
   - `getDashboardData()` dengan `Promise.allSettled()`
   - **Issue:** Multiple parallel requests yang bisa semua fail dengan 401

5. **`fe/src/app/(tenant)/layout.tsx:26-30`**
   - Auto-fetch dashboard data on mount
   - **Issue:** Dipanggil terlalu cepat, sebelum token fully ready

### 🟡 **Secondary Files**

6. **`fe/src/lib/api/apiClient.ts:637-690`**
   - Response interceptor untuk handle 401 dan refresh token
   - **Issue:** Refresh logic mungkin tidak handle semua concurrent 401s dengan baik

7. **`fe/src/lib/providers/AuthProvider.tsx:22-28`**
   - Auto-refresh on mount
   - **Issue:** Mungkin conflict dengan hydration timing

---

## ❓ Kenapa Employees API Sukses Tapi UI Kosong?

**Kemungkinan Scenario:**

1. **Employees API dipanggil TAPI data tidak di-set:**
   - `loadEmployees()` dipanggil dan API call sukses
   - Tapi `setEmployees(res.data)` tidak ter-trigger karena:
     - State update di-batch dan tidak ter-render
     - Component unmount sebelum state update
     - Error di `res.data ?? []` yang return empty array

2. **Employees API dipanggil SETELAH dashboard data gagal:**
   - Dashboard data gagal → `hasRbacEmployee = false`
   - `loadEmployees()` **tidak dipanggil** sama sekali
   - UI show "No users found" karena `employees.length === 0` (initial state)

3. **Race condition di state update:**
   - `loadEmployees()` dipanggil
   - API call sukses
   - Tapi `setEmployees()` dipanggil sebelum component fully mounted
   - State update lost atau tidak ter-render

**Evidence dari code:**
```typescript
// employees/page.tsx:64-75
const loadEmployees = async () => {
  setLoading(true);
  try {
    const res = await employeeService.list();
    setEmployees(res.data ?? []);  // ⚠️ If res.data is undefined, set empty array
  } catch (err: any) {
    // Error handling
  } finally {
    setLoading(false);
  }
};

// employees/page.tsx:34
const [employees, setEmployees] = useState<EmployeeUser[]>([]);  // Initial: empty array
```

---

## ❓ Kenapa 401 Endpoint Lain Mempengaruhi Halaman Ini?

**Root Cause:**

1. **Shared Token State:**
   - Semua API calls share token yang sama dari `apiClient.accessToken`
   - Jika token belum ready saat dashboard endpoints dipanggil, mereka semua dapat 401
   - Interceptor refresh token logic (line 637-690) coba handle, tapi:
     - Refresh mungkin gagal jika refreshToken juga belum ready
     - Atau refresh selesai tapi token belum ter-sync ke semua pending requests

2. **Interceptor Refresh Logic:**
   - Line 642: `if (currentRefreshToken && !isRefreshing)`
   - Line 680-688: Concurrent requests subscribe ke `refreshSubscribers`
   - **Issue:** Jika refresh **gagal**, semua subscribers tetap dapat 401
   - Employees API yang dipanggil **setelah** refresh gagal juga akan dapat 401

3. **Promise.allSettled Behavior:**
   - Dashboard service menggunakan `Promise.allSettled()` yang **tidak throw**
   - Tapi semua promises bisa **rejected** dengan 401
   - Store tetap set `data` dengan default values (line 138-141)
   - Employees page melihat `data` ada (tidak null), tapi `features` kosong
   - `hasRbacEmployee` menjadi `false`

**Flow:**
```
Dashboard endpoints (4x) → 401 (token not ready)
  └─ Interceptor tries refresh
     └─ Refresh might fail or not complete in time
        └─ Dashboard data = default/empty
           └─ Employees page: hasRbacEmployee = false
              └─ loadEmployees() NOT CALLED
```

---

## 🎯 Kesimpulan

**Root Cause Utama:**
1. **Token sync race condition** antara authStore hydration dan API calls
2. **Dependency chain** yang membuat employees page bergantung pada dashboard data
3. **Parallel 401s** yang tidak ter-handle dengan baik oleh refresh token logic

**Kenapa Refresh Berhasil:**
- Setelah refresh, semua state sudah fully hydrated
- Token sudah tersync dengan baik
- Dashboard data berhasil load
- `hasRbacEmployee` menjadi `true`
- `loadEmployees()` dipanggil dan berhasil

**File yang Perlu Diperbaiki (untuk reference, jangan diubah sekarang):**
1. `fe/src/stores/authStore.ts` - Pastikan token sync ke apiClient sebelum hydration complete
2. `fe/src/lib/api/apiClient.ts` - Improve token sync timing di request interceptor
3. `fe/src/app/(tenant)/employees/page.tsx` - Add fallback jika dashboard data gagal
4. `fe/src/lib/api/dashboardService.ts` - Handle 401 errors dengan lebih baik
5. `fe/src/app/(tenant)/layout.tsx` - Wait for token ready sebelum auto-fetch dashboard

---

## 📊 Summary Table

| Issue | File | Line | Severity | Impact |
|-------|------|------|----------|--------|
| Token sync race condition | `authStore.ts` | 204-244 | 🔴 High | Token tidak ready saat API calls |
| Request interceptor timing | `apiClient.ts` | 259-301 | 🔴 High | Token sync dari authStore mungkin terlambat |
| Dashboard dependency | `employees/page.tsx` | 77-87 | 🟡 Medium | Employees tidak load jika dashboard gagal |
| Parallel 401s | `dashboardService.ts` | 130-142 | 🟡 Medium | Multiple endpoints fail bersamaan |
| Refresh token logic | `apiClient.ts` | 637-690 | 🟡 Medium | Concurrent 401s tidak ter-handle dengan baik |
| Auto-fetch timing | `layout.tsx` | 26-30 | 🟡 Medium | Dashboard fetch terlalu cepat |

---

**Analisis selesai. Tidak ada perubahan kode yang dilakukan sesuai constraint.**

