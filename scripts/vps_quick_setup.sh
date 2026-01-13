#!/bin/bash

# Quick Setup Script for RRNET VPS
# Run this script on your VPS after cloning the repository

set -e

echo "=========================================="
echo "RRNET Quick Setup Script"
echo "=========================================="

# Update system
echo "[1/10] Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl wget build-essential postgresql postgresql-contrib redis-server

# Install Go
echo "[2/10] Installing Go..."
if ! command -v go &> /dev/null; then
    cd /tmp
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /root/.bashrc
    export PATH=$PATH:/usr/local/go/bin
fi
go version

# Install Node.js
echo "[3/10] Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y -qq nodejs
fi
node --version

# Setup PostgreSQL
echo "[4/10] Setting up PostgreSQL..."
systemctl enable postgresql
systemctl start postgresql
sudo -u postgres psql -c "CREATE DATABASE rrnet_dev;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER rrnet WITH PASSWORD 'rrnet_secret';" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE rrnet_dev TO rrnet;" 2>/dev/null || true
sudo -u postgres psql -c "ALTER USER rrnet CREATEDB;" 2>/dev/null || true

# Setup Redis
echo "[5/10] Setting up Redis..."
systemctl enable redis-server
systemctl start redis-server

# Get current directory (should be /opt/rrnet or project root)
PROJECT_DIR=$(pwd)
if [ ! -d "$PROJECT_DIR/BE" ]; then
    echo "Error: Please run this script from project root directory"
    exit 1
fi

# Setup Backend .env
echo "[6/10] Configuring backend..."
cd "$PROJECT_DIR/BE"
if [ ! -f .env ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    cat > .env << EOF
APP_ENV=production
APP_NAME=rrnet-api
APP_PORT=8080
DATABASE_URL=postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
JWT_SECRET=$JWT_SECRET
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
EOF
    echo "Created BE/.env with generated JWT_SECRET"
fi

# Build Backend
echo "[7/10] Building backend..."
export PATH=$PATH:/usr/local/go/bin
go mod download
go build -o rrnet-api cmd/api/main.go
chmod +x rrnet-api

# Setup Frontend .env
echo "[8/10] Configuring frontend..."
cd "$PROJECT_DIR/fe"
if [ ! -f .env.local ]; then
    echo "NEXT_PUBLIC_API_URL=http://$(hostname -I | awk '{print $1}'):8080" > .env.local
    echo "Created fe/.env.local"
fi

# Build Frontend
echo "[9/10] Building frontend..."
npm install
npm run build

# Create systemd services
echo "[10/10] Creating systemd services..."

# Backend service
cat > /etc/systemd/system/rrnet-backend.service << EOF
[Unit]
Description=RRNET Backend API
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR/BE
ExecStart=$PROJECT_DIR/BE/rrnet-api
Restart=always
RestartSec=10
EnvironmentFile=$PROJECT_DIR/BE/.env

[Install]
WantedBy=multi-user.target
EOF

# Frontend service
cat > /etc/systemd/system/rrnet-frontend.service << EOF
[Unit]
Description=RRNET Frontend
After=network.target rrnet-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR/fe
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=$PROJECT_DIR/fe/.env.local

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable rrnet-backend rrnet-frontend

echo ""
echo "=========================================="
echo "Setup completed!"
echo "=========================================="
echo ""
echo "To start services, run:"
echo "  systemctl start rrnet-backend rrnet-frontend"
echo ""
echo "To check status:"
echo "  systemctl status rrnet-backend"
echo "  systemctl status rrnet-frontend"
echo ""
echo "To view logs:"
echo "  journalctl -u rrnet-backend -f"
echo "  journalctl -u rrnet-frontend -f"
echo ""

