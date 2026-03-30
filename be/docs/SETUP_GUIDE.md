# RRNET Backend Setup Guide

## Quick Start (5 minutes)

### Step 1: Install Prerequisites

**Go 1.21+**
```bash
# Windows (using Chocolatey)
choco install golang

# macOS (using Homebrew)
brew install go

# Linux
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
```

**PostgreSQL 14+**
```bash
# Windows
choco install postgresql

# macOS
brew install postgresql

# Linux (Ubuntu/Debian)
sudo apt install postgresql
```

**Redis 6+**
```bash
# Windows
choco install redis

# macOS
brew install redis

# Linux
sudo apt install redis
```

### Step 2: Setup Database

```bash
# Create database
createdb rrnet

# Or using psql
psql -U postgres
CREATE DATABASE rrnet;
\q
```

### Step 3: Configure Environment

Create `.env` file in `BE/` directory:

```bash
# Copy example
cp .env.example .env

# Edit with your settings
# Required:
DATABASE_URL=postgres://postgres:password@localhost:5432/rrnet?sslmode=disable

# Optional (defaults work for local dev):
APP_ENV=development
APP_PORT=8080
REDIS_ADDR=localhost:6379
```

### Step 4: Install Dependencies

```bash
cd BE
go mod download
```

### Step 5: Run Server

```bash
go run cmd/api/main.go
```

You should see:
```
{"level":"info","time":"2025-12-13T12:00:00+07:00","message":"PostgreSQL connection pool established"}
{"level":"info","time":"2025-12-13T12:00:00+07:00","message":"Redis client initialized","addr":"localhost:6379","db":0}
{"level":"info","time":"2025-12-13T12:00:00+07:00","message":"HTTP server starting","addr":":8080"}
```

### Step 6: Test Endpoints

```bash
# Health check
curl http://localhost:8080/health

# Expected response:
# {"status":"healthy","services":{"postgres":"up","redis":"up"}}

# Version info
curl http://localhost:8080/version

# Expected response:
# {"version":"dev","commit":"unknown","build_time":"unknown"}

# API root
curl http://localhost:8080/api/v1/

# Expected response:
# {"message":"RRNET API v1","status":"ready"}
```

## Troubleshooting

### Database Connection Failed

**Error:** `Failed to connect to PostgreSQL: connection refused`

**Solutions:**
1. Check PostgreSQL is running:
   ```bash
   # macOS/Linux
   pg_isready
   
   # Windows
   sc query postgresql
   ```

2. Verify connection string in `.env`:
   ```bash
   DATABASE_URL=postgres://user:password@localhost:5432/rrnet?sslmode=disable
   ```

3. Check PostgreSQL logs:
   ```bash
   # macOS (Homebrew)
   tail -f /usr/local/var/log/postgres.log
   
   # Linux
   sudo tail -f /var/log/postgresql/postgresql-14-main.log
   ```

### Redis Connection Warning

**Warning:** `Redis connection check failed (non-fatal)`

This is a warning, not an error. The server will still run.

**Solutions:**
1. Check Redis is running:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. Start Redis:
   ```bash
   # macOS/Linux
   redis-server
   
   # Windows
   redis-server.exe
   ```

3. Update Redis address in `.env` if using non-default:
   ```bash
   REDIS_ADDR=localhost:6379
   ```

### Port Already in Use

**Error:** `bind: address already in use`

**Solutions:**
1. Change port in `.env`:
   ```bash
   APP_PORT=8081
   ```

2. Or kill process using the port:
   ```bash
   # macOS/Linux
   lsof -ti:8080 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :8080
   taskkill /PID <PID> /F
   ```

### Module Download Failed

**Error:** `go: downloading ... connection refused`

**Solutions:**
1. Set Go proxy:
   ```bash
   go env -w GOPROXY=https://proxy.golang.org,direct
   ```

2. Or use alternative proxy:
   ```bash
   go env -w GOPROXY=https://goproxy.io,direct
   ```

## Development Workflow

### Running with Live Reload

