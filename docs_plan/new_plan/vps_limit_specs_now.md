# Server Scaling & Capacity Plan (March 2026)

> [!NOTE]
> This document summarizes the discussion regarding server capacity and scaling for the ERP_NET system.

## 🖥️ Current Server Specifications (VPS)
- **CPU:** 4 vCPU cores
- **RAM:** 16 GB RAM
- **Storage:** 200 GB NVMe Disk Space
- **Deployment Mode:** Docker Recommended (for seamless migration)

---

## 📊 Capacity & Limitations

### 1. Initial Planned Load
- **Total Tenants:** 15 Tenants
- **Clients per Tenant:** 5,000 Clients
- **Total Estimated Records:** 75,000 Active Vouchers/Clients
- **Status:** **SAFE** (Extremely comfortable for the current Go + PostgreSQL stack).

### 2. Comfortable Maximum (Safe Peak)
- **Voucher/Client Limit:** **150,000 - 200,000** Active records.
- **Reasoning:** 
  - 16GB RAM can comfortably hold the database indexes for ~200k records in memory (Hot data).
  - 4 vCPUs can handle the RADIUS authentication overhead for this amount of concurrency, provided login attempts are naturally distributed.
- **Scaling Trigger:** If active records exceed **200,000**, it is recommended to upgrade to 8 vCPU / 32GB RAM or separate the Database server.

### 3. VPN & Router Connectivity
- **Router Limit:** 15+ Routers (handled efficiently via Go goroutines).
- **Optimization:** Use **FQDN (Domain Name)** instead of raw IP for RADIUS settings in MikroTik to ensure seamless migration between servers without manual reconfiguration.

---

## 🧹 Maintenance Policy (Auto-Cleanup)
- **Voucher Hard Delete:** Vouchers with status `expired` will be permanently deleted from the database after **2 months (60 days)**.
- **Reason:** To keep database indexes lean and maintain high performance for real-time RADIUS queries.
- **Scheduler:** Runs daily at **01:15 AM**.

---

## 🚀 Migration Strategy
- **Isolation:** Project must use **Docker/Docker Compose** for consistent environments.
- **Continuity:** Use **DNS (Cloudflare recommended)** to abstract the server IP.
- **Seamless Upgrade:** Migration plan involves setting up a Standby database (Replica) on the new server before promoting it to Master, ensuring zero data loss and minimal client disruption.
