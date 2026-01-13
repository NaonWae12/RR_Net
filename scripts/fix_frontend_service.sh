#!/bin/bash

# Fix Frontend Service Script
# Rebuilds and restarts frontend service

set -e

PROJECT_DIR="/opt/rrnet"
cd "$PROJECT_DIR/fe"

echo "=========================================="
echo "Fixing Frontend Service"
echo "=========================================="
echo ""

# 1. Stop service
echo "[1] Stopping service..."
systemctl stop rrnet-frontend 2>/dev/null || true
sleep 2
echo ""

# 2. Check Node.js
echo "[2] Checking Node.js..."
node --version
echo ""

# 3. Check if .next exists
echo "[3] Checking build..."
if [ ! -d ".next" ]; then
    echo "❌ .next folder not found - rebuilding..."
    npm run build
else
    echo "✓ .next folder exists"
    echo "   Rebuilding to ensure latest changes..."
    npm run build
fi
echo ""

# 4. Check .env.local
echo "[4] Checking environment..."
if [ ! -f ".env.local" ]; then
    echo "⚠️  Creating .env.local..."
    cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://72.60.74.209:8080
EOF
    echo "✓ Created .env.local"
else
    echo "✓ .env.local exists"
fi
echo ""

# 5. Update systemd service
echo "[5] Updating systemd service..."
cat > /etc/systemd/system/rrnet-frontend.service << EOF
[Unit]
Description=RRNET Frontend
After=network.target rrnet-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR/fe
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=$PROJECT_DIR/fe/.env.local

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable rrnet-frontend 2>/dev/null || true
echo "✓ Service file updated"
echo ""

# 6. Test npm start manually first
echo "[6] Testing npm start (5 seconds)..."
timeout 5 npm start 2>&1 | head -20 || echo "   (timeout expected)"
echo ""

# 7. Start service
echo "[7] Starting service..."
systemctl start rrnet-frontend
sleep 3

# 8. Check status
echo "[8] Service status:"
systemctl status rrnet-frontend --no-pager -l | head -20
echo ""

# 9. Check logs
echo "[9] Recent logs:"
journalctl -u rrnet-frontend -n 20 --no-pager || echo "No logs yet"
echo ""

# 10. Test endpoint
echo "[10] Testing endpoint..."
sleep 2
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000 || echo "❌ Not responding"
echo ""

echo "=========================================="
echo "Fix Complete!"
echo "=========================================="
echo ""
echo "If still not working, check logs:"
echo "  journalctl -u rrnet-frontend -f"
echo ""

