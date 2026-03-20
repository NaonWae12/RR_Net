# 🚀 RR-NET Architecture Scaling Plan
**Objective**: Optimize RADIUS system performance to handle 100,000+ to 1,000,000+ active users with minimal latency and high database efficiency.

---

## 🏗️ Phase 1: High-Speed Write Buffering (Redis)
**Problem**: Each MikroTik sends an `Accounting Interim-Update` every 60 seconds. At 1M users, this means ~16,666 writes/second to PostgreSQL, which will cause I/O wait and database locks.

### 💡 Solution: The "Redis Buffer" Strategy
Instead of writing directly to PostgreSQL, use **Redis Atomic Increments**.

1. **Incoming Request**: RADIUS Handler receives accounting data.
2. **Immediate Store**: Data is saved to Redis keys:
   - `accounting:uptime:{voucher_id}` (Counter)
   - `accounting:bytes_in:{voucher_id}` (Counter)
   - `accounting:bytes_out:{voucher_id}` (Counter)
3. **Response**: RADIUS returns `HTTP 204` immediately (Sub-millisecond).
4. **Sync Worker**: A background routine (cron-like) pulls data from Redis every 5 minutes and performs a **Bulk Update** to PostgreSQL.

---

## ⚡ Phase 2: Denormalization for Instant Reads
**Problem**: Calculating `SUM(uptime_seconds)` from millions of rows in `radius_sessions` every time a user opens the "Voucher List" is extremely slow.

### 💡 Solution: Cached Aggregates in `vouchers` Table
Add physical summary columns to the `vouchers` table:
- `total_uptime` (Integer)
- `total_bytes_used` (BigInt)

**Logic**: 
- Update these columns periodically via the Sync Worker.
- Reading "Voucher List" becomes a simple `SELECT` without `SUM()` or `JOIN`, making it instant even with millions of records.

---

## 🧹 Phase 3: Database Partitioning (Data Lifecycle)
**Problem**: The `radius_sessions` table grows exponentially, slowing down every query related to it.

### 💡 Solution: Time-Based Partitioning
Divide the `radius_sessions` table by month using PostgreSQL Native Partitioning:
- `radius_sessions_2026_03`
- `radius_sessions_2026_04`
- ...
**Benefits**: Older data can be detached or moved to cheaper storage (Cold Storage) without affecting the speed of active sessions.

---

## 🛡️ Phase 4: API & RADIUS Security Tuning
1. **Redis Rate Limiting**: Block NAS IPs that flood requests beyond reasonable limits.
2. **Idle Session Auto-Kill**: If Redis hasn't received an update for X minutes (NAS went offline), mark the session as "Stale" automatically to free up resources.
3. **Connection Pooling Optimization**: Tuned specifically for high-frequency short-lived API calls from FreeRADIUS `rlm_rest`.

---

## 📈 Projected Scale
| Metric | Current (PostgreSQL Only) | Scaled (Redis + Denorm) |
| :--- | :--- | :--- |
| **Max Concurrent Users** | ~5,000 - 10,000 | **1,000,000+** |
| **Accounting Write Latency** | 20ms - 100ms | **1ms - 3ms** |
| **Voucher List Read Time** | Sub-second (Low data) -> Seconds (High data) | **Sub-millisecond** (Constant) |

---
> [!IMPORTANT]
> This plan is to be implemented when active concurrent sessions exceed **50,000** or when dashboard load time exceeds **2 seconds**.
