# RRNET Local Accounts & Ports

## Running Ports

- **Frontend (Next.js):** `3000` - http://localhost:3000
- **Backend API:** `9500` - http://localhost:9500
- **PostgreSQL:** `15432` (container `rrnet-postgres`)
- **Redis:** `6379` (container `rrnet-redis`)

## Seeded Accounts

- Super Admin: `admin@rrnet.test` / `password`
- Tenant Owner (tenant `acme`): `owner@acme.test` / `password`
  - Tenant slug: `acme`
  - Plan: `Pro` (assigned via API)

## Usage Notes

- Tenant login requires slug context via header `X-Tenant-Slug: acme` (or matching subdomain).
- Super admin login does not require tenant slug.

---

## 📡 API Endpoints Summary

### Auth

- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get current user (protected)
- `POST /api/v1/auth/change-password` - Change password (protected)

### Plans (Admin)

- `GET /api/v1/plans` - List all plans
- `POST /api/v1/plans` - Create plan
- `GET /api/v1/plans/{id}` - Get plan by ID
- `PUT /api/v1/plans/{id}` - Update plan
- `DELETE /api/v1/plans/{id}` - Delete plan
- `POST /api/v1/tenants/{id}/plan` - Assign plan to tenant

### Addons (Admin)

- `GET /api/v1/addons` - List all addons
- `POST /api/v1/addons` - Create addon
- `GET /api/v1/addons/{id}` - Get addon by ID
- `PUT /api/v1/addons/{id}` - Update addon
- `DELETE /api/v1/addons/{id}` - Delete addon
- `POST /api/v1/tenants/{id}/addons` - Assign addon to tenant

### Tenant Features/Limits (Protected)

- `GET /api/v1/my/plan` - Get tenant's current plan
- `GET /api/v1/my/features` - Get tenant's feature availability
- `GET /api/v1/my/limits` - Get tenant's limits
- `GET /api/v1/my/addons` - Get tenant's addons
- `GET /api/v1/check/feature?feature={code}` - Check feature availability
- `GET /api/v1/check/limit?limit={name}&current={n}` - Check limit status

### Clients (Protected, Tenant-scoped)

- `GET /api/v1/clients` - List clients (supports ?search, ?status, ?page, ?page_size)
- `POST /api/v1/clients` - Create client
- `GET /api/v1/clients/stats` - Get client statistics
- `GET /api/v1/clients/{id}` - Get client by ID
- `PUT /api/v1/clients/{id}` - Update client
- `PATCH /api/v1/clients/{id}/status` - Change client status (isolir/activate)
- `DELETE /api/v1/clients/{id}` - Soft delete client
- `GET /api/v1/clients/{id}/invoices` - Get client pending invoices
- `POST /api/v1/clients/{id}/invoices/generate` - Generate monthly invoice

### Network (Protected, Tenant-scoped)

- `GET /api/v1/network/routers` - List routers
- `POST /api/v1/network/routers` - Create router
- `GET /api/v1/network/routers/{id}` - Get router
- `PUT /api/v1/network/routers/{id}` - Update router
- `DELETE /api/v1/network/routers/{id}` - Delete router
- `GET /api/v1/network/profiles` - List network profiles
- `POST /api/v1/network/profiles` - Create profile
- `GET /api/v1/network/profiles/{id}` - Get profile
- `PUT /api/v1/network/profiles/{id}` - Update profile
- `DELETE /api/v1/network/profiles/{id}` - Delete profile

### Billing (Protected, Tenant-scoped)

- `GET /api/v1/billing/invoices` - List invoices (?client_id, ?status, ?page)
- `POST /api/v1/billing/invoices` - Create invoice
- `GET /api/v1/billing/invoices/{id}` - Get invoice
- `GET /api/v1/billing/invoices/{id}/payments` - Get invoice payments
- `POST /api/v1/billing/invoices/{id}/cancel` - Cancel invoice
- `GET /api/v1/billing/invoices/overdue` - Get overdue invoices
- `GET /api/v1/billing/payments` - List payments (?client_id, ?method, ?page)
- `POST /api/v1/billing/payments` - Record payment
- `GET /api/v1/billing/payments/{id}` - Get payment
- `GET /api/v1/billing/summary` - Get billing summary
