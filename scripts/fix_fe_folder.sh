#!/bin/bash

# Fix FE Folder - Restore from Git
# This will restore the complete fe folder from repository

set +e

PROJECT_DIR="/opt/rrnet"

echo "=========================================="
echo "Fixing FE Folder"
echo "=========================================="

cd $PROJECT_DIR

# Check git status
echo "[1] Checking git status..."
git status fe/ 2>&1

# Remove incomplete fe folder
echo "[2] Removing incomplete fe folder..."
rm -rf fe/

# Restore fe from git
echo "[3] Restoring fe folder from git..."
git checkout HEAD -- fe/ 2>/dev/null || git restore fe/ 2>/dev/null || {
    echo "Trying to restore individual files..."
    git checkout HEAD -- fe/package.json fe/next.config.ts fe/tsconfig.json 2>/dev/null
}

# If still not working, try sparse checkout or full restore
if [ ! -f "fe/package.json" ]; then
    echo "[4] Full restore from git..."
    git reset --hard HEAD
    git clean -fd
    git pull origin main --force
fi

# Check if fe is submodule
if [ -f .gitmodules ]; then
    echo "[5] Initializing git submodules..."
    git submodule update --init --recursive
fi

# Verify fe folder
echo "[6] Verifying fe folder..."
if [ -f "fe/package.json" ]; then
    echo "✓ package.json found"
    ls -la fe/ | head -10
else
    echo "❌ package.json still not found"
    echo "   Listing fe directory:"
    ls -la fe/ 2>/dev/null || echo "   fe directory doesn't exist"
    echo ""
    echo "   Trying alternative: clone fe separately..."
    exit 1
fi

echo ""
echo "=========================================="
echo "FE Folder Restored!"
echo "=========================================="
echo ""
echo "Now run: ./scripts/fix_frontend.sh"


