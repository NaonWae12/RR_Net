# RRNET - Multi-Tenant ISP Management SaaS

RRNET is a comprehensive SaaS platform for managing Internet Service Provider (ISP) operations, built with Next.js frontend and Golang backend.

## 🎯 Project Overview

A multi-tenant SaaS system designed for RT/RW-Net and ISP operators with tiered plans (Basic, Pro, Business, Enterprise), featuring:

- **Multi-tenant architecture** with subdomain/custom domain support
- **Tier-based feature access** with add-on marketplace
- **Network management** (MikroTik API, Radius, Vouchers)
- **Billing system** (SaaS billing + end-user billing + upstream billing)
- **Maps & Topology** (ODC → ODP → Client with outage propagation)
- **HR Management** (attendance, payroll, leave)
- **Collector system** (3-phase cash flow tracking)
- **Technician tasks** (field activity logging)
- **WA Gateway** (automated notifications via Fonnte/wwebjs)
- **RBAC** (8 roles: super_admin, owner, admin, hr, finance, technician, collector, client)

## 📁 Project Structure

```
RRNET/
├── BE/                    # Backend (Golang)
│   ├── cmd/api/           # Application entrypoint
│   ├── internal/          # Private application code
│   │   ├── config/        # Configuration loader
│   │   ├── logger/        # Structured logging
│   │   ├── infra/         # Infrastructure (Postgres, Redis, Asynq)
│   │   ├── http/          # HTTP server, middlewares, router
│   │   ├── health/        # Health checks
│   │   └── version/       # Build version
│   ├── pkg/               # Public utilities
│   ├── docs/              # Backend documentation
│   └── README.md
│
├── fe/                    # Frontend (Next.js)
│   ├── src/
│   │   ├── app/           # Next.js App Router
│   │   │   ├── (auth)/    # Authentication pages
│   │   │   ├── (super-admin)/  # Super Admin panel
│   │   │   ├── (tenant)/       # Tenant admin pages
│   │   │   └── (client)/       # Client portal
│   │   ├── modules/       # Feature modules (MVVM)
│   │   ├── components/    # Shared UI components
│   │   ├── lib/           # Utilities
│   │   └── contexts/      # React Context providers
│   ├── docs/              # Frontend documentation
│   └── README.md
│
├── docs_plan/             # Project planning documents
│   ├── prompt_v4.md                      # Master force spec
│   ├── ROLE_CAPABILITY_SPEC.md           # RBAC definitions
│   ├── RRNET_EXEC_01_BACKEND_FOUNDATIONS.md
│   ├── feature_plan.md                   # Feature tier matrix
│   └── plan_build_*.md                   # Module specifications
│
└── README.md              # This file
```

## 🚀 Tech Stack

### Backend

- **Language:** Go 1.21+
- **Database:** PostgreSQL 14+
- **Cache & Queue:** Redis 6+ + Asynq
- **Architecture:** Modular block pattern
- **Logging:** Zerolog (structured JSON)

### Frontend

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Architecture:** MVVM pattern

## 🏗️ Getting Started

### Prerequisites

- **Go:** 1.21 or higher
- **Node.js:** 18+ and npm
- **PostgreSQL:** 14+
- **Redis:** 6+

### Backend Setup

```bash
cd BE

# Install dependencies
go mod download

# Set environment variables
export DATABASE_URL="postgres://user:pass@localhost:5432/rrnet?sslmode=disable"
export REDIS_ADDR="localhost:6379"
export APP_PORT="8080"

# Run server
go run cmd/api/main.go
```

Backend will be available at `http://localhost:8080`

**Available endpoints:**

- `GET /health` - Health check with service status
- `GET /version` - Build version info
- `GET /api/v1/` - API root

See [`BE/README.md`](BE/README.md) for detailed backend documentation.

### Frontend Setup

```bash
cd fe

# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your API URL

# Run development server
npm run dev
```

Frontend will be available at `http://localhost:3000`

See [`fe/README.md`](fe/README.md) for detailed frontend documentation.

## 📋 Development Status

### ✅ Phase 1: Infrastructure Foundations (COMPLETE)

**Backend:**

- [x] Go module structure
- [x] Configuration loader (env-based)
- [x] Structured logging (JSON)
- [x] PostgreSQL connection pool
- [x] Redis client
- [x] Asynq task queue setup
- [x] HTTP server with graceful shutdown
- [x] Middleware chain (request_id, recover, logger, tenant_context)
- [x] Health & version endpoints
- [x] Documentation (architecture, env reference)

**Frontend:**

- [x] Next.js App Router setup
- [x] TypeScript configuration
- [x] Tailwind CSS integration
- [x] ESLint setup
- [x] Project structure documentation (MVVM pattern)
- [x] Route group planning (auth, super-admin, tenant, client)

### 🟧 Phase 2: Core Domains (NEXT)

- [ ] Authentication (JWT, sessions, refresh tokens)
- [ ] RBAC implementation (8 roles per spec)
- [ ] Tenant lifecycle (create, suspend, domain assignment)
- [ ] Plan & add-on catalog management
- [ ] Feature toggle system

