#!/bin/bash
# Script untuk pull, rebuild, dan test backend

echo "=========================================="
echo "Deploy dan Test Backend"
echo "=========================================="
echo ""

PROJECT_DIR="/opt/rrnet"
ROUTER_IP="36.70.234.179"
ROUTER_PORT="8728"

cd "$PROJECT_DIR" || {
    echo "✗ Project directory tidak ditemukan: $PROJECT_DIR"
    exit 1
}

echo "Step 1: Pull perubahan terbaru dari GitHub..."
git pull origin main

if [ $? -ne 0 ]; then
    echo "✗ Git pull failed!"
    exit 1
fi

echo "✓ Code updated"
echo ""

echo "Step 2: Rebuild Backend..."
cd "$PROJECT_DIR/BE" || exit 1

# Update Go dependencies
echo "  Updating dependencies..."
go mod tidy
go mod download

# Build
echo "  Building backend..."
go build -o rrnet-api ./cmd/api

if [ $? -ne 0 ]; then
    echo "✗ Backend build failed!"
    exit 1
fi

echo "✓ Backend built successfully"
echo ""

echo "Step 3: Restart Backend Service..."
systemctl restart rrnet-backend
sleep 3

if systemctl is-active --quiet rrnet-backend; then
    echo "✓ Backend service restarted"
else
    echo "✗ Backend service failed to start!"
    echo ""
    echo "Log error:"
    journalctl -u rrnet-backend -n 30 --no-pager
    exit 1
fi

echo ""
echo "Step 4: Test Backend Health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null)
if [ "$HEALTH" = "200" ]; then
    echo "✓ Backend health check: OK"
else
    echo "✗ Backend health check: FAILED (HTTP $HEALTH)"
fi

echo ""
echo "Step 5: Test Koneksi ke MikroTik..."
timeout 5 bash -c "echo > /dev/tcp/$ROUTER_IP/$ROUTER_PORT" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ Port $ROUTER_PORT bisa diakses dari VPS"
else
    echo "✗ Port $ROUTER_PORT TIDAK bisa diakses"
    echo "  → Periksa firewall MikroTik"
fi

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Services Status:"
systemctl is-active rrnet-backend >/dev/null 2>&1 && echo "  ✓ Backend: Running" || echo "  ✗ Backend: Stopped"
echo ""
echo "Application URLs:"
echo "  Backend:  http://localhost:8080"
echo "  Health:   http://localhost:8080/health"
echo ""

