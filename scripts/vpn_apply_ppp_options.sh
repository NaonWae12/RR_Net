#!/bin/bash
# vpn_apply_ppp_options.sh
# Apply updated PPP options to a RUNNING VPN server WITHOUT full reinstall.
#
# Run this AFTER 'git pull' when ppp options have changed (idle, lcp-echo, proxyarp).
# This script is idempotent — safe to run multiple times.
#
# Usage:
#   sudo bash scripts/vpn_apply_ppp_options.sh
#
# What it changes in /etc/ppp/options.xl2tpd:
#   - idle 0            (was 1800: prevent disconnect during low-traffic periods)
#   - lcp-echo-interval 60  (was 30: less aggressive keepalive)
#   - lcp-echo-failure 5    (was 4:  5 min tolerance before drop, was 2 min)
#   - removes proxyarp      (caused ARP conflicts when 2+ routers connect)

set -euo pipefail

PPP_OPTS="/etc/ppp/options.xl2tpd"

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: please run as root"
  exit 1
fi

if [ ! -f "${PPP_OPTS}" ]; then
  echo "ERROR: ${PPP_OPTS} not found."
  echo "  Run 'bash scripts/install_vpn_server.sh' first to set up the VPN server."
  exit 1
fi

echo "=========================================="
echo "Apply PPP Options Fix (vpn_apply_ppp_options)"
echo "=========================================="
echo ""
echo "Before:"
echo "-------"
cat "${PPP_OPTS}"
echo ""

# 1. Fix idle timeout: 0 = never disconnect due to inactivity.
#    Previously 1800 (30 min) caused VPN to drop during low-traffic periods.
if grep -q "^idle " "${PPP_OPTS}"; then
  sed -i "s/^idle .*/idle 0/" "${PPP_OPTS}"
  echo "[1/4] idle -> 0 (was: $(grep -oP '(?<=^idle )\d+' "${PPP_OPTS}" || echo 'updated'))"
else
  echo "idle 0" >> "${PPP_OPTS}"
  echo "[1/4] idle 0 added"
fi

# 2. Fix lcp-echo-interval: 60s (was 30s).
if grep -q "^lcp-echo-interval " "${PPP_OPTS}"; then
  sed -i "s/^lcp-echo-interval .*/lcp-echo-interval 60/" "${PPP_OPTS}"
  echo "[2/4] lcp-echo-interval -> 60"
else
  echo "lcp-echo-interval 60" >> "${PPP_OPTS}"
  echo "[2/4] lcp-echo-interval 60 added"
fi

# 3. Fix lcp-echo-failure: 5 (was 4). 5 x 60s = 5 min tolerance.
if grep -q "^lcp-echo-failure " "${PPP_OPTS}"; then
  sed -i "s/^lcp-echo-failure .*/lcp-echo-failure 5/" "${PPP_OPTS}"
  echo "[3/4] lcp-echo-failure -> 5"
else
  echo "lcp-echo-failure 5" >> "${PPP_OPTS}"
  echo "[3/4] lcp-echo-failure 5 added"
fi

# 4. Remove proxyarp: caused ARP conflicts when multiple routers connect simultaneously.
#    Each router has a unique static IP in chap-secrets, so proxyarp is not needed.
if grep -q "^proxyarp" "${PPP_OPTS}"; then
  sed -i "/^proxyarp/d" "${PPP_OPTS}"
  echo "[4/4] proxyarp removed"
else
  echo "[4/4] proxyarp not present (already clean)"
fi

echo ""
echo "After:"
echo "------"
cat "${PPP_OPTS}"
echo ""

echo "Restarting xl2tpd to apply changes..."
systemctl restart xl2tpd
echo "✓ xl2tpd restarted"
echo ""

echo "✓ Done. Active VPN tunnels (ppp interfaces):"
ip addr show | grep -E "ppp[0-9]" | awk '{print "  " $0}' || echo "  (none active)"
echo ""
echo "Note: existing connected routers are NOT disconnected by this change."
echo "  New PPP options take effect for NEW connections only."
