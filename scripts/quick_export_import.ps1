# Quick Export & Import Script
# Exports data from local and provides instructions for VPS import
# Usage: .\scripts\quick_export_import.ps1

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Quick Export & Import Development Data" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Export data
Write-Host "[1] Exporting data from local database..." -ForegroundColor Yellow
& "$PSScriptRoot\export_dev_data.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Export failed!" -ForegroundColor Red
    exit 1
}

# Get the latest export file
$exportFile = Get-ChildItem -Path (Join-Path $PSScriptRoot "..") -Filter "dev_data_export_*.sql" | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 1

if (-not $exportFile) {
    Write-Host "❌ Export file not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Next Steps (Manual)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option 1: Using SCP (recommended)" -ForegroundColor Yellow
Write-Host "  1. Upload to VPS:" -ForegroundColor White
Write-Host "     scp $($exportFile.Name) root@72.60.74.209:/opt/rrnet/" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. SSH to VPS and import:" -ForegroundColor White
Write-Host "     ssh root@72.60.74.209" -ForegroundColor Gray
Write-Host "     cd /opt/rrnet" -ForegroundColor Gray
Write-Host "     chmod +x scripts/import_dev_data.sh" -ForegroundColor Gray
Write-Host "     ./scripts/import_dev_data.sh $($exportFile.Name)" -ForegroundColor Gray
Write-Host ""

Write-Host "Option 2: Using PowerShell (if SSH configured)" -ForegroundColor Yellow
Write-Host "  1. Copy file to VPS:" -ForegroundColor White
Write-Host "     scp $($exportFile.FullName) root@72.60.74.209:/opt/rrnet/" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Run import script on VPS:" -ForegroundColor White
Write-Host "     ssh root@72.60.74.209 'cd /opt/rrnet && chmod +x scripts/import_dev_data.sh && ./scripts/import_dev_data.sh $($exportFile.Name)'" -ForegroundColor Gray
Write-Host ""

Write-Host "File location:" -ForegroundColor Yellow
Write-Host "  $($exportFile.FullName)" -ForegroundColor Gray
Write-Host "  Size: $([math]::Round($exportFile.Length / 1MB, 2)) MB" -ForegroundColor Gray
Write-Host ""

