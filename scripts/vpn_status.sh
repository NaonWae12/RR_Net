#!/bin/bash
# Script untuk cek status VPN

echo "=========================================="
echo "VPN Connection Status"
echo "=========================================="
echo ""

if ip addr show ppp0 &>/dev/null; then
    echo "✓ VPN Status: CONNECTED"
    echo ""
    echo "Interface Details:"
    ip addr show ppp0
    echo ""
    echo "Routes:"
    ip route | grep ppp0
    echo ""
    echo "Test Connection:"
    ping -c 3 10.10.10.1 2>/dev/null && echo "✓ MikroTik reachable" || echo "✗ MikroTik not reachable"
else
    echo "✗ VPN Status: NOT CONNECTED"
    echo ""
    echo "Services Status:"
    systemctl is-active strongswan >/dev/null 2>&1 && echo "  ✓ strongswan: Running" || echo "  ✗ strongswan: Stopped"
    systemctl is-active xl2tpd >/dev/null 2>&1 && echo "  ✓ xl2tpd: Running" || echo "  ✗ xl2tpd: Stopped"
    echo ""
    echo "To connect, run:"
    echo "  bash scripts/vpn_connect.sh"
fi

echo ""
echo "=========================================="

