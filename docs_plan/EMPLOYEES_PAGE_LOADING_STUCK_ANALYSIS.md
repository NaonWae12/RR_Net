# 🔍 Employees Page Loading Stuck - Analysis Report

## 📋 Summary

**Issue**: Employees page kadang stuck di loading state, tidak pernah selesai load data. Masalah ini jarang terjadi dan susah di-reproduce.

**Frequency**: Intermittent (jarang terjadi)

**Symptoms**:
- Loading spinner terus berputar
- Data tidak pernah muncul
- Tidak ada error message
- Refresh browser atau tunggu beberapa saat → normal lagi

---

## 🔎 Root Cause Analysis (Ranked by Likelihood)

### 1. ⚠️ **API Request Hanging / Never Resolves** (HIGH PROBABILITY)

**Problem**:
- `apiClient` punya timeout 10 detik, tapi jika request hang atau tidak pernah resolve/reject, `loadEmployees()` akan stuck di `await`
- Loading state di-set `true` di awal, tapi tidak pernah di-set `false` karena promise tidak resolve/reject

**Code Location**:
```typescript
// fe/src/app/(tenant)/employees/page.tsx:66-77
const loadEmployees = async () => {
  setLoading(true);  // ← Set true
  try {
    const res = await employeeService.list();  // ← Jika ini hang, loading tetap true
    setEmployees(res.data ?? []);
  } catch (err: any) {
    // Error handling
  } finally {
    setLoading(false);  // ← Tidak pernah tercapai jika await hang
  }
};
```

**Possible Causes**:
- Network timeout yang tidak di-handle oleh axios interceptor
- Server tidak response (hang di server side)
- CORS preflight hang
- Browser network stack issue

**Evidence**:
- Timeout di apiClient: `timeout: 10000` (10 detik)
- Jika request hang lebih dari 10 detik, axios seharusnya reject dengan `ECONNABORTED`
- Tapi jika request hang di level network stack (sebelum axios timeout), bisa stuck

---

### 2. ⚠️ **Race Condition: Multiple Concurrent Calls** (MEDIUM PROBABILITY)

**Problem**:
- `useEffect` dengan empty deps `[]` seharusnya hanya run sekali, tapi:
  - React Strict Mode di development bisa double-invoke
  - Component re-mount bisa trigger multiple calls
  - Tidak ada guard untuk prevent concurrent calls

