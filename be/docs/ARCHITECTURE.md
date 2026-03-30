# RRNET Backend Architecture

## Overview

RRNET backend implements a **modular block architecture** where each feature/domain is self-contained with clear boundaries and interfaces. Built with Go, optimized for multi-tenant SaaS operations.

## Tech Stack

- **Language:** Go 1.21+
- **Database:** PostgreSQL 14+ (pgx/v5 with connection pooling)
- **Cache:** Redis 6+
- **Queue:** Asynq (Redis-based background jobs)
- **Logging:** Zerolog (structured JSON logging)
- **HTTP:** Native net/http with custom middleware chain

## Architecture Principles

1. **Modular Blocks:** Each feature is a self-contained module
2. **Repository Pattern:** Data access abstracted through repositories
3. **Event-Driven:** Async operations via Asynq event bus
4. **Domain Layer:** Clear separation of domain logic from infrastructure
5. **Multi-Tenant:** Tenant isolation at database and application level
6. **Fail-Fast:** Configuration validation on startup

## Directory Structure

```
BE/
├── cmd/
│   └── api/                    # Application entrypoint
│       └── main.go            # Server bootstrap
│
├── internal/                   # Private application code
│   ├── config/                # Configuration management
│   │   └── config.go          # Env loader with validation
│   │
│   ├── logger/                # Logging infrastructure
│   │   └── logger.go          # Zerolog setup
│   │
│   ├── infra/                 # Infrastructure clients
│   │   ├── postgres/          # PostgreSQL pool
│   │   ├── redis/             # Redis client
│   │   └── asynq/             # Asynq queue setup
│   │
│   ├── http/                  # HTTP layer
│   │   ├── server/            # HTTP server + graceful shutdown
│   │   ├── middleware/        # Request middleware
│   │   │   ├── request_id.go  # Request ID injection
│   │   │   ├── recover.go     # Panic recovery
│   │   │   ├── logger.go      # Request logging
│   │   │   └── tenant.go      # Tenant context extraction
│   │   └── router/            # Route definitions
│   │
│   ├── domain/                # Business domains (FUTURE)
│   │   ├── auth/              # Authentication & sessions
│   │   ├── tenant/            # Tenant lifecycle
│   │   ├── billing/           # SaaS + end-user billing
│   │   ├── plan/              # Plans & add-ons
│   │   ├── network/           # MikroTik, Radius, Vouchers
│   │   ├── maps/              # ODC/ODP/Client topology
│   │   ├── communication/     # WA Gateway
│   │   ├── hr/                # HR, attendance, payroll
│   │   ├── collector/         # Collector 3-phase flow
│   │   └── technician/        # Technician tasks & activity
│   │
│   ├── version/               # Build version info
│   └── health/                # Health check logic
│
├── pkg/                       # Public/shared utilities
│   └── utils/                 # Common helpers
│
├── migrations/                # Database migrations (FUTURE)
├── docs/                      # Architecture documentation
├── go.mod                     # Go module definition
└── go.sum                     # Dependency checksums
```

## Module Design Pattern

Each domain module follows this structure:

```
internal/domain/<module>/
├── handler.go          # HTTP handlers
├── service.go          # Business logic
├── repository.go       # Data access
├── model.go            # Domain models
├── dto.go              # DTOs for API contracts
├── validator.go        # Input validation
└── events.go           # Event definitions
```

## Middleware Chain

Requests flow through middlewares in this order:

1. **RequestID** - Injects unique request identifier
2. **RecoverPanic** - Recovers from panics, logs error
3. **RequestLogger** - Logs all HTTP requests (method, path, duration, status)
4. **TenantContext** - Extracts tenant subdomain from Host header

Additional middleware (to be added):
- **Auth** - JWT validation
- **RBAC** - Role-based access control
- **RateLimit** - Per-tenant rate limiting

## Multi-Tenant Strategy

### Tenant Identification
- Subdomain-based: `{tenant}.rrnet.id`
- Custom domain support: `custom-domain.com`
- Tenant context extracted in middleware, stored in request context

### Data Isolation
- **Row-level security:** All tables include `tenant_id`
- **Query filtering:** Repository layer enforces tenant_id filters
- **Super Admin isolation:** Super admin cannot access tenant-internal logs

## Event Bus (Asynq)

### Queue Structure
- `default` - General background tasks
- `billing` - Billing & invoice processing
- `notification` - WA notifications, emails

### Event Flow Example
```
Invoice Created
  → Emit billing_event
  → Enqueue WA notification job
  → Worker sends WA via adapter
  → Log result
```

## Database Strategy

### Connection Pooling
- Max connections: 25
- Min connections: 5
- Health check period: 1 minute
- Connection lifetime: 1 hour
- Idle timeout: 30 minutes

### Migration Strategy (FUTURE)
- Tool: golang-migrate or goose
- Versioned migrations in `migrations/` folder
- Applied on startup or via CLI command

