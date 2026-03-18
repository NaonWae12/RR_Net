#!/bin/bash
# Add a VPN user (PPP chap-secrets) for L2TP server on VPS
#
# Each MikroTik should get a unique username/password.
#
# Usage:
#   sudo bash scripts/vpn_server_add_user.sh

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: please run as root"
  exit 1
fi

CHAP="/etc/ppp/chap-secrets"
touch "${CHAP}"
chmod 600 "${CHAP}"

read -r -p "VPN username (contoh vpn-router-002): " VPN_USER
if [ -z "${VPN_USER}" ]; then
  echo "ERROR: username required"
  exit 1
fi

read -r -s -p "VPN password: " VPN_PASS
echo ""
if [ -z "${VPN_PASS}" ]; then
  echo "ERROR: password required"
  exit 1
fi

read -r -p "Static IP (optional, contoh 10.10.10.102; kosongkan untuk dynamic): " STATIC_IP

if grep -qE "^${VPN_USER}[[:space:]]+l2tpd[[:space:]]+" "${CHAP}"; then
  echo "ERROR: user already exists in ${CHAP}: ${VPN_USER}"
  exit 1
fi

if [ -n "${STATIC_IP}" ]; then
  echo "${VPN_USER} l2tpd ${VPN_PASS} ${STATIC_IP}" >> "${CHAP}"
  echo "✓ Added user ${VPN_USER} with static IP ${STATIC_IP}"
else
  echo "${VPN_USER} l2tpd ${VPN_PASS} *" >> "${CHAP}"
  echo "✓ Added user ${VPN_USER} (dynamic IP)"
fi

echo ""
echo "Tip: restart xl2tpd if needed:"
echo "  systemctl restart xl2tpd"


