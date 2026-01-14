#!/bin/bash

# Auto Deploy Script - Handles Everything Including Git Conflicts
# Just run this and test in browser!

set +e

echo "=========================================="
echo "RRNET Auto Deploy - Full Automation"
echo "=========================================="

PROJECT_DIR="/opt/rrnet"
VPS_IP="72.60.74.209"

# Fix git conflicts first
echo "[0] Fixing git conflicts..."
cd $PROJECT_DIR 2>/dev/null || mkdir -p $PROJECT_DIR && cd $PROJECT_DIR

# Discard local changes if any
git checkout -- . 2>/dev/null
git reset --hard origin/main 2>/dev/null

# Pull latest
git pull origin main 2>/dev/null || {
    echo "Git pull failed, trying fresh clone..."
    cd /opt
    rm -rf rrnet_backup
    mv rrnet rrnet_backup 2>/dev/null || true
    git clone https://github.com/NaonWae12/RR_Net.git rrnet
    cd rrnet
}

# Make script executable
chmod +x scripts/complete_deployment.sh 2>/dev/null

# Run complete deployment
echo ""
echo "Starting complete deployment..."
echo "This will take 5-10 minutes..."
echo ""

./scripts/complete_deployment.sh

# Final verification
echo ""
echo "=========================================="
echo "Final Verification:"
echo "=========================================="

sleep 5

# Check backend
BACKEND_STATUS=$(systemctl is-active rrnet-backend 2>/dev/null)
if [ "$BACKEND_STATUS" = "active" ]; then
    echo "✓ Backend service is RUNNING"
    curl -s http://localhost:8080/health > /dev/null && echo "✓ Backend health check OK" || echo "⚠️  Backend health check failed"
else
    echo "❌ Backend service is NOT running"
    echo "   Check logs: journalctl -u rrnet-backend -n 50"
fi

# Check frontend
if [ -f "$PROJECT_DIR/fe/package.json" ]; then
    FRONTEND_STATUS=$(systemctl is-active rrnet-frontend 2>/dev/null)
    if [ "$FRONTEND_STATUS" = "active" ]; then
        echo "✓ Frontend service is RUNNING"
        curl -s -o /dev/null -w "✓ Frontend HTTP %{http_code}\n" http://localhost:3000
    else
        echo "⚠️  Frontend service is NOT running"
        echo "   Check logs: journalctl -u rrnet-frontend -n 50"
    fi
fi

echo ""
echo "=========================================="
echo "Ready for Browser Testing!"
echo "=========================================="
echo ""
echo "Test these URLs in your browser:"
echo ""
echo "  🔗 Backend Health: http://$VPS_IP:8080/health"
echo "  🔗 Frontend:        http://$VPS_IP:3000"
echo ""
echo "If services are not running, check logs:"
echo "  journalctl -u rrnet-backend -n 50"
echo "  journalctl -u rrnet-frontend -n 50"
echo ""


