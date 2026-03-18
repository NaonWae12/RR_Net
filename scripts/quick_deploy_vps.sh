#!/bin/bash

# Quick Deploy Script for VPS
# This script pulls latest changes and rebuilds/restarts services

set -e

echo "=========================================="
echo "Quick Deploy to VPS"
echo "=========================================="

# VPS Configuration
VPS_HOST="72.60.74.209"
VPS_USER="root"
PROJECT_DIR="/opt/rrnet"

echo ""
echo "Step 1: Pulling latest changes from GitHub..."
cd "$PROJECT_DIR" || exit 1
git pull origin main

if [ $? -ne 0 ]; then
    echo "✗ Git pull failed. Checking for conflicts..."
    
    # Check for untracked files that might conflict
    UNTRACKED=$(git status --porcelain | grep "^??" | awk '{print $2}' || true)
    if [ -n "$UNTRACKED" ]; then
        echo "  Found untracked files that might conflict:"
        echo "$UNTRACKED"
        echo ""
        echo "  Removing common conflicting files..."
        rm -f BE/rrnet-api dev_data_export*.sql 2>/dev/null || true
        echo "  Retrying pull..."
        git pull origin main
    fi
fi

echo "✓ Code updated"

echo ""
echo "Step 2: Rebuilding Frontend..."
cd "$PROJECT_DIR/fe" || exit 1

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "  Warning: Node.js version is less than 20. Upgrading..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install --legacy-peer-deps
fi

# Build
echo "  Building frontend..."
npm run build

if [ $? -ne 0 ]; then
    echo "✗ Frontend build failed!"
    exit 1
fi

echo "✓ Frontend built successfully"

echo ""
echo "Step 3: Restarting Frontend Service..."
systemctl restart rrnet-frontend
sleep 2

if systemctl is-active --quiet rrnet-frontend; then
    echo "✓ Frontend service restarted"
else
    echo "✗ Frontend service failed to start. Checking logs..."
    journalctl -u rrnet-frontend -n 20 --no-pager
    exit 1
fi

echo ""
echo "Step 4: Checking Backend (if changed)..."
cd "$PROJECT_DIR/BE" || exit 1

# Check if backend files changed
BACKEND_CHANGED=$(git diff HEAD@{1} HEAD --name-only | grep -E "^BE/" || true)

if [ -n "$BACKEND_CHANGED" ]; then
    echo "  Backend files changed. Rebuilding..."
    
    # Update Go dependencies
    go mod tidy
    go mod download
    
    # Build
    go build -o rrnet-api ./cmd/api
    
    if [ $? -ne 0 ]; then
        echo "✗ Backend build failed!"
        exit 1
    fi
    
    echo "✓ Backend built successfully"
    
    # Restart backend
    echo "  Restarting backend service..."
    systemctl restart rrnet-backend
    sleep 2
    
    if systemctl is-active --quiet rrnet-backend; then
        echo "✓ Backend service restarted"
    else
        echo "✗ Backend service failed to start. Checking logs..."
        journalctl -u rrnet-backend -n 20 --no-pager
        exit 1
    fi
else
    echo "  No backend changes detected. Skipping rebuild."
fi

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Services Status:"
systemctl is-active rrnet-frontend >/dev/null 2>&1 && echo "  ✓ Frontend: Running" || echo "  ✗ Frontend: Stopped"
systemctl is-active rrnet-backend >/dev/null 2>&1 && echo "  ✓ Backend: Running" || echo "  ✗ Backend: Stopped"
echo ""
echo "Application URLs:"
echo "  Frontend: http://$VPS_HOST:3000"
echo "  Backend:  http://$VPS_HOST:8080"
echo ""

