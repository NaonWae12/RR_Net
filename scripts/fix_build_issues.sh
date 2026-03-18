#!/bin/bash

# Fix Build Issues Script
# Run this after quick_fix_vps.sh if build failed

set +e

echo "=========================================="
echo "RRNET Build Issues Fix Script"
echo "=========================================="

PROJECT_DIR="/opt/rrnet"

# Fix Go PATH
echo "[1] Fixing Go PATH..."
export PATH=$PATH:/usr/local/go/bin
if [ -f /root/.bashrc ]; then
    grep -q "export PATH.*go/bin" /root/.bashrc || echo 'export PATH=$PATH:/usr/local/go/bin' >> /root/.bashrc
fi

# Verify Go
if ! command -v go &> /dev/null; then
    echo "❌ Go still not found. Installing..."
    cd /tmp
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    export PATH=$PATH:/usr/local/go/bin
fi
go version

# Fix Backend - Download dependencies
echo "[2] Fixing backend dependencies..."
cd $PROJECT_DIR/BE
export PATH=$PATH:/usr/local/go/bin

# Run go mod tidy and download
go mod tidy 2>&1
go mod download 2>&1

# Build backend
echo "[3] Building backend..."
go build -o rrnet-api cmd/api/main.go 2>&1
if [ -f rrnet-api ]; then
    chmod +x rrnet-api
    echo "✓ Backend built successfully"
else
    echo "❌ Backend build still failed. Check errors above."
    exit 1
fi

# Fix Frontend - Check if submodule
echo "[4] Fixing frontend..."
cd $PROJECT_DIR

# Check if fe is submodule
if [ -f .gitmodules ]; then
    echo "Initializing submodules..."
    git submodule update --init --recursive 2>&1
fi

# Check if fe/package.json exists
if [ ! -f "fe/package.json" ]; then
    echo "⚠️  Frontend package.json not found. Checking fe directory..."
    ls -la fe/ 2>/dev/null || echo "fe directory doesn't exist"
    
    # Try to clone fe separately if it's a separate repo
    echo "Attempting to fix frontend..."
    if [ -d "fe/.git" ]; then
        cd fe
        git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true
        cd ..
    fi
fi

# Build frontend if package.json exists
if [ -f "fe/package.json" ]; then
    echo "[5] Building frontend..."
    cd $PROJECT_DIR/fe
    npm install 2>&1 | tail -10
    npm run build 2>&1 | tail -15
    
    if [ -d ".next" ]; then
        echo "✓ Frontend built successfully"
    else
        echo "⚠️  Frontend build may have issues"
    fi
else
    echo "❌ Frontend package.json still not found. Skipping frontend build."
    echo "   You may need to manually clone the frontend repository."
fi

# Run migrations if not done
echo "[6] Running database migrations..."
cd $PROJECT_DIR/BE

# Install extensions
if [ -f "migrations/init/001_init_extensions.sql" ]; then
    sudo -u postgres psql -d rrnet_dev -f migrations/init/001_init_extensions.sql 2>/dev/null || true
fi

# Run migrations
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

# Restart services
echo "[7] Restarting services..."
systemctl daemon-reload
systemctl restart rrnet-backend
sleep 3
systemctl restart rrnet-frontend
sleep 3

# Check status
echo ""
echo "=========================================="
echo "Service Status:"
echo "=========================================="
systemctl status rrnet-backend --no-pager -l | head -20
echo ""
systemctl status rrnet-frontend --no-pager -l | head -20

# Test endpoints
echo ""
echo "=========================================="
echo "Testing Endpoints:"
echo "=========================================="
sleep 5

echo "Backend Health:"
curl -s http://localhost:8080/health || echo "❌ Backend not responding"
echo ""

echo "Frontend:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000 || echo "❌ Frontend not responding"
echo ""

echo "Ports:"
netstat -tuln 2>/dev/null | grep -E '8080|3000' || ss -tuln 2>/dev/null | grep -E '8080|3000' || echo "⚠️  Ports not found"

echo ""
echo "=========================================="
echo "Fix Complete!"
echo "=========================================="
echo ""
echo "If services still fail, check logs:"
echo "  journalctl -u rrnet-backend -n 50"
echo "  journalctl -u rrnet-frontend -n 50"


