#!/bin/bash
# Script untuk cek status backend di VPS

echo "=========================================="
echo "Cek Status Backend di VPS"
echo "=========================================="
echo ""

PROJECT_DIR="/opt/rrnet"

echo "1. Cek apakah backend service running..."
if systemctl is-active --quiet rrnet-backend; then
    echo "   ✓ Backend service: RUNNING"
    echo ""
    systemctl status rrnet-backend --no-pager -l | head -15
else
    echo "   ✗ Backend service: STOPPED"
    echo ""
    echo "   Cek log error:"
    journalctl -u rrnet-backend -n 20 --no-pager
fi

echo ""
echo "2. Cek apakah backend binary ada dan terbaru..."
if [ -f "$PROJECT_DIR/BE/rrnet-api" ]; then
    echo "   ✓ Backend binary ditemukan"
    ls -lh "$PROJECT_DIR/BE/rrnet-api"
    echo ""
    echo "   Last modified:"
    stat -c "%y" "$PROJECT_DIR/BE/rrnet-api" 2>/dev/null || stat -f "%Sm" "$PROJECT_DIR/BE/rrnet-api" 2>/dev/null
else
    echo "   ✗ Backend binary tidak ditemukan di $PROJECT_DIR/BE/rrnet-api"
fi

echo ""
echo "3. Cek git status (apakah sudah pull terbaru)..."
cd "$PROJECT_DIR" 2>/dev/null || {
    echo "   ✗ Project directory tidak ditemukan: $PROJECT_DIR"
    exit 1
}

echo "   Current commit:"
git log -1 --oneline 2>/dev/null || echo "   (tidak bisa akses git)"

echo ""
echo "   Status perubahan:"
git status --short 2>/dev/null || echo "   (tidak bisa akses git)"

echo ""
echo "4. Cek apakah backend listening di port 8080..."
if command -v netstat &> /dev/null; then
    if netstat -tuln 2>/dev/null | grep -q ":8080"; then
        echo "   ✓ Port 8080 sedang digunakan"
        netstat -tuln 2>/dev/null | grep ":8080"
    else
        echo "   ✗ Port 8080 tidak digunakan (backend mungkin tidak running)"
    fi
elif command -v ss &> /dev/null; then
    if ss -tuln 2>/dev/null | grep -q ":8080"; then
        echo "   ✓ Port 8080 sedang digunakan"
        ss -tuln 2>/dev/null | grep ":8080"
    else
        echo "   ✗ Port 8080 tidak digunakan (backend mungkin tidak running)"
    fi
else
    echo "   (netstat/ss tidak tersedia)"
fi

echo ""
echo "5. Test backend health endpoint..."
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null)
if [ "$HEALTH_CODE" = "200" ]; then
    echo "   ✓ Backend health check: OK (HTTP $HEALTH_CODE)"
    echo ""
    echo "   Response:"
    curl -s http://localhost:8080/health 2>/dev/null | head -5
else
    echo "   ✗ Backend health check: FAILED (HTTP $HEALTH_CODE)"
fi

echo ""
echo "=========================================="
echo "Selesai!"
echo "=========================================="

