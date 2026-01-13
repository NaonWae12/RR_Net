#!/bin/bash

# Check and Fix VPS Deployment Issues
# Don't exit on error, continue to fix all issues
set +e

echo "=========================================="
echo "RRNET VPS Check & Fix Script"
echo "=========================================="

PROJECT_DIR="/opt/rrnet"
VPS_IP="72.60.74.209"

# Check if project directory exists
echo "[1] Checking project directory..."
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Project directory not found. Cloning repository..."
    mkdir -p $PROJECT_DIR
    cd $PROJECT_DIR
    git clone https://github.com/NaonWae12/RR_Net.git .
else
    echo "✓ Project directory exists"
    cd $PROJECT_DIR
    echo "Updating repository..."
    git pull origin main || echo "Git pull failed, continuing..."
fi

# Check Go installation
echo "[2] Checking Go installation..."
if ! command -v go &> /dev/null; then
    echo "❌ Go not found. Installing..."
    cd /tmp
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /root/.bashrc
    export PATH=$PATH:/usr/local/go/bin
fi
go version

# Check Node.js installation
echo "[3] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y -qq nodejs
fi
node --version

# Check PostgreSQL
echo "[4] Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found. Installing..."
    apt-get update -qq
    apt-get install -y -qq postgresql postgresql-contrib
fi

# Start and enable PostgreSQL
systemctl start postgresql 2>/dev/null || service postgresql start
systemctl enable postgresql 2>/dev/null || true

# Wait for PostgreSQL to be ready
sleep 3

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE rrnet_dev;" 2>/dev/null || echo "Database may already exist"
sudo -u postgres psql -c "CREATE USER rrnet WITH PASSWORD 'rrnet_secret';" 2>/dev/null || echo "User may already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE rrnet_dev TO rrnet;" 2>/dev/null || true
sudo -u postgres psql -c "ALTER USER rrnet CREATEDB;" 2>/dev/null || true
echo "✓ PostgreSQL configured"

# Check Redis
echo "[5] Checking Redis..."
if ! command -v redis-cli &> /dev/null; then
    echo "❌ Redis not found. Installing..."
    apt-get update -qq
    apt-get install -y -qq redis-server
fi

systemctl enable redis-server 2>/dev/null || true
systemctl start redis-server 2>/dev/null || service redis-server start
sleep 2
redis-cli ping > /dev/null 2>&1 && echo "✓ Redis is running" || echo "⚠️  Redis may not be running"

# Setup Backend .env
echo "[6] Setting up backend environment..."
cd $PROJECT_DIR/BE
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
    echo "✓ Created BE/.env"
fi

# Build Backend
echo "[7] Building backend..."
export PATH=$PATH:/usr/local/go/bin
cd $PROJECT_DIR/BE
go mod download
go build -o rrnet-api cmd/api/main.go
chmod +x rrnet-api
echo "✓ Backend built successfully"

# Setup Frontend .env
echo "[8] Setting up frontend environment..."
cd $PROJECT_DIR/fe
if [ ! -f .env.local ]; then
    cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://$VPS_IP:8080
EOF
    echo "✓ Created fe/.env.local"
fi

# Build Frontend
echo "[9] Building frontend..."
cd $PROJECT_DIR/fe
npm install
npm run build
echo "✓ Frontend built successfully"

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
systemctl enable rrnet-backend rrnet-frontend

echo "✓ Systemd services created"

# Start services
echo "[11] Starting services..."
systemctl restart rrnet-backend
sleep 2
systemctl restart rrnet-frontend
sleep 2

# Check status
echo "[12] Checking service status..."
systemctl status rrnet-backend --no-pager -l
echo ""
systemctl status rrnet-frontend --no-pager -l

# Test endpoints
echo "[13] Testing endpoints..."
sleep 3
echo "Testing backend health..."
curl -s http://localhost:8080/health || echo "❌ Backend health check failed"
echo ""
echo "Testing frontend..."
curl -s -o /dev/null -w "Frontend status: %{http_code}\n" http://localhost:3000 || echo "❌ Frontend check failed"

# Check ports
echo "[14] Checking ports..."
netstat -tulpn | grep -E '8080|3000' || echo "⚠️  Ports not listening"

echo ""
echo "=========================================="
echo "Setup completed!"
echo "=========================================="
echo ""
echo "Access URLs:"
echo "  Backend:  http://$VPS_IP:8080"
echo "  Frontend: http://$VPS_IP:3000"
echo "  Health:   http://$VPS_IP:8080/health"
echo ""
echo "Check logs:"
echo "  journalctl -u rrnet-backend -f"
echo "  journalctl -u rrnet-frontend -f"

