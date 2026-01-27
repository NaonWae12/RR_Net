#!/bin/bash
# Manual Fix Script for VPS
# Copy this script to VPS and run it
# Usage: bash VPS_MANUAL_FIX.sh

set -e

DEPLOY_DIR="/opt/rrnet"

echo "========================================"
echo "Manual Fix for VPS"
echo "========================================"
echo ""

# Step 1: Fix clientService.ts
echo "Step 1: Fixing clientService.ts..."
cd "$DEPLOY_DIR/fe/src/lib/api"

# Backup original file
cp clientService.ts clientService.ts.backup

# Check if discount fields already exist
if ! grep -q "discount_type" clientService.ts; then
    # Add discount fields after discount_id
    sed -i '/discount_id?: string | null;/a\  // Discount fields (populated when discount is included in response)\n  discount_type?: '\''percent'\'' | '\''fixed'\'' | null;\n  discount_value?: number | null;' clientService.ts
    echo "✅ Added discount_type and discount_value to Client interface"
else
    echo "✅ discount_type and discount_value already exist"
fi

# Step 2: Update frontend dependencies
echo ""
echo "========================================"
echo "Step 2: Updating frontend dependencies..."
echo "========================================"
cd "$DEPLOY_DIR/fe"
npm install --legacy-peer-deps
echo "✅ Frontend dependencies updated!"

# Step 3: Build frontend
echo ""
echo "========================================"
echo "Step 3: Building frontend..."
echo "========================================"
npm run build
echo "✅ Frontend build completed!"

# Step 4: Run migrations
echo ""
echo "========================================"
echo "Step 4: Running database migrations..."
echo "========================================"
cd "$DEPLOY_DIR/BE"
export PATH=$PATH:/usr/local/go/bin
export PATH=$PATH:/root/go/bin
if [ -d "migrations" ]; then
    migrate -path migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" up
    echo "✅ Migrations completed!"
else
    echo "⚠️ No migrations directory found, skipping..."
fi

# Step 5: Restart backend
echo ""
echo "========================================"
echo "Step 5: Restarting backend service..."
echo "========================================"
if systemctl is-active --quiet rrnet-backend; then
    systemctl restart rrnet-backend
    echo "✅ Backend service restarted!"
    sleep 2
    systemctl status rrnet-backend --no-pager -l | head -10
elif [ -f "/etc/systemd/system/rrnet-backend.service" ]; then
    systemctl start rrnet-backend
    systemctl status rrnet-backend --no-pager -l | head -10
else
    echo "⚠️ Backend service not found. Please create it manually."
fi

echo ""
echo "========================================"
echo "✅ All fixes completed!"
echo "========================================"






