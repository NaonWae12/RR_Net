#!/bin/bash

# Quick Update Backend Script
# Pull latest code, rebuild, and restart

set +e

PROJECT_DIR="/opt/rrnet"

echo "=========================================="
echo "Updating Backend..."
echo "=========================================="

cd $PROJECT_DIR

# Pull latest code
echo "[1] Pulling latest code..."
git pull origin main

# Fix Go PATH
export PATH=$PATH:/usr/local/go/bin

# Rebuild backend
echo "[2] Rebuilding backend..."
cd $PROJECT_DIR/BE
go mod tidy 2>&1 | tail -3
go mod download 2>&1 | tail -3
go build -o rrnet-api cmd/api/main.go 2>&1

if [ -f rrnet-api ]; then
    chmod +x rrnet-api
    echo "✓ Backend rebuilt successfully"
    
    # Restart service
    echo "[3] Restarting backend service..."
    systemctl restart rrnet-backend
    sleep 3
    
    # Check status
    echo "[4] Checking service status..."
    systemctl status rrnet-backend --no-pager -l | head -15
    
    # Test health endpoint
    echo ""
    echo "[5] Testing health endpoint..."
    sleep 2
    curl -s http://localhost:8080/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8080/health
    echo ""
    
    echo "=========================================="
    echo "Update Complete!"
    echo "=========================================="
else
    echo "❌ Build failed. Check errors above."
    exit 1
fi