## Logging Standards

### Structured Logging
All logs are JSON-formatted with fields:
- `timestamp` - RFC3339
- `level` - debug/info/warn/error/fatal
- `message` - Human-readable message
- `request_id` - Request identifier (if in HTTP context)
- `tenant_id` - Tenant identifier (if available)

### Log Levels
- **Debug:** Development info (disabled in production)
- **Info:** Normal operations (requests, connections)
- **Warn:** Recoverable issues (retry, degraded)
- **Error:** Failures requiring attention
- **Fatal:** Unrecoverable errors (exit process)

## Error Handling

### HTTP Errors
```go
type ErrorResponse struct {
    Error   string `json:"error"`
    Code    string `json:"code,omitempty"`
    Details any    `json:"details,omitempty"`
}
```

### Error Codes (FUTURE)
- `AUTH_INVALID` - Invalid credentials
- `TENANT_NOT_FOUND` - Tenant does not exist
- `PLAN_LIMIT_EXCEEDED` - Feature limit reached
- `BILLING_OVERDUE` - Payment required

## Configuration

### Environment Variables
All configuration via environment variables (12-factor app):
- `APP_ENV` - Environment (development/production)
- `APP_PORT` - HTTP port
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_ADDR` - Redis address
- `REDIS_PASSWORD` - Redis password
- `REDIS_DB` - Redis database number

### Validation
- Required vars: Fail-fast on startup if missing
- Optional vars: Use sensible defaults
- Type validation: Parse and validate on load

## Security Considerations

### Authentication (FUTURE)
- JWT tokens with refresh token rotation
- Token stored in HTTP-only cookies
- CSRF protection for state-changing operations

### RBAC (FUTURE)
Roles per `ROLE_CAPABILITY_SPEC.md`:
- `super_admin` - Global SaaS control
- `owner` - Full tenant access
- `admin` - Tenant operations (no SaaS billing)
- `hr` - HR & payroll
- `finance` - Billing & reports
- `technician` - Maps & field tasks
- `collector` - Cash collection flow
- `client` - End-user portal

### Data Privacy
- Super admin **cannot** access:
  - Tenant payment history details
  - Collector logs
  - Internal HR records
  - Customer PII
- All sensitive data encrypted at rest
- API keys/secrets stored in env or vault

## Performance Optimization

### Database
- Connection pooling with health checks
- Prepared statements for repeated queries
- Indexes on tenant_id + frequently queried fields
- Read replicas for reporting queries (future)

### Caching
- Redis for session storage
- Cache tenant metadata (plan limits, features)
- Cache-aside pattern with TTL

### Async Operations
- Long-running tasks moved to Asynq workers
- Billing calculations
- WA message sending
- Report generation
- Outage propagation

## Observability (FUTURE)

### Metrics
- Prometheus metrics exported at `/metrics`
- Key metrics:
  - HTTP request duration histogram
  - Database query duration
  - Active connections
  - Queue depth
  - Error rate by endpoint

### Tracing
- Distributed tracing with OpenTelemetry
- Trace propagation across services

### Alerting
- Critical alerts: Database down, Redis down
- Warning alerts: High error rate, slow queries

## Development Workflow

### Running Locally
```bash
# Set environment variables
export DATABASE_URL="postgres://user:pass@localhost:5432/rrnet"
export REDIS_ADDR="localhost:6379"

# Run server
go run cmd/api/main.go
```

### Testing Strategy (FUTURE)
- Unit tests: Pure business logic
- Integration tests: Database operations
- E2E tests: Full API flows
- Mock external dependencies (MikroTik API, WA providers)

### Code Standards
- `gofmt` for formatting
- `golangci-lint` for linting
- Clear error messages
- TODO comments for future work
- No premature optimization

## Deployment (FUTURE)

### Build
```bash
go build -o rrnet-api cmd/api/main.go
```

### Docker
```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o rrnet-api cmd/api/main.go

FROM alpine:latest
COPY --from=builder /app/rrnet-api /usr/local/bin/
CMD ["rrnet-api"]
```

### Environment
- Production: Load env from secrets manager
- Staging: Load from .env file
- Development: Load from local .env

## Next Steps

Phase 1 ✅ Complete - Infrastructure foundations ready.

**Phase 2** - Core domains:
1. Authentication (JWT, sessions)
2. RBAC (role checks, middleware)
3. Tenant lifecycle (create, suspend, domain assignment)
4. Plan & add-on catalog management

**Phase 3** - Business modules:
1. Billing (SaaS + end-user)
2. Network (MikroTik, Radius, Vouchers)
3. Maps (ODC/ODP/Client topology)
4. Communication (WA Gateway)

**Phase 4** - Advanced modules:
1. HR (employees, attendance, payroll)
2. Collector (3-phase cash flow)
3. Technician (tasks, activity logging)
4. Reports & analytics

---

**Current Status:** Phase 1 Infrastructure - Ready for business logic modules.

