# RRNET Backend

Backend service for RRNET SaaS platform, built with Go.

## Architecture

- **Language:** Golang 1.21+
- **Style:** Modular block architecture
- **Database:** PostgreSQL (via pgx/v5)
- **Cache & Queue:** Redis + Asynq
- **HTTP:** Native net/http with graceful shutdown

## Project Structure

```
BE/
├── cmd/
│   └── api/              # Main application entrypoint
├── internal/
│   ├── config/           # Configuration loader
│   ├── logger/           # Structured logging (zerolog)
│   ├── infra/            # Infrastructure clients
│   │   ├── postgres/     # PostgreSQL connection pool
│   │   ├── redis/        # Redis client
│   │   └── asynq/        # Background job queue
│   ├── http/             # HTTP layer
│   │   ├── server/       # HTTP server with graceful shutdown
│   │   ├── middleware/   # Request middleware
│   │   └── router/       # Route definitions
│   ├── version/          # Version information
│   └── health/           # Health check logic
├── pkg/
│   └── utils/            # Shared utilities
├── go.mod
├── go.sum
└── .env.example          # Environment variable template
```

## Getting Started

### Prerequisites

- Go 1.21 or higher
- PostgreSQL 14+
- Redis 6+

### Installation

1. Clone and navigate to backend:
```bash
cd BE
```

2. Install dependencies:
```bash
go mod download
```

3. Copy environment file and configure:
```bash
cp .env.example .env
# Edit .env with your database and redis settings
```

4. Run the server:
```bash
go run cmd/api/main.go
```

Or with environment variables inline:
```bash
DATABASE_URL=postgres://user:pass@localhost:5432/rrnet \
REDIS_ADDR=localhost:6379 \
go run cmd/api/main.go
```

### Available Endpoints

- `GET /health` - Health check with service status
- `GET /version` - Build version information
- `GET /api/v1/` - API root endpoint

## Development Status

✅ **Completed (Phase 1 - Infrastructure Foundations)**
- Configuration loader with env validation
- Structured JSON logging
- PostgreSQL connection pool with health checks
- Redis client
- Asynq task queue initialization
- HTTP server with graceful shutdown
- Middlewares: request_id, recover_panic, request_logger, tenant_context
- Versioned API routing structure

🟧 **Next Steps (Phase 2+)**
- [ ] Authentication & JWT
- [ ] RBAC implementation
- [ ] Tenant business logic
- [ ] Billing module
- [ ] Maps module (ODC/ODP/Client)
- [ ] WA Gateway integration
- [ ] HR/Collector/Technician modules
- [ ] Add-on engine

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_ENV` | No | `development` | Environment (development/production) |
| `APP_NAME` | No | `rrnet` | Application name |
| `APP_PORT` | No | `8080` | HTTP server port |
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string |
| `REDIS_ADDR` | No | `localhost:6379` | Redis server address |
| `REDIS_PASSWORD` | No | - | Redis password |
| `REDIS_DB` | No | `0` | Redis database number |

## Testing

```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run with verbose output
go test -v ./...
```

## Building

```bash
# Build binary
go build -o rrnet cmd/api/main.go

# Run binary
./rrnet
```

## Next Module Instructions

This foundation is ready for business logic modules. Follow the **RRNET_EXEC_02** specification for the next implementation phase.

Key integration points:
- Add new routes in `internal/http/router/`
- Add new middleware in `internal/http/middleware/`
- Create domain modules under `internal/domain/`
- Register Asynq task handlers for background jobs
- Use existing logger, DB pool, and Redis clients

---

**Status:** ✅ Phase 1 Complete - Infrastructure Ready

