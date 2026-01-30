## ISOLIR BACKEND - FINAL STEPS

### 1. Add Route to router.go

**File**: `BE/internal/http/router/router.go`

**Location**: After line 985 (after the toggle-status route)

**Code to add**:
```go
	// Check for toggle-isolate action: /api/v1/vouchers/{id}/toggle-isolate
	if len(parts) == 2 && parts[1] == "toggle-isolate" {
		r = setPathParam(r, "id", parts[0])
		if r.Method == http.MethodPost {
			voucherHandler.ToggleIsolate(w, r)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
```

### 2. Run Migration

```bash
cd BE
# Migration will run automatically on next server start
# Or run manually if needed
```

### 3. Test API

**Endpoint**: `POST /api/v1/vouchers/{id}/toggle-isolate`

**Test with curl**:
```bash
curl -X POST http://localhost:8080/api/v1/vouchers/{VOUCHER_ID}/toggle-isolate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "id": "...",
  "code": "abc123",
  "isolated": true,  // or false
  ...
}
```

### 4. Check Database

```sql
SELECT id, code, status, isolated FROM vouchers WHERE code = 'YOUR_CODE';
```

### 5. Next Steps (MikroTik Integration)

After basic API works, add MikroTik integration in `voucher_service.go` `ToggleIsolate` method:
- Add user to address-list "isolated"
- Disconnect active session
- Apply firewall rules

---

## Summary

**What's Done**:
- ✅ Database migration (isolated column)
- ✅ Domain model updated
- ✅ Repository method (ToggleIsolate)
- ✅ Service method (ToggleIsolate)
- ✅ HTTP handler (ToggleIsolate)
- ✅ Frontend UI (button + badge)

**What's Left**:
- ⏸️ Add route in router.go (manual - see above)
- ⏸️ Run migration
- ⏸️ Test API
- ⏸️ MikroTik integration (isolate user on router)
