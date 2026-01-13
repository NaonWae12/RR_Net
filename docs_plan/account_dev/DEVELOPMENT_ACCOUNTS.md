# RRNET Development & Test Accounts

Dokumentasi akun dummy untuk development dan testing.

---

## 🔐 Super Admin (Platform-wide)

| Field    | Value              |
| -------- | ------------------ |
| Email    | `admin@rrnet.test` |
| Password | `password`         |
| Role     | `super_admin`      |
| Tenant   | - (global)         |

**Catatan:** Super admin tidak memerlukan tenant slug saat login.

---

## 🏢 Tenant: Acme Networks

| Field     | Value                                  |
| --------- | -------------------------------------- |
| Tenant ID | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` |
| Name      | `Acme Networks`                        |
| Slug      | `acme`                                 |
| Status    | `active`                               |
| Plan      | `Pro`                                  |

### Owner Account

| Field    | Value                                  |
| -------- | -------------------------------------- |
| Email    | `owner@acme.test`                      |
| Password | `password`                             |
| Role     | `owner`                                |
| User ID  | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` |

### Login Header

```
X-Tenant-Slug: acme
```

### Employee Management (RBAC tiers)

Tenant `acme` saat ini hanya punya 1 user (owner). Untuk membuat employee (admin/hr/finance/technician/collector/client), gunakan menu **Employees** di UI (hanya muncul jika feature `rbac_employee` aktif), atau panggil API `POST /api/v1/employees` dengan header `X-Tenant-Slug`.

---

## 🏢 Tenant: BasicCo ISP

| Field     | Value                                  |
| --------- | -------------------------------------- |
| Tenant ID | `dddddddd-dddd-dddd-dddd-dddddddddddd` |
| Name      | `BasicCo ISP`                          |
| Slug      | `basicco`                              |
| Status    | `active`                               |
| Plan      | `Basic`                                |

### Owner Account

| Field    | Value                                  |
| -------- | -------------------------------------- |
| Email    | `owner@basicco.test`                   |
| Password | `password`                             |
| Role     | `owner`                                |
| User ID  | `eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee` |

### Login Header

```
X-Tenant-Slug: basicco
```

### Employee Management

Tier Basic tidak memiliki feature `rbac_employee`, jadi menu Employees tidak akan muncul dan endpoint `/api/v1/employees` akan ditolak.

---

## 🏢 Tenant: BizNet ISP

| Field     | Value                                  |
| --------- | -------------------------------------- |
| Tenant ID | `ffffffff-ffff-ffff-ffff-ffffffffffff` |
| Name      | `BizNet ISP`                           |
| Slug      | `biznet`                               |
| Status    | `active`                               |
| Plan      | `Business`                             |

### Owner Account

| Field    | Value                                  |
| -------- | -------------------------------------- |
| Email    | `owner@biznet.test`                    |
| Password | `password`                             |
| Role     | `owner`                                |
| User ID  | `44444444-4444-4444-4444-444444444444` |

### Login Header

```
X-Tenant-Slug: biznet
```

### Employee Management (RBAC tiers)

Tenant `biznet` saat ini hanya punya 1 user (owner). Buat employee via menu **Employees** atau API `POST /api/v1/employees` dengan header `X-Tenant-Slug: biznet`.

---

## 🏢 Tenant: EntCorp ISP

| Field     | Value                                  |
| --------- | -------------------------------------- |
| Tenant ID | `22222222-2222-2222-2222-222222222222` |
| Name      | `EntCorp ISP`                          |
| Slug      | `entcorp`                              |
| Status    | `active`                               |
| Plan      | `Enterprise`                           |

### Owner Account

| Field    | Value                                  |
| -------- | -------------------------------------- |
| Email    | `owner@entcorp.test`                   |
| Password | `password`                             |
| Role     | `owner`                                |
| User ID  | `33333333-3333-3333-3333-333333333333` |

### Login Header

```
X-Tenant-Slug: entcorp
```

### Employee Management (RBAC tiers)

Tenant `entcorp` saat ini hanya punya 1 user (owner). Buat employee via menu **Employees** atau API `POST /api/v1/employees` dengan header `X-Tenant-Slug: entcorp`.

## 👥 Sample Clients (Tenant: Acme)

| Client ID                              | Name     | Email            | Status |
| -------------------------------------- | -------- | ---------------- | ------ |
| `fb86cb68-6e16-432a-9cb1-996385630b01` | John Doe | john@example.com | active |

---

## 🔑 Login Examples

### Super Admin (via cURL)

```bash
curl -X POST http://localhost:9500/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rrnet.test","password":"password"}'
```

### Tenant Owner (via cURL)

```bash
curl -X POST http://localhost:9500/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: acme" \
  -d '{"email":"owner@acme.test","password":"password"}'
```

### PowerShell

```powershell
# Super Admin
$body = @{ email = 'admin@rrnet.test'; password = 'password' } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:9500/api/v1/auth/login -Method POST -Body $body -ContentType 'application/json'

# Tenant Owner
$body = @{ email = 'owner@acme.test'; password = 'password' } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:9500/api/v1/auth/login -Method POST -Body $body -ContentType 'application/json' -Headers @{ 'X-Tenant-Slug' = 'acme' }
```

---

## 📋 Plans Available

| Code         | Name       | Price (IDR) | Max Clients |
| ------------ | ---------- | ----------- | ----------- |
| `basic`      | Basic      | 150,000     | 250         |
| `pro`        | Pro        | 400,000     | 1,000       |
| `business`   | Business   | 950,000     | 5,000       |
| `enterprise` | Enterprise | 2,000,000   | Unlimited   |

---

## 🎯 Features by Plan

### Starter

- client_management
- billing_basic
- radius_basic

### Pro (includes Starter +)

- billing_full
- radius_full
- mikrotik_api
- voucher_basic
- isolir_manual
- maps_basic
- rbac_basic

### Enterprise (includes Pro +)

- voucher_full
- isolir_auto
- maps_full
- rbac_full
- wa_gateway
- payment_gateway
- hr_module
- collector_module
- technician_module
- custom_login_page
- custom_domain
- reports_advanced
- api_access
- priority_support

---

## 🔗 Quick Links

| Service      | URL                           |
| ------------ | ----------------------------- |
| Frontend     | http://localhost:3000         |
| Backend API  | http://localhost:9500         |
| Health Check | http://localhost:9500/health  |
| API Version  | http://localhost:9500/version |

---

## ⚠️ Important Notes

1. **Password hashing:** Semua password di-hash menggunakan bcrypt (cost 12)
2. **JWT Tokens:** Access token expires in 15 minutes, refresh token in 7 days
3. **Tenant Context:** API calls yang tenant-scoped wajib menyertakan `X-Tenant-Slug` header
4. **Database:** PostgreSQL running on port 15432 (mapped from container 5432)
5. **Redis:** Running on default port 6379

---

_Last updated: Phase 2 - FE_03 Dashboard Complete_
