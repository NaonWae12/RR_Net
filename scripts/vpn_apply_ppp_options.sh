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
#   - adds MSS Clamping     (blocks TCP fragmentation issues for Winbox/API)
#   - sets uniqueids=no     (allows multiple routers behind same NAT/Public IP)
#   - adds overlapip=yes    (allows IP overlap for multiple SAs)
#   - sets fragmentation=yes (better handling of flaky network paths)

set -euo pipefail

PPP_OPTS="/etc/ppp/options.xl2tpd"
IPSEC_CONF="/etc/ipsec.conf"

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
  echo "[4/5] proxyarp removed"
else
  echo "[4/5] proxyarp not present (already clean)"
fi

# 5. Add MSS Clamping for VPN stability (Winbox Fix)
#    Blocks fragmentation issues for large TCP packets.
echo "[5/5] Checking MSS Clamping in iptables..."
if ! iptables -t mangle -C FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu 2>/dev/null; then
  iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
  echo "      - Added MSS Clamping rule to iptables mangle FORWARD"
fi

echo ""
echo "Tuning IPSec Config (/etc/ipsec.conf)..."
if [ -f "${IPSEC_CONF}" ]; then
  # 1. uniqueids=no is CRITICAL for multiple routers behind same NAT (SLA 99.98%)
  if grep -q "uniqueids=" "${IPSEC_CONF}"; then
    if ! grep -q "uniqueids=no" "${IPSEC_CONF}"; then
       sed -i "s/uniqueids=.*/uniqueids=no/" "${IPSEC_CONF}"
       echo "   - uniqueids -> no (updated)"
    else
       echo "   - uniqueids already set to no"
    fi
  else
    # Insert under config setup
    sed -i "/config setup/a \    uniqueids=no" "${IPSEC_CONF}"
    echo "   - uniqueids=no (added)"
  fi

  # 1b. overlapip=yes is a legacy but helpful option for IP collisions
  if ! grep -q "overlapip=yes" "${IPSEC_CONF}"; then
    if grep -q "config setup" "${IPSEC_CONF}"; then
      sed -i "/config setup/a \    overlapip=yes" "${IPSEC_CONF}"
      echo "   - overlapip=yes (added)"
    fi
  fi
  
  # 2. Add tuning to existing L2TP conn if present
  #    Ensures tunnel drops are detected quickly and reconnectable
  if grep -q "conn L2TP-PSK" "${IPSEC_CONF}"; then
    # Set rekey=no for multi-router stability behind same NAT
    if ! grep -q "rekey=no" "${IPSEC_CONF}"; then
      sed -i "/conn L2TP-PSK/a \  rekey=no" "${IPSEC_CONF}"
      echo "   - rekey=no (added to conn)"
    fi
    # Enable fragmentation handling
    if ! grep -q "fragmentation=yes" "${IPSEC_CONF}"; then
      sed -i "/conn L2TP-PSK/a \  fragmentation=yes" "${IPSEC_CONF}"
      echo "   - fragmentation=yes (added to conn)"
    fi
    # Set DPD delay
    if grep -q "dpddelay=" "${IPSEC_CONF}"; then
      sed -i "s/dpddelay=.*/dpddelay=30s/" "${IPSEC_CONF}"
    else
      sed -i "/conn L2TP-PSK/a \  dpddelay=30s" "${IPSEC_CONF}"
    fi
  fi
else
  echo "WARNING: ${IPSEC_CONF} not found, skipping tuning"
fi

echo ""
echo "After (PPP Options):"
echo "------"
cat "${PPP_OPTS}"
echo ""

echo "Restarting xl2tpd to apply changes..."
systemctl restart xl2tpd
echo "✓ xl2tpd restarted"
echo ""

# Unit name differs by distro — auto-detect to avoid 'Unit file does not exist' errors:
#   Debian 12 (Bookworm): strongswan-swanctl or charon
#   Debian 11 / Ubuntu 20-22: strongswan-starter
#   Some distros use 'ipsec' as alias
echo "Checking strongswan autostart..."
CANDIDATES=("ipsec" "strongswan-swanctl" "strongswan-starter" "strongswan" "charon")
STRONGSWAN_UNIT=""

for CANDIDATE in "${CANDIDATES[@]}"; do
  if systemctl list-unit-files "${CANDIDATE}.service" 2>/dev/null | grep -q "${CANDIDATE}.service"; then
    STRONGSWAN_UNIT="${CANDIDATE}"
    # Force enable EVERY match to be safe
    systemctl enable "${CANDIDATE}" > /dev/null 2>&1 || true
    echo "   - Enabled: ${CANDIDATE}.service"
  fi
done

if [ -n "${STRONGSWAN_UNIT}" ]; then
  # Restart to apply ipsec.conf changes
  systemctl restart "${STRONGSWAN_UNIT}"
  echo "✓ strongswan (${STRONGSWAN_UNIT}) RESTARTED and fully enabled"
else
  echo "WARNING: could not detect strongswan service unit!"
  echo "  IPSec may not survive a reboot. Check manually:"
  echo "  systemctl list-units | grep -iE 'strongswan|charon|ipsec'"
fi
echo ""

echo "✓ Done. Active VPN tunnels (ppp interfaces):"
ip addr show | grep -E "ppp[0-9]" | awk '{print "  " $0}' || echo "  (none active)"
echo ""
echo "Note: existing connected routers are NOT disconnected by this change."
echo "  New PPP options take effect for NEW connections only."
