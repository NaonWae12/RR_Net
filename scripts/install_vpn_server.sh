#!/bin/bash
# Install & configure L2TP/IPSec VPN SERVER on VPS (strongSwan + xl2tpd)
#
# Model: MikroTik = VPN client (behind NAT ok) -> VPS = VPN server
#
# This script:
# - Installs strongswan + xl2tpd + ppp
# - Configures IPsec PSK (IKEv1) for L2TP
# - Configures xl2tpd LNS (server) with a VPN pool
# - Adds ONE initial VPN user to /etc/ppp/chap-secrets
# - Opens required ports in UFW (if present) or iptables
#
# Notes:
# - Re-run safely; it will overwrite config files but will not delete existing chap-secrets lines.
# - Do NOT commit generated secrets from /etc to git.
#
# Changelog:
# 2026-03-25 - Fix VPN stability & multi-router conflicts:
#   - Pool extended .100-.254 (was .100-.200) to match Go allocateVPNIP range
#   - Removed 'proxyarp' from ppp options (caused ARP conflicts when 2+ routers connect)
#   - idle set to 0 (was 1800) to prevent disconnect during low-traffic periods
#   - lcp-echo-interval 60 (was 30) + lcp-echo-failure 5 (was 4) = 5 min tolerance before drop
#   - chap-secrets server field changed to '*' (was 'l2tpd') to match Go allocateVPNIP format

set -euo pipefail

VPN_LOCAL_IP_DEFAULT="10.10.10.1"
VPN_POOL_START_DEFAULT="10.10.10.100"
# IMPORTANT: Pool end must match Go allocateVPNIP range (10.10.10.100-254).
# If this differs from Go code, routers assigned IPs above the pool end
# will connect to VPN but cannot be reached (IP outside xl2tpd DHCP range).
VPN_POOL_END_DEFAULT="10.10.10.254"

echo "=========================================="
echo "Install L2TP/IPSec VPN SERVER (VPS)"
echo "=========================================="
echo ""

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: please run as root"
  exit 1
fi

read -r -p "VPS public IP/domain (contoh 72.60.74.209): " VPS_PUBLIC
if [ -z "${VPS_PUBLIC}" ]; then
  echo "ERROR: VPS public IP/domain is required"
  exit 1
fi

read -r -p "IPSec PSK (secret): " VPN_PSK
if [ -z "${VPN_PSK}" ]; then
  echo "ERROR: IPSec PSK is required"
  exit 1
fi

read -r -p "Initial VPN username (contoh vpn-router-001): " VPN_USER
if [ -z "${VPN_USER}" ]; then
  echo "ERROR: VPN username is required"
  exit 1
fi

read -r -s -p "Initial VPN password: " VPN_PASS
echo ""
if [ -z "${VPN_PASS}" ]; then
  echo "ERROR: VPN password is required"
  exit 1
fi

read -r -p "VPN local IP [${VPN_LOCAL_IP_DEFAULT}]: " VPN_LOCAL_IP
VPN_LOCAL_IP="${VPN_LOCAL_IP:-$VPN_LOCAL_IP_DEFAULT}"

read -r -p "VPN pool start [${VPN_POOL_START_DEFAULT}]: " VPN_POOL_START
VPN_POOL_START="${VPN_POOL_START:-$VPN_POOL_START_DEFAULT}"

read -r -p "VPN pool end   [${VPN_POOL_END_DEFAULT}]: " VPN_POOL_END
VPN_POOL_END="${VPN_POOL_END:-$VPN_POOL_END_DEFAULT}"

echo ""
echo "Step 1: Install packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y strongswan xl2tpd ppp iptables
echo "✓ Packages installed"

echo ""
echo "Step 2: Enable IP forwarding..."
sysctl -w net.ipv4.ip_forward=1 >/dev/null
if ! grep -q "^net.ipv4.ip_forward=1" /etc/sysctl.conf; then
  echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
fi
echo "✓ IP forwarding enabled"

echo ""
echo "Step 3: Configure strongSwan (IPSec)..."
cat > /etc/ipsec.conf <<EOF
config setup
  uniqueids=no
  charondebug="ike 1, knl 1, cfg 0"

conn L2TP-PSK
  keyexchange=ikev1
  authby=secret
  type=transport
  left=%defaultroute
  leftid=${VPS_PUBLIC}
  leftprotoport=17/1701
  right=%any
  rightprotoport=17/%any
  auto=add
EOF

cat > /etc/ipsec.secrets <<EOF
${VPS_PUBLIC} : PSK "${VPN_PSK}"
EOF
chmod 600 /etc/ipsec.secrets
echo "✓ strongSwan configured"

echo ""
echo "Step 4: Configure xl2tpd (L2TP server)..."
cat > /etc/xl2tpd/xl2tpd.conf <<EOF
[global]
port = 1701

