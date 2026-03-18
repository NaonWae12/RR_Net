#!/bin/bash
# scripts/vpn_del_user_auto.sh
# Non-interactive script to remove a VPN user
# Usage: sudo scripts/vpn_del_user_auto.sh <username>

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: please run as root"
  exit 1
fi

VPN_USER=$1
CHAP="/etc/ppp/chap-secrets"

if [ -z "${VPN_USER}" ]; then
    echo "ERROR: username required"
    exit 1
fi

# Remove user from chap-secrets
if grep -qE "^${VPN_USER}[[:space:]]+" "${CHAP}"; then
  sed -i "/^${VPN_USER}[[:space:]]\+/d" "${CHAP}"
  echo "SUCCESS: user ${VPN_USER} removed"
else
  echo "INFO: user ${VPN_USER} not found"
fi
