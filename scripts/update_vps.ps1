# Complete VPS Update Script
# Updates dependencies, runs migrations, and restarts services
# Usage: .\scripts\update_vps.ps1

$ErrorActionPreference = "Stop"

# VPS Configuration
$VPS_HOST = "72.60.74.209"
$VPS_USER = "root"
$VPS_PASSWORD = "LLaptop7721@"
$DEPLOY_DIR = "/opt/rrnet"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Complete VPS Update Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if ssh is available
$hasSSH = Get-Command ssh -ErrorAction SilentlyContinue

if (-not $hasSSH) {
    Write-Host "SSH client not found. Please install OpenSSH:" -ForegroundColor Red
    Write-Host "Add-WindowsCapability -Online -Name OpenSSH.Client" -ForegroundColor Yellow
    exit 1
}

Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "1. Pull latest changes from GitHub" -ForegroundColor Cyan
Write-Host "2. Update backend dependencies (go mod download)" -ForegroundColor Cyan
Write-Host "3. Run database migrations" -ForegroundColor Cyan
Write-Host "4. Update frontend dependencies (npm install)" -ForegroundColor Cyan
Write-Host "5. Build frontend (npm run build)" -ForegroundColor Cyan
Write-Host "6. Restart backend service" -ForegroundColor Cyan
Write-Host "7. Restart frontend service (if exists)" -ForegroundColor Cyan
Write-Host ""
Write-Host "You will be prompted for password ONCE. Enter: $VPS_PASSWORD" -ForegroundColor Yellow
Write-Host ""

# Create a temporary script file with all commands
$remoteScript = @'
#!/bin/bash
set -e

DEPLOY_DIR="/opt/rrnet"

cd "$DEPLOY_DIR"

echo "========================================"
echo "Step 1: Pulling latest changes..."
echo "========================================"
git pull origin main

echo ""
echo "========================================"
echo "Step 2: Updating backend dependencies..."
echo "========================================"
cd "$DEPLOY_DIR/BE"
export PATH=$PATH:/usr/local/go/bin
export GOPATH=/root/go
go mod download
echo "Backend dependencies updated!"

echo ""
echo "========================================"
echo "Step 3: Running database migrations..."
echo "========================================"
if ! command -v migrate &> /dev/null; then
    echo "Installing golang-migrate..."
    go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
fi
export PATH=$PATH:/root/go/bin
if [ -d "migrations" ]; then
    migrate -path migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" up
    echo "Migrations completed!"
else
    echo "No migrations directory found, skipping..."
fi

echo ""
echo "========================================"
echo "Step 4: Updating frontend dependencies..."
echo "========================================"
cd "$DEPLOY_DIR/fe"
npm install
echo "Frontend dependencies updated!"

echo ""
echo "========================================"
echo "Step 5: Building frontend..."
echo "========================================"
npm run build
echo "Frontend build completed!"

echo ""
echo "========================================"
echo "Step 6: Restarting backend service..."
echo "========================================"
if systemctl is-active --quiet rrnet-backend; then
    systemctl restart rrnet-backend
    echo "Backend service restarted!"
    sleep 2
    systemctl status rrnet-backend --no-pager -l
elif [ -f "/etc/systemd/system/rrnet-backend.service" ]; then
    systemctl start rrnet-backend
    systemctl status rrnet-backend --no-pager -l
else
    echo "Backend service not found. Please create it manually."
fi

echo ""
echo "========================================"
echo "Step 7: Restarting frontend service (if exists)..."
echo "========================================"
if systemctl is-active --quiet rrnet-frontend; then
    systemctl restart rrnet-frontend
    echo "Frontend service restarted!"
    sleep 2
    systemctl status rrnet-frontend --no-pager -l
elif command -v pm2 &> /dev/null && pm2 list | grep -q "rrnet-frontend"; then
    pm2 restart rrnet-frontend
    echo "Frontend PM2 service restarted!"
else
    echo "Frontend service not found. You may need to start it manually."
fi

echo ""
echo "========================================"
echo "Update completed successfully!"
echo "========================================"
'@

# Save remote script to temp file
$tempScript = [System.IO.Path]::GetTempFileName()
$remoteScript | Out-File -FilePath $tempScript -Encoding utf8 -NoNewline

Write-Host "Executing update script on VPS..." -ForegroundColor Yellow
Write-Host "Password: $VPS_PASSWORD" -ForegroundColor Cyan
Write-Host ""

# Copy script to VPS and execute in one SSH session
$tempRemotePath = "/tmp/update_vps_$(Get-Date -Format 'yyyyMMddHHmmss').sh"

# Copy and execute in one command (user enters password once)
Write-Host "Copying script to VPS and executing..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" "cat > $tempRemotePath << 'SCRIPTEOF'
$remoteScript
SCRIPTEOF
chmod +x $tempRemotePath && bash $tempRemotePath && rm -f $tempRemotePath"

# Cleanup
Remove-Item $tempScript

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Done! VPS has been updated successfully." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Error occurred. Please check the output above." -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}