[lns default]
# Pool MUST match Go allocateVPNIP range: 10.10.10.100-254
ip range = ${VPN_POOL_START}-${VPN_POOL_END}
local ip = ${VPN_LOCAL_IP}
require chap = yes
refuse pap = yes
require authentication = yes
name = rrnet-vpn
ppp debug = no
pppoptfile = /etc/ppp/options.xl2tpd
length bit = yes
EOF

cat > /etc/ppp/options.xl2tpd <<'EOF'
ipcp-accept-local
ipcp-accept-remote
ms-dns 1.1.1.1
ms-dns 8.8.8.8
noccp
auth
# idle 0 = disable idle timeout.
# Previously was 1800 (30 min) which caused VPN to drop during low-traffic periods.
idle 0
mtu 1410
mru 1410
hide-password
# proxyarp REMOVED: caused ARP conflicts when multiple routers connect simultaneously.
# Each router gets a unique static IP via chap-secrets, so proxyarp is not needed.
# lcp-echo: 60s interval x 5 failures = 5 min tolerance before drop.
# Previously 30s x 4 = only 2 min, which was too aggressive for flaky networks.
lcp-echo-interval 60
lcp-echo-failure 5
EOF
chmod 600 /etc/ppp/options.xl2tpd
echo "✓ xl2tpd configured"

echo ""
echo "Step 5: Add initial VPN user (chap-secrets)..."
touch /etc/ppp/chap-secrets
chmod 600 /etc/ppp/chap-secrets

# Server field uses '*' (wildcard) to match any LNS name.
# IMPORTANT: Must use '*' (not 'l2tpd') to be consistent with Go's allocateVPNIP()
# which also writes '*'. Mixing 'l2tpd' and '*' causes auth failures for some users.
if grep -qE "^${VPN_USER}[[:space:]]+" /etc/ppp/chap-secrets; then
  echo "  User already exists in chap-secrets (skipping): ${VPN_USER}"
else
  echo "${VPN_USER} * ${VPN_PASS} *" >> /etc/ppp/chap-secrets
  echo "✓ Added user: ${VPN_USER}"
fi

echo ""
echo "Step 6: Open firewall ports (UDP 500/4500/1701 + ESP)..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 500/udp || true
  ufw allow 4500/udp || true
  ufw allow 1701/udp || true
  echo "✓ UFW rules applied (if UFW is enabled)"
else
  iptables -C INPUT -p udp --dport 500 -j ACCEPT 2>/dev/null || iptables -A INPUT -p udp --dport 500 -j ACCEPT
  iptables -C INPUT -p udp --dport 4500 -j ACCEPT 2>/dev/null || iptables -A INPUT -p udp --dport 4500 -j ACCEPT
  iptables -C INPUT -p udp --dport 1701 -j ACCEPT 2>/dev/null || iptables -A INPUT -p udp --dport 1701 -j ACCEPT
  iptables -C INPUT -p esp -j ACCEPT 2>/dev/null || iptables -A INPUT -p esp -j ACCEPT
  echo "✓ iptables rules applied (NOTE: persistence depends on your distro setup)"
fi

echo ""
echo "Step 7: Enable & restart services..."
# xl2tpd is consistent across distros
systemctl enable xl2tpd > /dev/null 2>&1 || true
systemctl restart xl2tpd

# strongswan unit name differs by distro/version:
#   Debian 12 (Bookworm): strongswan-swanctl  OR  charon  (strongswan-starter may not exist)
#   Debian 11 / Ubuntu 20-22: strongswan-starter
# We auto-detect which unit is available to avoid 'Unit file does not exist' errors.
STRONGSWAN_UNIT=""
for CANDIDATE in ipsec strongswan-swanctl strongswan-starter strongswan charon; do
  if systemctl list-unit-files "${CANDIDATE}.service" 2>/dev/null | grep -q "${CANDIDATE}.service"; then
    STRONGSWAN_UNIT="${CANDIDATE}"
    break
  fi
done

if [ -n "${STRONGSWAN_UNIT}" ]; then
  systemctl enable "${STRONGSWAN_UNIT}" > /dev/null 2>&1 || true
  systemctl restart "${STRONGSWAN_UNIT}"
  echo "✓ strongswan started via unit: ${STRONGSWAN_UNIT}"
else
  echo "WARNING: could not detect strongswan service unit."
  echo "  IPSec may not survive a reboot. Find and enable manually:"
  echo "  systemctl list-units | grep -iE 'strongswan|charon|ipsec'"
fi
echo "✓ Services started"

echo ""
echo "=========================================="
echo "Done."
echo "=========================================="
echo ""
echo "Next:"
echo "- Add more MikroTik accounts: bash scripts/vpn_server_add_user.sh"
echo "- Check status:              bash scripts/vpn_server_status.sh"
echo ""

