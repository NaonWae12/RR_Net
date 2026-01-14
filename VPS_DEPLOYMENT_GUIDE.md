# RRNET VPS Deployment Guide

## Prerequisites

- VPS dengan 2 Core / 8GB RAM (Hostinger)
- SSH access ke VPS
- GitHub repository sudah di-push

## VPS Information

- **Host:** 72.60.74.209
- **User:** root
- **Password:** LLaptop7721@
- **GitHub Repo:** https://github.com/NaonWae12/RR_Net.git

## Step-by-Step Deployment

### Step 1: Connect to VPS

```bash
ssh root@72.60.74.209
# Enter password: LLaptop7721@
```

### Step 2: Update System and Install Prerequisites

```bash
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y git curl wget build-essential
apt-get install -y postgresql postgresql-contrib redis-server
apt-get install -y docker.io docker-compose
systemctl enable docker
systemctl start docker
```

### Step 3: Install Go 1.21+

```bash
cd /tmp
wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
rm -rf /usr/local/go
tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> /root/.bashrc
export PATH=$PATH:/usr/local/go/bin
go version
```

### Step 4: Install Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node --version
npm --version
```

### Step 5: Setup PostgreSQL

```bash
systemctl enable postgresql
systemctl start postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE rrnet_dev;
CREATE USER rrnet WITH PASSWORD 'rrnet_secret';
GRANT ALL PRIVILEGES ON DATABASE rrnet_dev TO rrnet;
ALTER USER rrnet CREATEDB;
\q
EOF
```

### Step 6: Setup Redis

```bash
systemctl enable redis-server
systemctl start redis-server
redis-cli ping
# Should return: PONG
```

### Step 7: Clone Repository

```bash
mkdir -p /opt/rrnet
cd /opt/rrnet
git clone https://github.com/NaonWae12/RR_Net.git .
```

### Step 8: Configure Backend Environment

```bash
cd /opt/rrnet/BE
cat > .env << 'EOF'
APP_ENV=production
APP_NAME=rrnet-api
APP_PORT=8080
DATABASE_URL=postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
JWT_SECRET=$(openssl rand -base64 32)
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
EOF
```

**Important:** Generate a secure JWT_SECRET:
```bash
cd /opt/rrnet/BE
JWT_SECRET=$(openssl rand -base64 32)
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
```

### Step 9: Configure Frontend Environment

```bash
cd /opt/rrnet/fe
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://72.60.74.209:8080
EOF
```

### Step 10: Run Database Migrations

```bash
cd /opt/rrnet/BE

# Option 1: If you have a migration tool
# Run your migration command here

# Option 2: Manual migration (run SQL files)
# You may need to run migrations manually from BE/migrations/
```

### Step 11: Build Backend

```bash
cd /opt/rrnet/BE
export PATH=$PATH:/usr/local/go/bin
go mod download
go build -o rrnet-api cmd/api/main.go
chmod +x rrnet-api
```

### Step 12: Build Frontend

```bash
cd /opt/rrnet/fe
npm install
npm run build
```

### Step 13: Create Systemd Service for Backend

```bash
cat > /etc/systemd/system/rrnet-backend.service << 'EOF'
[Unit]
Description=RRNET Backend API
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rrnet/BE
ExecStart=/opt/rrnet/BE/rrnet-api
Restart=always
RestartSec=10
EnvironmentFile=/opt/rrnet/BE/.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable rrnet-backend
systemctl start rrnet-backend
```

### Step 14: Create Systemd Service for Frontend

```bash
cat > /etc/systemd/system/rrnet-frontend.service << 'EOF'
[Unit]
Description=RRNET Frontend
After=network.target rrnet-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rrnet/fe
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/rrnet/fe/.env.local

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable rrnet-frontend
systemctl start rrnet-frontend
```

### Step 15: Configure Firewall (if needed)

```bash
# Allow HTTP, HTTPS, and custom ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 8080/tcp  # Backend API
ufw allow 3000/tcp # Frontend
ufw enable
```

### Step 16: Verify Services

```bash
# Check backend status
systemctl status rrnet-backend

# Check frontend status
systemctl status rrnet-frontend

# Check logs
journalctl -u rrnet-backend -f
journalctl -u rrnet-frontend -f

# Test endpoints
curl http://localhost:8080/health
curl http://localhost:3000
```

## Access URLs

- **Backend API:** http://72.60.74.209:8080
- **Frontend:** http://72.60.74.209:3000
- **Health Check:** http://72.60.74.209:8080/health

## Useful Commands

### Service Management

```bash
# Start services
systemctl start rrnet-backend rrnet-frontend

# Stop services
systemctl stop rrnet-backend rrnet-frontend

# Restart services
systemctl restart rrnet-backend rrnet-frontend

# Check status
systemctl status rrnet-backend rrnet-frontend

# View logs
journalctl -u rrnet-backend -n 50
journalctl -u rrnet-frontend -n 50

# Follow logs
journalctl -u rrnet-backend -f
journalctl -u rrnet-frontend -f
```

### Update Deployment

```bash
cd /opt/rrnet
git pull origin main

# Rebuild backend
cd BE
go build -o rrnet-api cmd/api/main.go
systemctl restart rrnet-backend

# Rebuild frontend
cd ../fe
npm install
npm run build
systemctl restart rrnet-frontend
```

### Database Backup

```bash
# Backup database
sudo -u postgres pg_dump rrnet_dev > /opt/rrnet/backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
sudo -u postgres psql rrnet_dev < /opt/rrnet/backup.sql
```

### Monitoring

```bash
# Check system resources
free -h
df -h
top

# Check service status
systemctl list-units | grep rrnet

# Check ports
netstat -tulpn | grep -E '8080|3000|5432|6379'
```

## Troubleshooting

### Backend won't start

1. Check logs: `journalctl -u rrnet-backend -n 100`
2. Verify database connection: `psql -U rrnet -d rrnet_dev -h localhost`
3. Verify Redis: `redis-cli ping`
4. Check .env file: `cat /opt/rrnet/BE/.env`

### Frontend won't start

1. Check logs: `journalctl -u rrnet-frontend -n 100`
2. Verify build: `cd /opt/rrnet/fe && npm run build`
3. Check .env.local: `cat /opt/rrnet/fe/.env.local`

### Database connection errors

```bash
# Test PostgreSQL connection
sudo -u postgres psql -c "\l"
psql -U rrnet -d rrnet_dev -h localhost

# Check PostgreSQL status
systemctl status postgresql
```

### Port already in use

```bash
# Find process using port
lsof -i :8080
lsof -i :3000

# Kill process
kill -9 <PID>
```

## Security Recommendations

1. **Change default passwords** in production
2. **Use strong JWT_SECRET** (already generated)
3. **Enable firewall** (ufw)
4. **Setup SSL/TLS** with Let's Encrypt
5. **Regular backups** of database
6. **Monitor logs** regularly
7. **Keep system updated**: `apt-get update && apt-get upgrade`

## Next Steps

1. Setup Nginx reverse proxy for HTTPS
2. Configure domain name
3. Setup SSL certificate (Let's Encrypt)
4. Configure automated backups
5. Setup monitoring (optional)


