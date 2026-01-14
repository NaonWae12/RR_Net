# RRNET Testing Guide - Quick Fix

## Problem: Services Not Found

Jika kamu dapat error:
```
Unit rrnet-backend.service could not be found.
Unit rrnet-frontend.service could not be found.
```

## Quick Fix Steps

### Step 1: SSH ke VPS
```bash
ssh root@72.60.74.209
# Password: LLaptop7721@
```

### Step 2: Jalankan Fix Script

```bash
# Download atau copy script check_and_fix_vps.sh ke VPS
# Atau clone repository dulu:
cd /opt
git clone https://github.com/NaonWae12/RR_Net.git rrnet
cd rrnet

# Jalankan fix script
chmod +x scripts/check_and_fix_vps.sh
./scripts/check_and_fix_vps.sh
```

### Step 3: Manual Fix (Jika Script Gagal)

#### A. Clone Repository (Jika Belum)
```bash
mkdir -p /opt/rrnet
cd /opt/rrnet
git clone https://github.com/NaonWae12/RR_Net.git .
```

#### B. Install Prerequisites
```bash
# Install Go
cd /tmp
wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
rm -rf /usr/local/go
tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> /root/.bashrc
export PATH=$PATH:/usr/local/go/bin

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Setup PostgreSQL
systemctl start postgresql
sudo -u postgres psql -c "CREATE DATABASE rrnet_dev;"
sudo -u postgres psql -c "CREATE USER rrnet WITH PASSWORD 'rrnet_secret';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE rrnet_dev TO rrnet;"

# Setup Redis
systemctl start redis-server
```

#### C. Build Backend
```bash
cd /opt/rrnet/BE

# Create .env
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

# Update JWT_SECRET
JWT_SECRET=$(openssl rand -base64 32)
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env

# Build
export PATH=$PATH:/usr/local/go/bin
go mod download
go build -o rrnet-api cmd/api/main.go
chmod +x rrnet-api
```

#### D. Build Frontend
```bash
cd /opt/rrnet/fe

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://72.60.74.209:8080" > .env.local

# Build
npm install
npm run build
```

#### E. Create Systemd Services
```bash
# Backend Service
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

# Frontend Service
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

# Reload and enable
systemctl daemon-reload
systemctl enable rrnet-backend rrnet-frontend
systemctl start rrnet-backend rrnet-frontend
```

### Step 4: Verify

```bash
# Check status
systemctl status rrnet-backend
systemctl status rrnet-frontend

# Check logs
journalctl -u rrnet-backend -n 50
journalctl -u rrnet-frontend -n 50

# Test endpoints
curl http://localhost:8080/health
curl http://localhost:3000

# Check ports
netstat -tulpn | grep -E '8080|3000'
```

### Step 5: Test dari Browser

- Backend: http://72.60.74.209:8080/health
- Frontend: http://72.60.74.209:3000

## Troubleshooting

### Jika Port Tidak Terbuka

```bash
# Check firewall
ufw status
ufw allow 8080/tcp
ufw allow 3000/tcp

# Check if services are listening
ss -tulpn | grep -E '8080|3000'
```

### Jika Service Gagal Start

```bash
# Check logs
journalctl -u rrnet-backend -n 100 --no-pager
journalctl -u rrnet-frontend -n 100 --no-pager

# Test manual run
cd /opt/rrnet/BE
./rrnet-api

# Check .env file
cat /opt/rrnet/BE/.env
```

### Jika Database Error

```bash
# Test connection
psql -U rrnet -d rrnet_dev -h localhost

# Check PostgreSQL status
systemctl status postgresql

# Restart PostgreSQL
systemctl restart postgresql
```


