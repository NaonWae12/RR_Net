#!/bin/bash
# Test koneksi dari VPS ke MikroTik API

echo "=========================================="
echo "Test Koneksi VPS → MikroTik"
echo "=========================================="
echo ""

ROUTER_IP="36.70.234.179"
ROUTER_PORT="8728"
VPS_IP="72.60.74.209"

echo "1. Test koneksi ke MikroTik API port..."
echo "   Target: $ROUTER_IP:$ROUTER_PORT"
echo "   From VPS: $VPS_IP"
echo ""

# Test dengan timeout 5 detik
timeout 5 bash -c "echo > /dev/tcp/$ROUTER_IP/$ROUTER_PORT" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "   ✓ Port $ROUTER_PORT terbuka dan bisa diakses"
    echo "   ✓ Koneksi network OK"
else
    echo "   ✗ Port $ROUTER_PORT tidak bisa diakses (timeout/refused)"
    echo ""
    echo "   Kemungkinan masalah:"
    echo "   - Firewall MikroTik belum allow IP VPS ($VPS_IP)"
    echo "   - Port forwarding belum benar"
    echo "   - API service belum enabled"
fi

echo ""
echo "2. Test dengan telnet (jika tersedia)..."
if command -v telnet &> /dev/null; then
    echo "   Testing: telnet $ROUTER_IP $ROUTER_PORT"
    timeout 5 telnet $ROUTER_IP $ROUTER_PORT 2>&1 | head -5
else
    echo "   telnet tidak tersedia, skip..."
fi

echo ""
echo "3. Test dengan nc (netcat) jika tersedia..."
if command -v nc &> /dev/null; then
    echo "   Testing: nc -zv $ROUTER_IP $ROUTER_PORT"
    timeout 5 nc -zv $ROUTER_IP $ROUTER_PORT 2>&1
else
    echo "   nc tidak tersedia, skip..."
fi

echo ""
echo "=========================================="
echo "Selesai!"
echo "=========================================="

