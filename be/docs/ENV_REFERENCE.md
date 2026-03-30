# Environment Variables Reference

## Required Variables

### DATABASE_URL
PostgreSQL connection string.

**Format:** `postgres://user:password@host:port/database?sslmode=disable`

**Example:**
```bash
DATABASE_URL="postgres://rrnet:secret@localhost:5432/rrnet?sslmode=disable"
```

**Production Example:**
```bash
DATABASE_URL="postgres://rrnet:$ECURE_P@55@db.example.com:5432/rrnet_prod?sslmode=require"
```

## Optional Variables

### RRNET_RADIUS_REST_SECRET
Shared secret used to authenticate **FreeRADIUS rlm_rest → RRNET backend** calls to:
- `POST /api/v1/radius/auth`
- `POST /api/v1/radius/acct`

This must match the header `X-RRNET-RADIUS-SECRET` sent by FreeRADIUS, and by default matches docker-compose:

```bash
RRNET_RADIUS_REST_SECRET=dev-radius-rest-secret
```

---

### APP_ENV
Application environment mode. Affects logging format and log level.

**Values:** `development` | `production`  
**Default:** `development`

**Example:**
```bash
APP_ENV=production
```

---

### APP_NAME
Application name used in logs and monitoring.

**Default:** `rrnet`

**Example:**
```bash
APP_NAME=rrnet-backend
```

---

### APP_PORT
HTTP server port.

**Default:** `8080`

**Example:**
```bash
APP_PORT=3000
```

---

### REDIS_ADDR
Redis server address.

**Default:** `localhost:6379`

**Example:**
```bash
REDIS_ADDR=redis.example.com:6379
```

---

### REDIS_PASSWORD
Redis authentication password. Leave empty if Redis has no password.

**Default:** `` (empty)

**Example:**
```bash
REDIS_PASSWORD=my-redis-password
```

---

### REDIS_DB
Redis database number (0-15).

**Default:** `0`

**Example:**
```bash
REDIS_DB=1
```

---

### WA_GATEWAY_URL
Base URL for the WhatsApp gateway service (Baileys) used for bulk reminders (optional).

**Default:** `http://localhost:3001`

**Example (docker compose):**
```bash
WA_GATEWAY_URL=http://wa-gateway:3001
```

---

### WA_GATEWAY_ADMIN_TOKEN
Shared admin token used by the backend to authenticate to the WhatsApp gateway (optional but recommended).
Must match the gateway's `WA_ADMIN_TOKEN`.

**Default:** `` (empty)

**Example:**
```bash
WA_GATEWAY_ADMIN_TOKEN=dev-wa-admin-token
```

## Example Configuration Files

### Development (.env.development)
```bash
APP_ENV=development
APP_NAME=rrnet
APP_PORT=8080

DATABASE_URL=postgres://rrnet:password@localhost:5432/rrnet_dev?sslmode=disable

REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Production (.env.production)
```bash
APP_ENV=production
APP_NAME=rrnet-api
APP_PORT=8080

DATABASE_URL=postgres://rrnet_user:$ECURE_PA55W0RD@prod-db.internal:5432/rrnet_prod?sslmode=require

REDIS_ADDR=prod-redis.internal:6379
REDIS_PASSWORD=$ECURE_REDIS_PA55
REDIS_DB=0
```

### Docker Compose Example
```yaml
version: '3.8'

services:
  api:
    image: rrnet-backend:latest
    environment:
      APP_ENV: production
      APP_PORT: 8080
      DATABASE_URL: postgres://rrnet:password@postgres:5432/rrnet
      REDIS_ADDR: redis:6379
      REDIS_PASSWORD: ""
      REDIS_DB: 0
    ports:
      - "8080:8080"
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

## Validation Rules

1. **DATABASE_URL** - Must be valid PostgreSQL connection string
2. **REDIS_DB** - Must be integer between 0-15
3. **APP_PORT** - Must be valid port number (1-65535)

## Security Best Practices

1. **Never commit** `.env` files to version control
2. **Use secrets management** in production (AWS Secrets Manager, HashiCorp Vault, etc.)
3. **Rotate credentials** regularly
4. **Use strong passwords** for database and Redis
5. **Enable SSL/TLS** for production database connections (`sslmode=require`)
6. **Restrict network access** - Use firewalls and VPCs
7. **Audit access logs** - Monitor who accesses environment variables

## Loading Environment Variables

### From .env file (development)
```bash
# Load from file
export $(cat .env | xargs)

# Run application
go run cmd/api/main.go
```

### From system environment (production)
```bash
# Set in system/container environment
export DATABASE_URL="..."
export REDIS_ADDR="..."

# Run application
./rrnet-api
```

### Using direnv (recommended for development)
Install direnv and create `.envrc`:
```bash
export DATABASE_URL="postgres://rrnet:password@localhost:5432/rrnet_dev"
export REDIS_ADDR="localhost:6379"
export APP_ENV="development"
```

Then:
```bash
direnv allow
go run cmd/api/main.go
```

---

**Note:** Configuration is validated on application startup. Missing required variables will cause the application to exit with an error message.

