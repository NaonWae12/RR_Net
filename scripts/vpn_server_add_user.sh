#!/bin/bash
# Add a VPN user (PPP chap-secrets) for L2TP server on VPS
#
# Each MikroTik MUST have a unique username/password.
# This script is intended for MANUAL additions (e.g., pre-provisioned routers).
# For automated additions via the app, Go's allocateVPNIP() is used instead.
#
# Usage:
#   sudo bash scripts/vpn_server_add_user.sh
#
# Changelog:
# 2026-03-25 - Consistency fix:
#   - Server field changed from 'l2tpd' to '*' to match Go's allocateVPNIP() format.
#     Mixing both formats in chap-secrets can cause auth failures for certain users.
#   - Duplicate check now looks for any server field (not just 'l2tpd') using '^USER '.
#   - Added option to assign static IP from the standard pool (10.10.10.100-254).
#     IMPORTANT: static IP must be within the xl2tpd pool range (configured in xl2tpd.conf).

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

# Check duplicate — search for ANY server field, not just 'l2tpd'
# This catches entries written by both this script and Go's allocateVPNIP()
if grep -qE "^${VPN_USER}[[:space:]]+" "${CHAP}"; then
  echo "ERROR: user already exists in ${CHAP}: ${VPN_USER}"
  echo "  Existing entry:"
  grep -E "^${VPN_USER}[[:space:]]+" "${CHAP}" | sed 's/\(.*\) \([^ ]*\) \(.*\)/  \1 [PASS_HIDDEN] \3/'
  exit 1
fi

read -r -s -p "VPN password: " VPN_PASS
echo ""
if [ -z "${VPN_PASS}" ]; then
  echo "ERROR: password required"
  exit 1
fi

read -r -p "Static IP (optional, MUST be in 10.10.10.100-254; leave empty to use pool dynamic): " STATIC_IP

if [ -n "${STATIC_IP}" ]; then
  # Validate IP is in allowed range
  OCTET=$(echo "${STATIC_IP}" | awk -F. '{print $4}')
  PREFIX=$(echo "${STATIC_IP}" | awk -F. '{print $1"."$2"."$3}')
  if [ "${PREFIX}" != "10.10.10" ] || [ "${OCTET}" -lt 100 ] || [ "${OCTET}" -gt 254 ]; then
    echo "ERROR: static IP must be in range 10.10.10.100 - 10.10.10.254"
    exit 1
  fi
  # Check if static IP is already taken
  if grep -qE "[[:space:]]${STATIC_IP}$" "${CHAP}"; then
    echo "ERROR: IP ${STATIC_IP} is already assigned to another user:"
    grep -E "[[:space:]]${STATIC_IP}$" "${CHAP}" | awk '{print "  user: "$1}'
    exit 1
  fi
  # Server field '*' = wildcard, works with any xl2tpd LNS name
  echo "${VPN_USER} * ${VPN_PASS} ${STATIC_IP}" >> "${CHAP}"
  echo "✓ Added user ${VPN_USER} with static IP ${STATIC_IP}"
else
  # Dynamic: '*' as IP = let xl2tpd assign from its pool
  echo "${VPN_USER} * ${VPN_PASS} *" >> "${CHAP}"
  echo "✓ Added user ${VPN_USER} (dynamic IP from xl2tpd pool)"
fi

echo ""
echo "Tip: restart xl2tpd if the server is already running:"
echo "  systemctl restart xl2tpd"
echo ""
echo "Registered users in chap-secrets:"
awk 'NF>=3 && substr($1,1,1) != "#" {print "  - "$1}' "${CHAP}"
