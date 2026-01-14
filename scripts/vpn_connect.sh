#!/bin/bash
# Script untuk connect VPN ke MikroTik

echo "Connecting to MikroTik VPN..."

# Start services if not running
systemctl start strongswan 2>/dev/null || true
systemctl start xl2tpd 2>/dev/null || true

# Connect
echo "c mikrotik" > /var/run/xl2tpd/l2tp-control

# Wait for connection
sleep 5

# Check status
if ip addr show ppp0 &>/dev/null; then
    echo "✓ VPN Connected"
    echo ""
    echo "VPN Interface:"
    ip addr show ppp0 | grep "inet "
    echo ""
    echo "Test connection to MikroTik:"
    ping -c 2 10.10.10.1 2>/dev/null && echo "✓ Ping OK" || echo "⚠ Ping failed"
else
    echo "✗ VPN Connection Failed"
    echo ""
    echo "Check logs:"
    journalctl -u xl2tpd -n 10 --no-pager
fi

