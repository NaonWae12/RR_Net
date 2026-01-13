# Production Deployment Guide

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available
- 20GB+ disk space

## Quick Start

### 1. Prepare Environment Variables

```bash
# Copy example file
cp .env.production.example .env.production

# Edit with your production values
nano .env.production
```

**Important:** Generate strong secrets:
```bash
# JWT Secret (min 32 characters)
openssl rand -base64 32

# Database Password
openssl rand -base64 16

# Redis Password
openssl rand -base64 16
```

### 2. Deploy with Docker Compose

```bash
# Make deploy script executable
chmod +x scripts/deploy.sh

# Run deployment
./scripts/deploy.sh production
```

Or manually:
```bash
docker-compose -f docker-compose.production.yml up -d
```

### 3. Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.production.yml ps

# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Health check
curl http://localhost:8080/health
curl http://localhost:3000
```

## Services

### Backend API
- **Port:** 8080 (internal)
- **Health:** `GET /health`
- **Version:** `GET /version`

### Frontend
- **Port:** 3000
- **URL:** http://localhost:3000

### PostgreSQL
- **Port:** 5432 (internal only)
- **Database:** `rrnet_prod`
- **User:** From `POSTGRES_USER` env var

### Redis
- **Port:** 6379 (internal only)
- **Password:** From `REDIS_PASSWORD` env var

## Production Checklist

### Security
- [ ] Strong passwords for all services
- [ ] JWT secret is at least 32 characters
- [ ] Database SSL enabled (`sslmode=require`)
- [ ] Redis password set
- [ ] Firewall rules configured
- [ ] HTTPS enabled (via nginx or load balancer)
- [ ] Security headers configured
- [ ] Rate limiting enabled

### Monitoring
- [ ] Health checks configured
- [ ] Log aggregation set up
- [ ] Metrics collection enabled
- [ ] Alerting configured

### Backup
- [ ] Database backup strategy
- [ ] Redis persistence enabled
- [ ] Backup verification tested

### Performance
- [ ] Database connection pooling configured
- [ ] Redis caching enabled
- [ ] CDN configured (if applicable)
- [ ] Load balancing configured (if needed)

## Nginx Reverse Proxy (Optional)

To use Nginx for HTTPS termination:

1. Place SSL certificates in `nginx/ssl/`:
   ```bash
   nginx/ssl/cert.pem
   nginx/ssl/key.pem
   ```

2. Start with nginx profile:
   ```bash
   docker-compose -f docker-compose.production.yml --profile with-nginx up -d
   ```

## Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.production.yml up -d --build
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f backend
docker-compose -f docker-compose.production.yml logs -f frontend
```

### Stop Services

```bash
docker-compose -f docker-compose.production.yml down
```

### Backup Database

```bash
docker-compose -f docker-compose.production.yml exec postgres pg_dump -U rrnet rrnet_prod > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database

```bash
docker-compose -f docker-compose.production.yml exec -T postgres psql -U rrnet rrnet_prod < backup.sql
```

## Troubleshooting

### Services won't start
- Check logs: `docker-compose -f docker-compose.production.yml logs`
- Verify environment variables are set correctly
- Check port conflicts: `netstat -tulpn | grep -E '3000|8080|5432|6379'`

### Database connection errors
- Verify `DATABASE_URL` is correct
- Check PostgreSQL is healthy: `docker-compose -f docker-compose.production.yml ps postgres`
- Verify network connectivity: `docker-compose -f docker-compose.production.yml exec backend ping postgres`

### Frontend can't connect to backend
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check backend is healthy: `curl http://localhost:8080/health`
- Verify network: services should be on same Docker network

## Scaling

### Horizontal Scaling

For high traffic, consider:
- Load balancer (nginx, HAProxy, or cloud LB)
- Multiple backend instances
- Database read replicas
- Redis cluster mode

### Vertical Scaling

Increase resources:
- Database: More connections, better hardware
- Redis: More memory
- Backend: More CPU/RAM

## Security Hardening

1. **Use secrets management:**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes Secrets

2. **Network security:**
   - Use private networks
   - Restrict database/Redis access
   - Enable firewall rules

3. **Application security:**
   - Regular security updates
   - Dependency scanning
   - Penetration testing

## Support

For issues or questions:
- Check logs first
- Review documentation
- Contact DevOps team

