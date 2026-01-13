# Quick Start Guide

## Prerequisites

- Docker & Docker Compose
- Go 1.21+ (untuk backend)
- Node.js 20+ (untuk frontend)

## 1. Start Infrastructure (PostgreSQL + Redis)

```bash
docker-compose up -d postgres redis
```

## 2. Setup Backend

```bash
cd BE

# Copy env file
cp .env.example .env

# Edit .env jika perlu (default sudah OK untuk local dev)

# Install dependencies
go mod download

# Run backend
go run cmd/api/main.go
```

Backend akan jalan di: `http://localhost:8080`

## 3. Setup Frontend

```bash
cd fe

# Install dependencies (jika belum)
npm install

# Run frontend
npm run dev
```

Frontend akan jalan di: `http://localhost:3000`

## 4. Test

- Frontend: http://localhost:3000
- Backend Health: http://localhost:8080/health
- Backend API: http://localhost:8080/api/v1/

## Troubleshooting

### Backend tidak connect ke database

- Pastikan PostgreSQL sudah running: `docker-compose ps`
- Cek DATABASE_URL di BE/.env

### Frontend CSP error

- Sudah diperbaiki di middleware.ts
- Restart frontend: `npm run dev`

### Port conflict

- Backend: ubah APP_PORT di BE/.env
- Frontend: ubah port di `npm run dev -- -p 3001`
