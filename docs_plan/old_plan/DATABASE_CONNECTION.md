# Database Connection Information

## Overview
Dokumen ini berisi informasi koneksi database untuk project RRNET.

---

## PostgreSQL (via Docker)

### pgAdmin Connection
| Field | Value |
|-------|-------|
| **Host** | `localhost` |
| **Port** | `5432` |
| **Username** | `rrnet` |
| **Password** | `rrnet_secret` |
| **Database** | `rrnet_dev` |
| **SSL Mode** | `disable` (development) |

### Connection String
```
postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable
```

### Docker Container
- **Container Name:** `rrnet-postgres`
- **Image:** `postgres:16-alpine`
- **Volume:** `postgres_data`

---

## Redis (via Docker)

### Connection Info
| Field | Value |
|-------|-------|
| **Host** | `localhost` |
| **Port** | `6379` |
| **Password** | *(empty)* |
| **Database** | `0` |

### Connection String
```
redis://localhost:6379/0
```

### Docker Container
- **Container Name:** `rrnet-redis`
- **Image:** `redis:7-alpine`
- **Volume:** `redis_data`

---

## Docker Commands

### Start Containers
```bash
cd E:\Project\ERP_NET
docker-compose up -d
```

### Stop Containers
```bash
docker-compose down
```

### View Logs
```bash
# All containers
docker-compose logs -f

# PostgreSQL only
docker-compose logs -f postgres

# Redis only
docker-compose logs -f redis
```

### Check Status
```bash
docker-compose ps
```

### Reset Database (WARNING: Deletes all data)
```bash
docker-compose down -v
docker-compose up -d
```

---

## Optional Tools

### Redis Commander (GUI)
Untuk mengaktifkan Redis Commander GUI:
```bash
docker-compose --profile tools up -d
```
Akses di: http://localhost:8081

---

## Environment Variables (.env)

Backend membutuhkan file `.env` di folder `BE/`:

```env
APP_ENV=development
APP_NAME=rrnet
APP_PORT=8080

DATABASE_URL=postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable

REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

JWT_SECRET=dev-secret-key-not-for-production
JWT_EXPIRY=24h
```

---

## Running Migrations

Setelah Docker running, jalankan migrations:

```bash
cd BE
migrate -path ./migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" up
```

---

## Troubleshooting

### Port Already in Use
```bash
# Check what's using port 5432
netstat -ano | findstr :5432

# Kill process by PID
taskkill /PID <PID> /F
```

### Container Won't Start
```bash
# Remove and recreate
docker-compose down
docker-compose up -d --force-recreate
```

### Connection Refused
1. Pastikan Docker Desktop running
2. Pastikan container status "Up"
3. Cek firewall tidak block port 5432/6379

---

**Note:** Credentials di dokumen ini hanya untuk development. Jangan gunakan di production!

