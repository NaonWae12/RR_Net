#!/bin/bash

# Fix FE Submodule - Complete Fix
# This handles fe as submodule and restores all files

set +e

PROJECT_DIR="/opt/rrnet"

echo "=========================================="
echo "Fixing FE Submodule"
echo "=========================================="

cd $PROJECT_DIR

# Pull latest
echo "[1] Updating repository..."
git pull origin main 2>/dev/null || true

# Remove incomplete fe folder
echo "[2] Removing incomplete fe folder..."
rm -rf fe/

# Check if fe is submodule
echo "[3] Checking if fe is submodule..."
if [ -f .gitmodules ]; then
    echo "   .gitmodules found, initializing submodules..."
    git submodule update --init --recursive --force 2>&1 | tail -10
else
    echo "   No .gitmodules, trying to restore fe from git..."
    git checkout HEAD -- fe/ 2>/dev/null || git restore fe/ 2>/dev/null
fi

# If still not working, try reset
if [ ! -f "fe/package.json" ]; then
    echo "[4] Trying git reset to restore fe..."
    git reset --hard HEAD
    git clean -fd
    git submodule update --init --recursive --force 2>&1
fi

# Final check
echo "[5] Verifying fe folder..."
if [ -f "fe/package.json" ]; then
    echo "✓ package.json found!"
    echo ""
    echo "FE folder contents:"
    ls -la fe/ | head -15
    echo ""
    echo "=========================================="
    echo "FE Folder Fixed!"
    echo "=========================================="
    echo ""
    echo "Now run: ./scripts/fix_frontend.sh"
else
    echo "❌ package.json still not found"
    echo ""
    echo "Trying manual restore..."
    cd $PROJECT_DIR
    git rm --cached fe 2>/dev/null
    git submodule add --force https://github.com/NaonWae12/RR_Net.git fe 2>/dev/null || {
        echo ""
        echo "Manual fix needed. Run these commands:"
        echo "  cd /opt/rrnet"
        echo "  rm -rf fe"
        echo "  git submodule update --init --recursive"
        echo "  # Or if fe is not submodule:"
        echo "  git checkout HEAD -- fe/"
    }
fi

