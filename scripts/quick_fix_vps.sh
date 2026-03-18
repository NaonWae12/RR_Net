#!/bin/bash

# Quick Fix Script - More Robust Version
# This script will fix all deployment issues step by step

set +e  # Don't exit on error

echo "=========================================="
echo "RRNET Quick Fix Script"
echo "=========================================="

PROJECT_DIR="/opt/rrnet"
VPS_IP="72.60.74.209"

# Update system first
echo "[1] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl wget build-essential

# Install PostgreSQL
echo "[2] Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    apt-get install -y -qq postgresql postgresql-contrib
fi

# Start PostgreSQL
systemctl start postgresql 2>/dev/null || service postgresql start
sleep 3

# Setup database
sudo -u postgres psql -c "CREATE DATABASE rrnet_dev;" 2>/dev/null
sudo -u postgres psql -c "CREATE USER rrnet WITH PASSWORD 'rrnet_secret';" 2>/dev/null
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE rrnet_dev TO rrnet;" 2>/dev/null
sudo -u postgres psql -c "ALTER USER rrnet CREATEDB;" 2>/dev/null
echo "✓ PostgreSQL ready"

# Install Redis
echo "[3] Installing Redis..."
if ! command -v redis-cli &> /dev/null; then
    apt-get install -y -qq redis-server
fi
systemctl start redis-server 2>/dev/null || service redis-server start
sleep 2
echo "✓ Redis ready"

# Install Go
echo "[4] Installing Go..."
if ! command -v go &> /dev/null; then
    cd /tmp
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /root/.bashrc
    export PATH=$PATH:/usr/local/go/bin
fi
go version
echo "✓ Go installed"

# Install Node.js
echo "[5] Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
    apt-get install -y -qq nodejs
fi
node --version
echo "✓ Node.js installed"

# Ensure project directory
echo "[6] Setting up project directory..."
if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p $PROJECT_DIR
fi

cd $PROJECT_DIR

# Clone or update repository
if [ -d ".git" ]; then
    echo "Updating repository..."
    git pull origin main 2>/dev/null || true
else
    echo "Cloning repository..."
    git clone https://github.com/NaonWae12/RR_Net.git . 2>/dev/null
fi

# Setup Backend
echo "[7] Setting up backend..."
cd $PROJECT_DIR/BE

# Create .env if not exists
if [ ! -f .env ]; then
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "default-secret-change-in-production")
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
    echo "✓ Created BE/.env"
fi

# Build backend
export PATH=$PATH:/usr/local/go/bin
cd $PROJECT_DIR/BE

# Fix go.sum and download dependencies
echo "Downloading Go dependencies..."
go mod tidy 2>&1 | tail -5
go mod download 2>&1 | tail -5

# Build backend
go build -o rrnet-api cmd/api/main.go 2>&1
if [ -f rrnet-api ]; then
    chmod +x rrnet-api
    echo "✓ Backend built successfully"
else
    echo "❌ Backend build failed. Run scripts/fix_build_issues.sh to fix."
fi

# Setup Frontend
echo "[9] Setting up frontend..."
cd $PROJECT_DIR

# Check if fe is submodule and init if needed
if [ -f .gitmodules ]; then
    echo "Initializing git submodules..."
    git submodule update --init --recursive 2>&1 | tail -5
fi

cd $PROJECT_DIR/fe

# Check if package.json exists
if [ ! -f package.json ]; then
    echo "⚠️  Frontend package.json not found. May be submodule issue."
    echo "   Run: git submodule update --init --recursive"
else
    # Create .env.local if not exists
    if [ ! -f .env.local ]; then
        cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://$VPS_IP:8080/api/v1
EOF
        echo "✓ Created fe/.env.local"
    fi

    # Build frontend
    npm install 2>&1 | tail -10
    npm run build 2>&1 | tail -15
    if [ -d ".next" ]; then
        echo "✓ Frontend built successfully"
    else
        echo "⚠️  Frontend build may have issues. Check logs above."
    fi
fi

# Create systemd services
echo "[10] Creating systemd services..."

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
systemctl enable rrnet-backend 2>/dev/null
systemctl enable rrnet-frontend 2>/dev/null

echo "✓ Systemd services created"

# Start services
echo "[11] Starting services..."
systemctl stop rrnet-backend 2>/dev/null
systemctl stop rrnet-frontend 2>/dev/null
sleep 2

systemctl start rrnet-backend
sleep 3
systemctl start rrnet-frontend
sleep 3

# Check status
echo ""
echo "=========================================="
echo "Service Status:"
echo "=========================================="
systemctl status rrnet-backend --no-pager -l | head -15
echo ""
systemctl status rrnet-frontend --no-pager -l | head -15

# Test endpoints
echo ""
echo "=========================================="
echo "Testing Endpoints:"
echo "=========================================="
sleep 5

echo "Backend Health Check:"
curl -s http://localhost:8080/health || echo "❌ Backend not responding"
echo ""

echo "Frontend Check:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000 || echo "❌ Frontend not responding"
echo ""

# Check ports
echo "Ports listening:"
netstat -tuln 2>/dev/null | grep -E '8080|3000' || ss -tuln 2>/dev/null | grep -E '8080|3000' || echo "⚠️  Ports not found"

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Access URLs:"
echo "  Backend:  http://$VPS_IP:8080"
echo "  Frontend: http://$VPS_IP:3000"
echo "  Health:   http://$VPS_IP:8080/health"
echo ""
echo "View logs:"
echo "  journalctl -u rrnet-backend -f"
echo "  journalctl -u rrnet-frontend -f"
echo ""
echo "Restart services:"
echo "  systemctl restart rrnet-backend rrnet-frontend"

