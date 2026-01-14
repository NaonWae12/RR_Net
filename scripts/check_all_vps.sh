#!/bin/bash
# All-in-one checklist script untuk VPS

echo "=========================================="
echo "RRNET - Complete Checklist Script"
echo "=========================================="
echo ""

ROUTER_IP="36.70.234.179"
ROUTER_PORT="8728"
VPS_IP="72.60.74.209"
PROJECT_DIR="/opt/rrnet"

echo "CHECKLIST 1: Test Koneksi VPS → MikroTik"
echo "----------------------------------------"
timeout 5 bash -c "echo > /dev/tcp/$ROUTER_IP/$ROUTER_PORT" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ Port $ROUTER_PORT bisa diakses dari VPS"
    echo "  → Koneksi network OK"
else
    echo "✗ Port $ROUTER_PORT TIDAK bisa diakses"
    echo "  → Periksa firewall MikroTik"
    echo "  → Pastikan rule allow IP VPS ($VPS_IP) sudah ada"
fi
echo ""

echo "CHECKLIST 2: Backend Service Status"
echo "----------------------------------------"
if systemctl is-active --quiet rrnet-backend; then
    echo "✓ Backend service: RUNNING"
    echo "  Status:"
    systemctl status rrnet-backend --no-pager | head -5
else
    echo "✗ Backend service: STOPPED"
    echo "  → Jalankan: systemctl start rrnet-backend"
    echo "  → Cek log: journalctl -u rrnet-backend -n 20"
fi
echo ""

echo "CHECKLIST 3: Backend Binary"
echo "----------------------------------------"
if [ -f "$PROJECT_DIR/BE/rrnet-api" ]; then
    echo "✓ Backend binary ditemukan"
    if command -v stat &> /dev/null; then
        echo "  Last modified: $(stat -c "%y" "$PROJECT_DIR/BE/rrnet-api" 2>/dev/null | cut -d' ' -f1,2 || stat -f "%Sm" "$PROJECT_DIR/BE/rrnet-api" 2>/dev/null)"
    fi
else
    echo "✗ Backend binary tidak ditemukan"
    echo "  → Rebuild: cd $PROJECT_DIR/BE && go build -o rrnet-api ./cmd/api"
fi
echo ""

echo "CHECKLIST 4: Git Status"
echo "----------------------------------------"
cd "$PROJECT_DIR" 2>/dev/null && {
    echo "Current commit: $(git log -1 --oneline 2>/dev/null || echo 'N/A')"
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        echo "⚠ Ada perubahan yang belum di-commit"
        git status --short 2>/dev/null | head -5
    else
        echo "✓ Working directory clean"
    fi
} || echo "✗ Project directory tidak ditemukan: $PROJECT_DIR"
echo ""

echo "CHECKLIST 5: Backend Health"
echo "----------------------------------------"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null)
if [ "$HEALTH" = "200" ]; then
    echo "✓ Backend health check: OK"
    echo "  Response:"
    curl -s http://localhost:8080/health 2>/dev/null | head -3
else
    echo "✗ Backend health check: FAILED (HTTP $HEALTH)"
fi
echo ""

echo "=========================================="
echo "Selesai!"
echo "=========================================="
echo ""
echo "Jika ada checklist yang ✗, ikuti instruksi yang diberikan."

