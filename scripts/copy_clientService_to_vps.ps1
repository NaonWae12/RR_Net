# Copy clientService.ts to VPS
# Usage: .\scripts\copy_clientService_to_vps.ps1

$ErrorActionPreference = "Stop"

$VPS_HOST = "72.60.74.209"
$VPS_USER = "root"
$VPS_PASSWORD = "LLaptop7721@"
$DEPLOY_DIR = "/opt/rrnet"

Write-Host "========================================" -ForegroundColor Green
Write-Host "Copying clientService.ts to VPS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Password: $VPS_PASSWORD" -ForegroundColor Cyan
Write-Host ""

# Copy clientService.ts
Write-Host "Copying clientService.ts..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no "fe/src/lib/api/clientService.ts" "${VPS_USER}@${VPS_HOST}:${DEPLOY_DIR}/fe/src/lib/api/clientService.ts"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "File copied! Now run on VPS:" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "cd /opt/rrnet/fe" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Cyan