### ⬜ Phase 3: Business Modules

- [ ] Billing (SaaS + end-user + upstream)
- [ ] Network management (MikroTik API, Radius, Vouchers)
- [ ] Maps & Topology (ODC/ODP/Client with outage propagation)
- [ ] WA Gateway (Fonnte/wwebjs integration)

### ⬜ Phase 4: Advanced Modules

- [ ] HR (employees, attendance, payroll)
- [ ] Collector (3-phase cash flow)
- [ ] Technician (tasks, activity logging)
- [ ] Reports & Analytics

## 🎭 Roles & Permissions

See [`docs_plan/ROLE_CAPABILITY_SPEC.md`](docs_plan/ROLE_CAPABILITY_SPEC.md) for complete RBAC specifications.

**Roles:**

- **super_admin** - Global SaaS platform control
- **owner** - Full tenant access + finance
- **admin** - Tenant operations (no SaaS billing)
- **hr** - Employee management, attendance, payroll
- **finance** - Billing, invoices, reports
- **technician** - Maps, field tasks, activity logs
- **collector** - Cash collection with 3-phase flow
- **client** - End-user portal (view/pay invoices)

## 📦 Feature Tiers

See [`docs_plan/feature_plan.md`](docs_plan/feature_plan.md) for complete feature matrix.

| Tier           | Price | Max Routers | Max Users | Key Features                                            |
| -------------- | ----- | ----------- | --------- | ------------------------------------------------------- |
| **Basic**      | 150k  | 2           | 250       | Radius Basic, MikroTik Basic, Manual Isolir             |
| **Pro**        | 400k  | 5           | 1,000     | + MikroTik Advanced, RBAC, Auto Isolir, Payment Gateway |
| **Business**   | 950k  | 10          | 5,000     | + Maps (100 ODP, 600 Client), Advanced Reporting        |
| **Enterprise** | 2jt+  | Unlimited   | Unlimited | + Multi-tenant Super Admin, HA, White-label, AI Agent   |

## 🛠️ Architecture

### Backend: Modular Block Architecture

Each feature is a self-contained module with:

- **Handler** - HTTP request handling
- **Service** - Business logic
- **Repository** - Data access
- **Model** - Domain entities
- **Events** - Event definitions for async flows

### Frontend: MVVM Pattern

- **Model** - TypeScript interfaces/types
- **View** - React components (presentation)
- **ViewModel** - Custom hooks (logic + state)
- **Service** - API communication layer

### Multi-Tenant Strategy

- **Tenant identification:** Subdomain (`tenant.rrnet.id`) or custom domain
- **Data isolation:** Row-level security with `tenant_id` on all tables
- **Super admin privacy:** No access to tenant internal logs/PII

### Event Bus (Asynq)

Async operations via Redis-backed queues:

- `default` - General background tasks
- `billing` - Invoice processing, payment reconciliation
- `notification` - WA notifications, email alerts

## 📖 Documentation

- [`BE/docs/ARCHITECTURE.md`](BE/docs/ARCHITECTURE.md) - Backend architecture details
- [`BE/docs/ENV_REFERENCE.md`](BE/docs/ENV_REFERENCE.md) - Environment variables guide
- [`fe/docs/STRUCTURE.md`](fe/docs/STRUCTURE.md) - Frontend structure & MVVM guide
- [`docs_plan/prompt_v4.md`](docs_plan/prompt_v4.md) - Master force specification
- [`docs_plan/ROLE_CAPABILITY_SPEC.md`](docs_plan/ROLE_CAPABILITY_SPEC.md) - RBAC spec

## 🔒 Security

- **Authentication:** JWT with HTTP-only cookies (future)
- **Authorization:** Role-based access control (8 roles)
- **Data privacy:** Super admin cannot access tenant-internal logs
- **Encryption:** Secrets encrypted at rest, TLS in transit
- **Rate limiting:** Per-tenant API rate limits (future)

## 🧪 Testing

### Backend

```bash
cd BE
go test ./...
```

### Frontend

```bash
cd fe
npm test
```

## 🐳 Docker (Future)

Docker Compose setup will be provided in Phase 2 for local development with:

- Backend service
- PostgreSQL
- Redis
- Frontend dev server

## 📝 Contributing

1. Follow existing code structure and patterns
2. Backend: Use `gofmt` and `golangci-lint`
3. Frontend: Use ESLint and Prettier
4. Write clear commit messages
5. Add TODO comments for incomplete features
6. Update documentation when adding features

## 📄 License

Proprietary - All rights reserved

## 🙏 Acknowledgments

Built following best practices from:

- 12-factor app methodology
- Domain-driven design principles
- MVVM architecture pattern
- Multi-tenant SaaS design patterns

---

**Current Status:** ✅ Phase 1 Complete - Infrastructure foundations ready for business logic implementation.

**Next Step:** See [`docs_plan/RRNET_EXEC_02_*`](docs_plan/) for next execution phase specifications.
