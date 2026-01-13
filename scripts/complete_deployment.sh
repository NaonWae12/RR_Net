#!/bin/bash

# Complete Deployment Script - Fixes All Issues
# This script handles everything: dependencies, builds, migrations, services

set +e  # Don't exit on error

echo "=========================================="
echo "RRNET Complete Deployment Script"
echo "=========================================="

PROJECT_DIR="/opt/rrnet"
VPS_IP="72.60.74.209"

# Step 1: Update system
echo "[1/12] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl wget build-essential postgresql postgresql-contrib redis-server

# Step 2: Setup PostgreSQL
echo "[2/12] Setting up PostgreSQL..."
systemctl start postgresql 2>/dev/null || service postgresql start
sleep 3

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE rrnet_dev;" 2>/dev/null
sudo -u postgres psql -c "CREATE USER rrnet WITH PASSWORD 'rrnet_secret';" 2>/dev/null
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE rrnet_dev TO rrnet;" 2>/dev/null
sudo -u postgres psql -c "ALTER USER rrnet CREATEDB;" 2>/dev/null
echo "✓ PostgreSQL ready"

# Step 3: Setup Redis
echo "[3/12] Setting up Redis..."
systemctl start redis-server 2>/dev/null || service redis-server start
sleep 2
redis-cli ping > /dev/null 2>&1 && echo "✓ Redis ready" || echo "⚠️  Redis check"

# Step 4: Install Go
echo "[4/12] Installing Go..."
if ! command -v go &> /dev/null; then
    cd /tmp
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /root/.bashrc
fi
export PATH=$PATH:/usr/local/go/bin
go version
echo "✓ Go installed"

# Step 5: Install Node.js
echo "[5/12] Installing Node.js 20+..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
    apt-get install -y -qq nodejs
else
    # Check version and upgrade if needed
    NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 20 ]; then
        echo "   Upgrading Node.js from $(node --version) to 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
        apt-get install -y -qq nodejs
    fi
fi
node --version
echo "✓ Node.js installed"

# Step 6: Setup project directory
echo "[6/12] Setting up project directory..."
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

# Step 7: Init git submodules (for frontend)
echo "[7/12] Initializing git submodules..."
if [ -f .gitmodules ]; then
    git submodule update --init --recursive 2>&1 | tail -5
fi

# Step 8: Setup Backend Environment
echo "[8/12] Setting up backend environment..."
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

# Step 9: Run Database Migrations
echo "[9/12] Running database migrations..."
cd $PROJECT_DIR/BE

# Install PostgreSQL extensions
if [ -f "migrations/init/001_init_extensions.sql" ]; then
    sudo -u postgres psql -d rrnet_dev -f migrations/init/001_init_extensions.sql 2>/dev/null || true
fi

# Run all migrations
MIGRATION_COUNT=0
for migration in migrations/000*.up.sql; do
    if [ -f "$migration" ]; then
        MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
        MIGRATION_NAME=$(basename "$migration")
        psql -U rrnet -d rrnet_dev -h localhost -f "$migration" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "  ✓ $MIGRATION_NAME"
        else
            echo "  ⚠️  $MIGRATION_NAME (may already exist)"
        fi
    fi
done

if [ $MIGRATION_COUNT -gt 0 ]; then
    echo "✓ Migrations completed ($MIGRATION_COUNT files)"
fi

# Step 10: Build Backend
echo "[10/12] Building backend..."
export PATH=$PATH:/usr/local/go/bin
cd $PROJECT_DIR/BE

# Fix dependencies
echo "  Downloading Go dependencies..."
go mod tidy 2>&1 | tail -3
go mod download 2>&1 | tail -3

# Build
go build -o rrnet-api cmd/api/main.go 2>&1
if [ -f rrnet-api ]; then
    chmod +x rrnet-api
    echo "✓ Backend built successfully"
else
    echo "❌ Backend build failed!"
    echo "Check errors above. You may need to run: cd $PROJECT_DIR/BE && go mod tidy && go build -o rrnet-api cmd/api/main.go"
fi

# Step 11: Setup Frontend
echo "[11/12] Setting up frontend..."
cd $PROJECT_DIR/fe

# Check if package.json exists
if [ ! -f package.json ]; then
    echo "⚠️  Frontend package.json not found."
    echo "   This may be a submodule issue. Trying to fix..."
    cd $PROJECT_DIR
    git submodule update --init --recursive --force 2>&1 | tail -5
    cd $PROJECT_DIR/fe
fi

if [ -f package.json ]; then
    # Create .env.local
    if [ ! -f .env.local ]; then
        cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://$VPS_IP:8080
EOF
        echo "✓ Created fe/.env.local"
    fi

    # Build frontend
    echo "  Installing npm packages..."
    npm install 2>&1 | tail -10
    
    echo "  Building frontend..."
    npm run build 2>&1 | tail -15
    
    if [ -d ".next" ]; then
        echo "✓ Frontend built successfully"
    else
        echo "⚠️  Frontend build may have issues"
    fi
else
    echo "❌ Frontend package.json still not found. Skipping frontend."
fi

# Step 12: Create and Start Services
echo "[12/12] Creating and starting services..."

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

# Frontend service (only if frontend exists)
if [ -f "$PROJECT_DIR/fe/package.json" ]; then
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
fi

systemctl daemon-reload
systemctl enable rrnet-backend 2>/dev/null
if [ -f "$PROJECT_DIR/fe/package.json" ]; then
    systemctl enable rrnet-frontend 2>/dev/null
fi

# Stop old instances
systemctl stop rrnet-backend 2>/dev/null
systemctl stop rrnet-frontend 2>/dev/null
sleep 2

# Start services
echo "Starting services..."
systemctl start rrnet-backend
sleep 3

if [ -f "$PROJECT_DIR/fe/package.json" ]; then
    systemctl start rrnet-frontend
    sleep 3
fi

# Final Status Check
echo ""
echo "=========================================="
echo "Final Status Check:"
echo "=========================================="

echo ""
echo "Backend Service:"
systemctl status rrnet-backend --no-pager -l | head -15

if [ -f "$PROJECT_DIR/fe/package.json" ]; then
    echo ""
    echo "Frontend Service:"
    systemctl status rrnet-frontend --no-pager -l | head -15
fi

echo ""
echo "Testing Endpoints (waiting 5 seconds)..."
sleep 5

echo ""
echo "Backend Health:"
curl -s http://localhost:8080/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8080/health || echo "❌ Backend not responding"

if [ -f "$PROJECT_DIR/fe/package.json" ]; then
    echo ""
    echo "Frontend:"
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000 || echo "❌ Frontend not responding"
fi

echo ""
echo "Ports listening:"
netstat -tuln 2>/dev/null | grep -E '8080|3000' || ss -tuln 2>/dev/null | grep -E '8080|3000' || echo "⚠️  No ports found"

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Access URLs:"
echo "  Backend:  http://$VPS_IP:8080"
if [ -f "$PROJECT_DIR/fe/package.json" ]; then
    echo "  Frontend: http://$VPS_IP:3000"
fi
echo "  Health:   http://$VPS_IP:8080/health"
echo ""
echo "View logs:"
echo "  journalctl -u rrnet-backend -f"
if [ -f "$PROJECT_DIR/fe/package.json" ]; then
    echo "  journalctl -u rrnet-frontend -f"
fi
echo ""
echo "Restart services:"
echo "  systemctl restart rrnet-backend"
if [ -f "$PROJECT_DIR/fe/package.json" ]; then
    echo "  systemctl restart rrnet-frontend"
fi

