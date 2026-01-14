#!/bin/bash
# Install L2TP + IPSec VPN Client di VPS untuk koneksi ke MikroTik

set -e

echo "=========================================="
echo "Install L2TP + IPSec VPN Client"
echo "=========================================="
echo ""

# Configuration (edit sesuai setup MikroTik)
MIKROTIK_IP="36.70.234.179"
IPSEC_SECRET="rahasiaipsec123"  # Ganti dengan IPSec secret dari MikroTik
VPN_USERNAME="vpn-user"          # Ganti dengan username VPN dari MikroTik
VPN_PASSWORD="vpnpass123"        # Ganti dengan password VPN dari MikroTik

echo "Step 1: Install dependencies..."
apt-get update
apt-get install -y xl2tpd strongswan ppp

echo "✓ Dependencies installed"
echo ""

echo "Step 2: Setup IPSec configuration..."
cat > /etc/ipsec.conf << EOF
config setup
    charondebug="ike 1, knl 1, cfg 0"
    uniqueids=no

conn mikrotik-vpn
    type=transport
    authby=secret
    left=%defaultroute
    leftprotoport=17/1701
    right=${MIKROTIK_IP}
    rightprotoport=17/1701
    auto=start
    ike=aes256-sha256-modp2048!
    esp=aes256-sha256!
    keyexchange=ikev2
EOF

echo "✓ IPSec config created: /etc/ipsec.conf"
echo ""

echo "Step 3: Setup IPSec secrets..."
cat > /etc/ipsec.secrets << EOF
${MIKROTIK_IP} : PSK "${IPSEC_SECRET}"
EOF

chmod 600 /etc/ipsec.secrets
echo "✓ IPSec secrets configured: /etc/ipsec.secrets"
echo ""

echo "Step 4: Setup xl2tpd configuration..."
cat > /etc/xl2tpd/xl2tpd.conf << EOF
[global]
port = 1701

[lac mikrotik]
lns = ${MIKROTIK_IP}
ppp debug = yes
pppoptfile = /etc/ppp/options.l2tpd.client
length bit = yes
EOF

echo "✓ xl2tpd config created: /etc/xl2tpd/xl2tpd.conf"
echo ""

echo "Step 5: Setup PPP options..."
cat > /etc/ppp/options.l2tpd.client << EOF
ipcp-accept-local
ipcp-accept-remote
refuse-eap
require-chap
noccp
noauth
mtu 1280
mru 1280
noipdefault
defaultroute
usepeerdns
connect-delay 5000
name ${VPN_USERNAME}
password ${VPN_PASSWORD}
EOF

chmod 600 /etc/ppp/options.l2tpd.client
echo "✓ PPP options configured: /etc/ppp/options.l2tpd.client"
echo ""

echo "Step 6: Enable and start services..."
systemctl enable strongswan
systemctl enable xl2tpd
systemctl start strongswan
systemctl start xl2tpd

echo "✓ Services enabled and started"
echo ""

echo "Step 7: Connect VPN..."
echo "c mikrotik" > /var/run/xl2tpd/l2tp-control

echo "Waiting 5 seconds for connection..."
sleep 5

echo ""
echo "Step 8: Check VPN connection status..."
if ip addr show ppp0 &>/dev/null; then
    echo "✓ VPN Connected!"
    echo ""
    echo "VPN Interface:"
    ip addr show ppp0 | grep "inet "
    echo ""
    echo "VPN Routes:"
    ip route | grep ppp0
    echo ""
    echo "Test ping to MikroTik VPN IP (10.10.10.1):"
    ping -c 3 10.10.10.1 || echo "⚠ Ping failed, but VPN might still be connecting..."
else
    echo "✗ VPN Connection Failed"
    echo ""
    echo "Checking logs..."
    echo ""
    echo "IPSec logs:"
    journalctl -u strongswan -n 10 --no-pager || true
    echo ""
    echo "xl2tpd logs:"
    journalctl -u xl2tpd -n 10 --no-pager || true
    echo ""
    echo "Please check:"
    echo "1. IPSec secret matches MikroTik configuration"
    echo "2. VPN username and password are correct"
    echo "3. L2TP server is enabled on MikroTik"
    echo "4. Firewall rules allow L2TP and IPSec ports"
fi

echo ""
echo "=========================================="
echo "Installation Complete!"
echo "=========================================="
echo ""
echo "Configuration files:"
echo "  - /etc/ipsec.conf"
echo "  - /etc/ipsec.secrets"
echo "  - /etc/xl2tpd/xl2tpd.conf"
echo "  - /etc/ppp/options.l2tpd.client"
echo ""
echo "To manually connect VPN:"
echo "  echo 'c mikrotik' > /var/run/xl2tpd/l2tp-control"
echo ""
echo "To check VPN status:"
echo "  ip addr show ppp0"
echo ""