Install Air for live reloading:
```bash
go install github.com/air-verse/air@latest
```

Create `.air.toml` in `BE/`:
```toml
root = "."
tmp_dir = "tmp"

[build]
  cmd = "go build -o ./tmp/main cmd/api/main.go"
  bin = "tmp/main"
  include_ext = ["go"]
  exclude_dir = ["tmp", "vendor"]
```

Run with Air:
```bash
air
```

### Running Tests

```bash
# All tests
go test ./...

# Verbose
go test -v ./...

# With coverage
go test -cover ./...

# Coverage report
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### Building Binary

```bash
# Development build
go build -o rrnet cmd/api/main.go

# Production build (optimized)
go build -ldflags="-w -s" -o rrnet cmd/api/main.go

# With version info
go build -ldflags="-X rrnet/internal/version.Version=1.0.0 -X rrnet/internal/version.Commit=$(git rev-parse HEAD) -X rrnet/internal/version.BuildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" -o rrnet cmd/api/main.go

# Run binary
./rrnet
```

### Database Migrations (Future)

Migrations will be added in Phase 2. Planned tool: `golang-migrate`.

```bash
# Install migrate
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Create migration
migrate create -ext sql -dir migrations -seq create_tenants_table

# Run migrations
migrate -database "postgres://user:pass@localhost:5432/rrnet?sslmode=disable" -path migrations up

# Rollback
migrate -database "..." -path migrations down 1
```

## Docker Setup (Future)

Docker Compose setup coming in Phase 2:

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://rrnet:password@postgres:5432/rrnet
      REDIS_ADDR: redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: rrnet
      POSTGRES_PASSWORD: password
      POSTGRES_DB: rrnet
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Run with:
```bash
docker-compose up -d
```

## IDE Setup

### VS Code

Install extensions:
- Go (golang.go)
- Go Test Explorer (ethan-reesor.vscode-go-test-adapter)
- Thunder Client (rangav.vscode-thunder-client) - for API testing

Workspace settings (`.vscode/settings.json`):
```json
{
  "go.formatTool": "gofmt",
  "go.lintTool": "golangci-lint",
  "go.lintOnSave": "workspace",
  "editor.formatOnSave": true,
  "go.testOnSave": false
}
```

### GoLand / IntelliJ IDEA

1. Open project root
2. Go SDK auto-detected from go.mod
3. Run configurations created automatically
4. Database tool window for PostgreSQL connection

## Production Deployment

### Environment Preparation

1. **Set production environment:**
   ```bash
   export APP_ENV=production
   ```

2. **Use connection pooling for PostgreSQL**
   - Already configured in `internal/infra/postgres/postgres.go`
   - Max connections: 25
   - Min connections: 5

3. **Enable TLS for database:**
   ```bash
   DATABASE_URL=postgres://user:pass@prod-db.com:5432/rrnet?sslmode=require
   ```

4. **Use Redis password:**
   ```bash
   REDIS_PASSWORD=your-secure-password
   ```

5. **Set up reverse proxy** (nginx/Caddy) for HTTPS termination

### Systemd Service (Linux)

Create `/etc/systemd/system/rrnet.service`:
```ini
[Unit]
Description=RRNET Backend API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=rrnet
WorkingDirectory=/opt/rrnet
ExecStart=/opt/rrnet/rrnet
Restart=always
RestartSec=10
EnvironmentFile=/opt/rrnet/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable rrnet
sudo systemctl start rrnet
sudo systemctl status rrnet
```

### Monitoring

Add to your monitoring stack:
- **Health check:** `GET /health` (every 30s)
- **Logs:** JSON logs to stdout (capture with journalctl or log aggregator)
- **Metrics:** Prometheus metrics endpoint (Phase 2)

## Next Steps

✅ Phase 1 complete - Infrastructure ready

🔜 Phase 2 - Implement:
1. Authentication & sessions
2. RBAC middleware
3. Tenant management APIs
4. Database migrations
5. Integration tests

See `ARCHITECTURE.md` for detailed architecture information.

