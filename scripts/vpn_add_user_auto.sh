#!/bin/bash
# scripts/vpn_add_user_auto.sh
# Non-interactive script to add a VPN user and return the assigned IP
# Usage: sudo scripts/vpn_add_user_auto.sh <username> <password> [ip]

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: please run as root"
  exit 1
fi

VPN_USER=$1
VPN_PASS=$2
VPN_IP=${3:-""}
CHAP="/etc/ppp/chap-secrets"

# If IP is not provided, find the next available in 10.10.10.100-200
if [ -z "${VPN_IP}" ]; then
    # Get all IPs in use (using awk to avoid grep 1 exit code when no matches)
    USED_IPS=$(awk '/^[a-zA-Z0-9].*l2tpd/ && $4 ~ /^10\.10\.10\./ { print $4 }' "${CHAP}" | cut -d. -f4 | sort -n || true)

    # Default start
    NEXT_OCTET=100
    if [ -n "${USED_IPS}" ]; then
        for ip in ${USED_IPS}; do
            if [ "${ip}" -eq "${NEXT_OCTET}" ]; then
                NEXT_OCTET=$((NEXT_OCTET + 1))
            else
                break
            fi
        done
    fi
    
    if [ "${NEXT_OCTET}" -gt 254 ]; then
        echo "ERROR: no more IPs available in 10.10.10.x"
        exit 1
    fi
    VPN_IP="10.10.10.${NEXT_OCTET}"
fi

# Check if user exists
if grep -qE "^${VPN_USER}[[:space:]]+" "${CHAP}"; then
  # If user exists, update password and IP/Server instead of failing?
  # We use * for the server column to avoid name mismatch issues.
  sed -i "s|^${VPN_USER}[[:space:]]\+.*|${VPN_USER} * ${VPN_PASS} ${VPN_IP}|" "${CHAP}"
else
  echo "${VPN_USER} * ${VPN_PASS} ${VPN_IP}" >> "${CHAP}"
fi

# Print the assigned IP so Go can capture it
echo "${VPN_IP}"
