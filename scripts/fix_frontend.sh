#!/bin/bash

# Fix Frontend Setup Script
# This will setup and build the frontend

set +e

PROJECT_DIR="/opt/rrnet"
VPS_IP="72.60.74.209"

echo "=========================================="
echo "Fixing Frontend Setup"
echo "=========================================="

cd $PROJECT_DIR

# Ensure we have latest code
echo "[1] Updating repository..."
# Discard any local changes to scripts
git checkout -- scripts/ 2>/dev/null || true
git pull origin main 2>/dev/null || true

# Check if fe directory exists
echo "[2] Checking frontend directory..."
if [ ! -d "fe" ]; then
    echo "❌ Frontend directory not found!"
    echo "   This shouldn't happen. Checking git status..."
    git status
    exit 1
fi

cd $PROJECT_DIR/fe

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in fe directory!"
    echo "   Listing fe directory:"
    ls -la
    echo ""
    echo "   Trying to restore from git..."
    git checkout fe/package.json 2>/dev/null || git restore fe/package.json 2>/dev/null || true
fi

if [ ! -f "package.json" ]; then
    echo "❌ Still can't find package.json. Frontend may not be in repository."
    exit 1
fi

echo "✓ Frontend directory and package.json found"

# Create .env.local if not exists
echo "[3] Setting up environment..."
if [ ! -f .env.local ]; then
    cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://$VPS_IP:8080/api/v1
EOF
    echo "✓ Created .env.local"
else
    echo "✓ .env.local already exists"
fi

# Check Node.js version
echo "[4] Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "⚠️  Node.js version is too old (need >=20.9.0)"
    echo "   Upgrading Node.js to version 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
    echo "   New Node.js version:"
    node --version
fi

# Install dependencies
echo "[5] Installing npm dependencies..."
echo "   This may take a few minutes..."
npm install --legacy-peer-deps 2>&1 | tail -20

if [ $? -ne 0 ]; then
    echo "⚠️  npm install had some issues, trying with --force..."
    npm install --force 2>&1 | tail -10
fi

# Verify node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found after install"
    exit 1
fi

# Build frontend
echo "[6] Building frontend..."
echo "   This may take 2-5 minutes..."
npm run build 2>&1 | tail -30

if [ -d ".next" ]; then
    echo "✓ Frontend built successfully"
else
    echo "❌ Frontend build failed!"
    echo "   Check errors above"
    exit 1
fi

# Create/update systemd service
echo "[7] Creating frontend systemd service..."
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
systemctl enable rrnet-frontend 2>/dev/null

# Start service
echo "[8] Starting frontend service..."
systemctl stop rrnet-frontend 2>/dev/null
sleep 2
systemctl start rrnet-frontend
sleep 5

# Check status
echo ""
echo "=========================================="
echo "Frontend Service Status:"
echo "=========================================="
systemctl status rrnet-frontend --no-pager -l | head -20

# Test endpoint
echo ""
echo "Testing frontend endpoint..."
sleep 3
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000 || echo "❌ Frontend not responding"

# Check port
echo ""
echo "Ports listening:"
netstat -tuln 2>/dev/null | grep -E '3000' || ss -tuln 2>/dev/null | grep -E '3000' || echo "⚠️  Port 3000 not found"

echo ""
echo "=========================================="
echo "Frontend Setup Complete!"
echo "=========================================="
echo ""
echo "Access URL:"
echo "  Frontend: http://$VPS_IP:3000"
echo ""
echo "View logs:"
echo "  journalctl -u rrnet-frontend -f"
echo ""
echo "If frontend is not working, check logs:"
echo "  journalctl -u rrnet-frontend -n 50"

