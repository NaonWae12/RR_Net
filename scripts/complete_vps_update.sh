#!/bin/bash
# Complete VPS Update Script
# Run this on VPS after copying fixed files

set -e

DEPLOY_DIR="/opt/rrnet"

echo "========================================"
echo "Step 1: Updating frontend dependencies..."
echo "========================================"
cd "$DEPLOY_DIR/fe"
npm install --legacy-peer-deps
echo "Frontend dependencies updated!"

echo ""
echo "========================================"
echo "Step 2: Building frontend..."
echo "========================================"
npm run build
echo "Frontend build completed!"

echo ""
echo "========================================"
echo "Step 3: Running database migrations..."
echo "========================================"
cd "$DEPLOY_DIR/BE"
export PATH=$PATH:/usr/local/go/bin
export PATH=$PATH:/root/go/bin
if [ -d "migrations" ]; then
    migrate -path migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" up
    echo "Migrations completed!"
else
    echo "No migrations directory found, skipping..."
fi

echo ""
echo "========================================"
echo "Step 4: Restarting backend service..."
echo "========================================"
if systemctl is-active --quiet rrnet-backend; then
    systemctl restart rrnet-backend
    echo "Backend service restarted!"
    sleep 2
    systemctl status rrnet-backend --no-pager -l
elif [ -f "/etc/systemd/system/rrnet-backend.service" ]; then
    systemctl start rrnet-backend
    systemctl status rrnet-backend --no-pager -l
else
    echo "Backend service not found. Please create it manually."
fi

echo ""
echo "========================================"
echo "Update completed successfully!"
echo "========================================"