**Code Location**:
```typescript
// fe/src/app/(tenant)/employees/page.tsx:61-64
useEffect(() => {
  loadEmployees();  // ← Bisa dipanggil multiple times
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Possible Scenario**:
1. First call: `setLoading(true)` → API call started
2. Second call (concurrent): `setLoading(true)` lagi → API call kedua started
3. First call resolve → `setLoading(false)`
4. Second call masih pending → tapi loading sudah false
5. Jika second call hang → tidak ada loading indicator, tapi data tidak update

**Evidence**:
- Tidak ada guard seperti `if (loading) return;` di `loadEmployees()`
- ClientStore dan NetworkStore punya guard untuk prevent concurrent calls, tapi Employees page tidak

---

### 3. ⚠️ **Interceptor Retry Logic Race Condition** (MEDIUM PROBABILITY)

**Problem**:
- Interceptor punya complex retry logic dengan refresh token
- Jika ada race condition di refresh token flow, request bisa stuck di retry loop

**Code Location**:
```typescript
// fe/src/lib/api/apiClient.ts:652-718
if (status === 401 && !originalRequest._retry && refreshTokenCallback && getRefreshTokenCallback) {
  originalRequest._retry = true;
  // ... refresh logic
  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshSubscribers.push(() => {
        // ← Jika refreshSubscribers tidak pernah trigger, promise tidak resolve
        resolve(apiClient(originalRequest));
      });
    });
  }
}
```

**Possible Scenario**:
1. Request dapat 401
2. Trigger refresh token
3. `isRefreshing = true`, request masuk ke `refreshSubscribers` queue
4. Refresh token gagal atau hang
5. `refreshSubscribers` tidak pernah trigger
6. Promise tidak pernah resolve/reject → stuck

**Evidence**:
- Ada `refreshSubscribers` queue yang bisa stuck jika refresh gagal
- `isRefreshing` flag bisa stuck di `true` jika refresh error tidak di-handle dengan benar

---

### 4. ⚠️ **Token Not Ready When API Called** (LOW-MEDIUM PROBABILITY)

**Problem**:
- Employees page load langsung di mount, tidak menunggu `authStore.ready`
- Jika token belum ready saat API call, bisa dapat 401
- Interceptor retry logic bisa hang jika token tidak ready

**Code Location**:
```typescript
// fe/src/app/(tenant)/employees/page.tsx:61-64
useEffect(() => {
  loadEmployees();  // ← Tidak check authStore.ready
}, []);
```

**Possible Scenario**:
1. Page mount → `loadEmployees()` dipanggil
2. Token belum ready (masih di hydration/refresh)
3. API call dapat 401
4. Interceptor coba refresh, tapi refresh juga belum ready
5. Request stuck di retry loop

**Evidence**:
- Dashboard fetch menunggu `authStore.ready`, tapi Employees tidak
- Employees page decoupled dari dashboard, jadi tidak ada guard untuk auth ready

---

### 5. ⚠️ **Error Handling Edge Case** (LOW PROBABILITY)

**Problem**:
- Jika error tidak di-throw sebagai standard Error/ApiError, catch block mungkin tidak handle dengan benar
- Loading state tidak di-set false di semua error paths

**Code Location**:
```typescript
// fe/src/app/(tenant)/employees/page.tsx:66-77
const loadEmployees = async () => {
  setLoading(true);
  try {
    const res = await employeeService.list();
    setEmployees(res.data ?? []);
  } catch (err: any) {
    const msg = err?.response?.data?.error ?? 'Failed to load employees';
    showToast({ title: 'Error', description: msg, variant: 'error' });
    // ← Loading di-set false di finally, tapi jika ada edge case...
  } finally {
    setLoading(false);
  }
};
```

**Possible Scenario**:
- Jika `employeeService.list()` throw non-standard error atau hang
- finally block seharusnya tetap execute, tapi jika ada React rendering issue, bisa stuck

---

## 🧪 Testing & Verification

### Test Cases to Reproduce

1. **Network Timeout Test**:
   - Simulate slow network (throttle di DevTools)
   - Navigate to `/employees`
   - Check jika loading stuck

2. **Concurrent Call Test**:
   - Add console.log di `loadEmployees()`
   - Check jika dipanggil multiple times
   - Monitor loading state changes

3. **Token Ready Test**:
   - Clear localStorage
   - Login fresh
   - Immediately navigate to `/employees` (before dashboard ready)
   - Check jika loading stuck

4. **Refresh Token Race Test**:
   - Simulate 401 response
   - Check interceptor retry logic
   - Monitor `refreshSubscribers` queue

---

## 🔧 Recommended Fixes

### Fix 1: Add Timeout Safety Net (HIGH PRIORITY)

```typescript
const loadEmployees = async () => {
  setLoading(true);
  try {
    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 15000); // 15s safety net
    });
    
    const res = await Promise.race([
      employeeService.list(),
      timeoutPromise
    ]);
    
    setEmployees(res.data ?? []);
  } catch (err: any) {
    const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to load employees';
    showToast({ title: 'Error', description: msg, variant: 'error' });
  } finally {
    setLoading(false); // Always set false
  }
};
```

### Fix 2: Add Concurrent Call Guard (HIGH PRIORITY)

```typescript
const loadEmployees = async () => {
  // Prevent concurrent calls
  if (loading) {
    return; // Already loading, skip
  }
  
  setLoading(true);
  try {
    const res = await employeeService.list();
    setEmployees(res.data ?? []);
  } catch (err: any) {
    const msg = err?.response?.data?.error ?? 'Failed to load employees';
    showToast({ title: 'Error', description: msg, variant: 'error' });
  } finally {
    setLoading(false);
  }
};
```

### Fix 3: Wait for Auth Ready (MEDIUM PRIORITY)

```typescript
useEffect(() => {
  const { ready } = useAuthStore.getState();
  if (ready) {
    loadEmployees();
  } else {
    // Wait for auth ready
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state.ready && !loading) {
        loadEmployees();
        unsubscribe();
      }
    });
    return () => unsubscribe();
  }
}, []);
```

### Fix 4: Improve Error Handling (MEDIUM PRIORITY)

```typescript
const loadEmployees = async () => {
  setLoading(true);
  try {
    const res = await employeeService.list();
    setEmployees(res.data ?? []);
  } catch (err: any) {
    // Better error handling
    let errorMessage = 'Failed to load employees';
    if (err?.response?.data?.error) {
      errorMessage = err.response.data.error;
    } else if (err?.message) {
      errorMessage = err.message;
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }
    showToast({ title: 'Error', description: errorMessage, variant: 'error' });
  } finally {
    // Always set loading false, even if error
    setLoading(false);
  }
};
```

### Fix 5: Add Request Cancellation (LOW PRIORITY)

```typescript
useEffect(() => {
  const abortController = new AbortController();
  
  const load = async () => {
    setLoading(true);
    try {
      const res = await employeeService.list();
      if (!abortController.signal.aborted) {
        setEmployees(res.data ?? []);
      }
    } catch (err: any) {
      if (!abortController.signal.aborted) {
        // Handle error
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  };
  
  load();
  
  return () => {
    abortController.abort();
  };
}, []);
```

---

## 📊 Impact Assessment

### Current Behavior
- ✅ Most of the time: Works fine
- ❌ Rarely: Loading stuck, no error message
- ✅ After refresh/wait: Normal again

### After Fixes
- ✅ More reliable: Timeout safety net prevents infinite loading
- ✅ Better UX: Concurrent call guard prevents duplicate requests
- ✅ Clearer errors: Better error messages help debug
- ⚠️ Potential side effects: Minimal (backward compatible)

---

## 🎯 Priority Recommendations

1. **IMMEDIATE**: Add concurrent call guard (Fix 2)
   - Simple, low risk
   - Prevents duplicate requests
   - Similar pattern sudah dipakai di ClientStore/NetworkStore

2. **HIGH**: Add timeout safety net (Fix 1)
   - Prevents infinite loading
   - Better error messages
   - User experience improvement

3. **MEDIUM**: Wait for auth ready (Fix 3)
   - Prevents 401 retry loops
   - More consistent with dashboard pattern
   - But might delay initial load slightly

4. **LOW**: Request cancellation (Fix 5)
   - Nice to have
   - Prevents memory leaks
   - Better cleanup on unmount

---

## 📝 Notes

- Masalah ini **intermittent** dan susah di-reproduce, jadi fix harus defensive
- Kombinasi beberapa fixes akan lebih robust
- Monitor setelah fix untuk verify tidak ada regresi
- Consider adding logging untuk debug future issues

---

**Analysis Date**: 2024-01-XX  
**Analyst**: AI Assistant  
**Status**: Analysis Complete - Awaiting Implementation Decision

