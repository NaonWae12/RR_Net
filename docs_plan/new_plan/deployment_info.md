# VPS Deployment Information & Structure

> [!IMPORTANT]  
> This document contains confidential access information for the new VPS deployment. Keep it safe!

## 🌐 Server Details
- **IP Address:** `srv1501081` (based on terminal output) / `76.13.17.143` (SSH terminal command)
- **Deployment User:** `root`
- **Root Directory:** `/opt/rrnet`
  - `/opt/rrnet/BE`: Backend source and configuration
  - `/opt/rrnet/fe`: Frontend source and configuration
  - `/opt/rrnet/docker-compose.production.yml`: Main orchestration file

## 🗄️ Database Configuration (Production)
- **Engine:** PostgreSQL 16 (Docker)
- **Container Name:** `rrnet-postgres-prod`
- **Internal Port:** `5432`
- **Database Name:** `rrnet_prod`
- **Database User:** `rrnet_admin`
- **Password:** `rrnet_prod_secret2026` (Randomly generated for security)

## 🔑 Cache & Session Service
- **Engine:** Redis 7 (Docker)
- **Container Name:** `rrnet-redis-prod`
- **Password:** `rrnet_redis_secret_2026`

## 🛡️ Authentication (JWT)
- **JWT_SECRET:** (Will be auto-generated during deployment)
- **JWT_ACCESS_TTL:** `15m`
- **JWT_REFRESH_TTL:** `7d`

## 🔗 Environment Links
- **Backend API:** `http://76.13.17.143:8080`
- **Frontend Dashboard:** `http://76.13.17.143:3000`
- **Public Inventory:** `http://76.13.17.143:3000/public/asset/[id]`

---
## 🚀 Command Cheat Sheet
### Start All Services
```bash
cd /opt/rrnet
docker-compose -f docker-compose.production.yml up -d
```

### Check Logs
```bash
docker logs -f rrnet-backend-prod
docker logs -f rrnet-frontend-prod
```

### Update Project
```bash
cd /opt/rrnet
git pull origin main
docker-compose -f docker-compose.production.yml up -d --build
```
