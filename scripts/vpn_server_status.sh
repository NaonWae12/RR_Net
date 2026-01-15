#!/bin/bash
# Status helper for L2TP/IPSec VPN SERVER on VPS
#
# Usage:
#   sudo bash scripts/vpn_server_status.sh

set -euo pipefail

echo "=========================================="
echo "VPN SERVER Status (L2TP/IPSec)"
echo "=========================================="
echo ""

echo "Services:"
systemctl is-active --quiet strongswan && echo "  ✓ strongswan: running" || echo "  ✗ strongswan: stopped"
systemctl is-active --quiet xl2tpd && echo "  ✓ xl2tpd: running" || echo "  ✗ xl2tpd: stopped"
echo ""

echo "Listening ports (500/4500/1701):"
if command -v ss >/dev/null 2>&1; then
  ss -lunp | grep -E ":(500|4500|1701)\b" || echo "  (no udp listeners found; check services/firewall)"
else
  netstat -lunp 2>/dev/null | grep -E ":(500|4500|1701)\b" || echo "  (no udp listeners found; check services/firewall)"
fi
echo ""

echo "IPSec summary:"
if command -v ipsec >/dev/null 2>&1; then
  ipsec status | head -40 || true
else
  echo "  ipsec command not found"
fi
echo ""

echo "PPP/L2TP interfaces:"
ip addr | grep -E "ppp|l2tp" -n || echo "  (none)"
echo ""

echo "Active PPP sessions (if any):"
if [ -d /var/run/xl2tpd ]; then
  ls -la /var/run/xl2tpd 2>/dev/null || true
fi
echo ""

echo "Users in /etc/ppp/chap-secrets (names only):"
if [ -f /etc/ppp/chap-secrets ]; then
  awk 'NF>=3 && $2=="l2tpd" {print "  - " $1}' /etc/ppp/chap-secrets | head -50
else
  echo "  (no chap-secrets found)"
fi
echo ""

echo "=========================================="
echo "Done."
echo "=========================================="


