#!/bin/bash

# Debug Frontend Service Script
# Checks and fixes common frontend issues

set -e

PROJECT_DIR="/opt/rrnet"
cd "$PROJECT_DIR/fe"

echo "=========================================="
echo "Debugging Frontend Service"
echo "=========================================="
echo ""

# 1. Check Node.js version
echo "[1] Checking Node.js version..."
node --version
npm --version
echo ""

# 2. Check if .next folder exists
echo "[2] Checking build artifacts..."
if [ -d ".next" ]; then
    echo "✓ .next folder exists"
    ls -la .next | head -5
else
    echo "❌ .next folder not found - need to build"
    echo "   Running build..."
    npm run build
fi
echo ""

# 3. Check package.json scripts
echo "[3] Checking package.json scripts..."
if [ -f "package.json" ]; then
    echo "Available scripts:"
    grep -A 10 '"scripts"' package.json | head -15
else
    echo "❌ package.json not found!"
    exit 1
fi
echo ""

# 4. Check .env.local
echo "[4] Checking environment..."
if [ -f ".env.local" ]; then
    echo "✓ .env.local exists"
    echo "   NEXT_PUBLIC_API_URL: $(grep NEXT_PUBLIC_API_URL .env.local || echo 'not set')"
else
    echo "⚠️  .env.local not found"
fi
echo ""

# 5. Test npm start manually
echo "[5] Testing npm start..."
echo "   This will run in foreground (Ctrl+C to stop)"
echo ""

# Try to start and capture error
timeout 10 npm start 2>&1 | head -30 || true

echo ""
echo "=========================================="
echo "Service Logs (last 30 lines):"
echo "=========================================="
journalctl -u rrnet-frontend -n 30 --no-pager || echo "No logs found"
echo ""

echo "=========================================="
echo "Recommendations:"
echo "=========================================="
echo "1. If build failed, run: npm run build"
echo "2. If .env.local missing, create it with NEXT_PUBLIC_API_URL"
echo "3. Check service file: cat /etc/systemd/system/rrnet-frontend.service"
echo "4. Restart service: systemctl restart rrnet-frontend"
echo ""


