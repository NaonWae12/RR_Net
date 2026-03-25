#!/bin/bash
# Status helper for L2TP/IPSec VPN SERVER on VPS
#
# Usage:
#   sudo bash scripts/vpn_server_status.sh
#
# Changelog:
# 2026-03-25 - Updated chap-secrets display:
#   - Filter changed from $2=="l2tpd" to all non-comment entries.
#     Reason: server field is now '*' (wildcard) in both script and Go code.
#     Old filter missed all entries written by Go's allocateVPNIP().

set -euo pipefail

echo "=========================================="
echo "VPN SERVER Status (L2TP/IPSec)"
echo "=========================================="
echo ""

echo "Services:"
# Auto-detect strongswan unit
STRONGSWAN_UNIT=""
for CANDIDATE in strongswan-swanctl strongswan-starter strongswan charon; do
  if systemctl list-unit-files "${CANDIDATE}.service" 2>/dev/null | grep -q "${CANDIDATE}.service"; then
    STRONGSWAN_UNIT="${CANDIDATE}"
    break
  fi
done

if [ -n "${STRONGSWAN_UNIT}" ]; then
  systemctl is-active --quiet "${STRONGSWAN_UNIT}" && echo "  ✓ strongswan (${STRONGSWAN_UNIT}): running" || echo "  ✗ strongswan (${STRONGSWAN_UNIT}): stopped"
else
  echo "  ? strongswan: service unit not found"
fi

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

echo "Users in /etc/ppp/chap-secrets (name + assigned IP):"
if [ -f /etc/ppp/chap-secrets ]; then
  # Show all non-comment, non-empty lines regardless of server field.
  # Server field is '*' (wildcard) for entries from Go (allocateVPNIP) and this script.
  # Old entries written by install_vpn_server.sh may still use 'l2tpd' — both are shown here.
  awk 'NF>=3 && substr($1,1,1) != "#" {
    ip = (NF>=4) ? $4 : "(dynamic)"
    print "  - " $1 "  ip=" ip
  }' /etc/ppp/chap-secrets | head -50
else
  echo "  (no chap-secrets found)"
fi
echo ""

echo "=========================================="
echo "Done."
echo "=========================================="


