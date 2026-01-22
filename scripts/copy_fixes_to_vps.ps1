# Copy Fixed Files to VPS
# Usage: .\scripts\copy_fixes_to_vps.ps1

$ErrorActionPreference = "Stop"

$VPS_HOST = "72.60.74.209"
$VPS_USER = "root"
$VPS_PASSWORD = "LLaptop7721@"
$DEPLOY_DIR = "/opt/rrnet"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Copying Fixed Files to VPS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if scp is available
$hasSCP = Get-Command scp -ErrorAction SilentlyContinue

if (-not $hasSCP) {
    Write-Host "SCP client not found. Please install OpenSSH:" -ForegroundColor Red
    Write-Host "Add-WindowsCapability -Online -Name OpenSSH.Client" -ForegroundColor Yellow
    exit 1
}

Write-Host "Copying files to VPS..." -ForegroundColor Yellow
Write-Host "Password: $VPS_PASSWORD" -ForegroundColor Cyan
Write-Host ""

# Copy migration file
Write-Host "1. Copying migration file..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no "BE/migrations/000038_add_nas_identifier_to_routers.up.sql" "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/BE/migrations/000038_add_nas_identifier_to_routers.up.sql"

# Copy package.json
Write-Host "2. Copying package.json..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no "fe/package.json" "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/fe/package.json"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Files copied successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Now run on VPS:" -ForegroundColor Yellow
Write-Host "  cd /opt/rrnet/fe" -ForegroundColor Cyan
Write-Host "  npm install --legacy-peer-deps" -ForegroundColor Cyan
Write-Host "  npm run build" -ForegroundColor Cyan
Write-Host "  cd ../BE" -ForegroundColor Cyan
Write-Host "  export PATH=`$PATH:/usr/local/go/bin:/root/go/bin" -ForegroundColor Cyan
Write-Host "  migrate -path migrations -database 'postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable' up" -ForegroundColor Cyan
Write-Host "  systemctl restart rrnet-backend" -ForegroundColor Cyan

