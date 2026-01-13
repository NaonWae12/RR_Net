# Super Admin Dashboard - Overview

## Halaman Super Admin Dashboard (`/superadmin`)

Halaman ini menampilkan overview sistem secara keseluruhan untuk super admin.

### Komponen yang Ditampilkan:

#### 1. **Quick Actions Cards** (4 cards di bagian atas)
- **Manage Tenants**: Menampilkan jumlah total tenants, link ke `/superadmin/tenants`
- **Manage Plans**: Menampilkan jumlah total plans, link ke `/superadmin/plans`
- **Manage Addons**: Menampilkan jumlah total addons, link ke `/superadmin/addons`
- **System Monitoring**: Link ke `/superadmin/monitoring`

#### 2. **System Health Card** (Kiri atas)
Menampilkan:
- Overall health score (0-100)
- Status services:
  - API Server (uptime %)
  - Database (uptime %)
  - Redis (uptime %)
  - Worker Queue (uptime %)
- Resource usage:
  - CPU usage (%)
  - Memory usage (%)
  - Disk usage (%)

**Note**: Saat ini menggunakan mock data. Akan diintegrasikan dengan backend monitoring API.

#### 3. **Tenant Metrics Card** (Kanan atas)
Menampilkan:
- Total tenants
- Active tenants
- Suspended tenants
- Growth percentage (vs previous period)
- Plan distribution chart (pie chart)
- Growth trend chart (line chart, 12 bulan)

**Note**: Data diambil dari store. Jika belum ada tenant, akan menampilkan 0 dengan chart kosong.

#### 4. **Revenue Chart** (Full width)
Menampilkan:
- Monthly revenue chart (12 bulan terakhir)
- Breakdown: Plan revenue vs Addon revenue
- Total revenue
- Growth percentage

**Note**: Saat ini menggunakan mock data. Akan diintegrasikan dengan billing API.

#### 5. **Alert Summary Card** (Kiri bawah)
Menampilkan:
- Total alerts
- Breakdown: Critical, Warning, Info
- Recent alerts list dengan:
  - Type (critical/warning/info)
  - Title
  - Message
  - Timestamp
  - Source

**Note**: Saat ini menggunakan mock data. Akan diintegrasikan dengan monitoring API.

#### 6. **Recent Activities** (Kanan bawah)
Menampilkan timeline aktivitas terbaru:
- Tenant creation/updates
- Plan changes
- System events
- User actions

Setiap activity menampilkan:
- Type (tenant/plan/system)
- Action description
- User yang melakukan
- Target (tenant/plan name)
- Timestamp
- Status (success/failed)

**Note**: Saat ini menggunakan mock data. Akan diintegrasikan dengan audit log API.

---

## Behavior saat Data Kosong

Dashboard dirancang untuk tetap menampilkan semua komponen meskipun belum ada data:

- **Tenants = 0**: Quick action card menampilkan "0", metrics menampilkan 0 untuk semua nilai, chart menampilkan garis datar di 0
- **Plans = 0**: Quick action card menampilkan "0", plan distribution menampilkan "No plans yet"
- **Addons = 0**: Quick action card menampilkan "0"
- **System Health**: Selalu menampilkan mock data (95% score, semua services healthy)
- **Revenue**: Selalu menampilkan mock data (chart dengan data dummy)
- **Alerts**: Selalu menampilkan mock data (5 alerts)
- **Activities**: Selalu menampilkan mock data (3 activities)

---

## Integrasi Backend (TODO)

Komponen berikut perlu diintegrasikan dengan backend API:

1. **System Health**: `GET /api/v1/superadmin/system/health`
2. **Tenant Metrics**: `GET /api/v1/superadmin/metrics/tenants`
3. **Revenue Data**: `GET /api/v1/superadmin/metrics/revenue`
4. **Alerts**: `GET /api/v1/superadmin/alerts`
5. **Activities**: `GET /api/v1/superadmin/activities`

---

## Loading States

Semua komponen menampilkan loading spinner saat:
- Initial data fetch
- Refresh data
- API calls sedang berjalan

---

*Last updated: Phase 5 - FE_11 Super Admin Complete*

