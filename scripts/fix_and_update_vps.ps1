# Complete Fix and Update VPS Script
# This script copies all fixed files to VPS and runs update
# Usage: .\scripts\fix_and_update_vps.ps1

$ErrorActionPreference = "Stop"

$VPS_HOST = "72.60.74.209"
$VPS_USER = "root"
$VPS_PASSWORD = "LLaptop7721@"
$DEPLOY_DIR = "/opt/rrnet"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Complete VPS Fix and Update" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if scp and ssh are available
$hasSCP = Get-Command scp -ErrorAction SilentlyContinue
$hasSSH = Get-Command ssh -ErrorAction SilentlyContinue

if (-not $hasSCP -or -not $hasSSH) {
    Write-Host "SSH/SCP client not found. Please install OpenSSH:" -ForegroundColor Red
    Write-Host "Add-WindowsCapability -Online -Name OpenSSH.Client" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Copying fixed files to VPS..." -ForegroundColor Yellow
Write-Host "Password: $VPS_PASSWORD" -ForegroundColor Cyan
Write-Host ""

# Copy migration file
Write-Host "  - Copying migration file..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no "BE/migrations/000038_add_nas_identifier_to_routers.up.sql" "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/BE/migrations/000038_add_nas_identifier_to_routers.up.sql"

# Copy package.json
Write-Host "  - Copying package.json..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no "fe/package.json" "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/fe/package.json"

# Copy clientService.ts (fix TypeScript error)
Write-Host "  - Copying clientService.ts..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no "fe/src/lib/api/clientService.ts" "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/fe/src/lib/api/clientService.ts"

Write-Host ""
Write-Host "Step 2: Running update commands on VPS..." -ForegroundColor Yellow
Write-Host "Password: $VPS_PASSWORD" -ForegroundColor Cyan
Write-Host ""

# Create and execute update script on VPS
$updateScript = @'
#!/bin/bash
set -e

DEPLOY_DIR="/opt/rrnet"
cd "$DEPLOY_DIR"

echo '========================================'
echo 'Step 1: Updating frontend dependencies...'
echo '========================================'
cd fe
npm install --legacy-peer-deps
echo 'Frontend dependencies updated!'

echo ''
echo '========================================'
echo 'Step 2: Building frontend...'
echo '========================================'
npm run build
echo 'Frontend build completed!'

echo ''
echo '========================================'
echo 'Step 3: Running database migrations...'
echo '========================================'
cd ../BE
export PATH=$PATH:/usr/local/go/bin
export PATH=$PATH:/root/go/bin
if [ -d "migrations" ]; then
    migrate -path migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" up
    echo 'Migrations completed!'
else
    echo 'No migrations directory found, skipping...'
fi

echo ''
echo '========================================'
echo 'Step 4: Restarting backend service...'
echo '========================================'
if systemctl is-active --quiet rrnet-backend; then
    systemctl restart rrnet-backend
    echo 'Backend service restarted!'
    sleep 2
    systemctl status rrnet-backend --no-pager -l | head -10
elif [ -f "/etc/systemd/system/rrnet-backend.service" ]; then
    systemctl start rrnet-backend
    systemctl status rrnet-backend --no-pager -l | head -10
else
    echo 'Backend service not found. Please create it manually.'
fi

echo ''
echo '========================================'
echo 'Update completed successfully!'
echo '========================================'
'@

# Save script to temp file
$tempScript = [System.IO.Path]::GetTempFileName()
$updateScript | Out-File -FilePath $tempScript -Encoding utf8 -NoNewline

# Copy script to VPS and execute
$remoteScriptPath = "/tmp/update_vps_$(Get-Date -Format 'yyyyMMddHHmmss').sh"
scp -o StrictHostKeyChecking=no $tempScript "${VPS_USER}@${VPS_HOST}:${remoteScriptPath}"

Write-Host "Executing update script on VPS..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" "chmod +x $remoteScriptPath && bash $remoteScriptPath && rm -f $remoteScriptPath"

# Cleanup
Remove-Item $tempScript

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "All done! VPS has been updated." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

