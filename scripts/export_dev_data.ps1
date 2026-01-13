# Export Development Data Script
# Exports all data from local development database to SQL dump
# Usage: .\scripts\export_dev_data.ps1

$ErrorActionPreference = "Stop"

# Database connection (adjust if needed)
$DB_HOST = "localhost"
$DB_PORT = "15432"
$DB_NAME = "rrnet_dev"
$DB_USER = "rrnet"
$DB_PASSWORD = "rrnet_secret"

# Output file
$OUTPUT_FILE = "dev_data_export_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
$OUTPUT_PATH = Join-Path $PSScriptRoot ".." $OUTPUT_FILE

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Export Development Data" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if pg_dump is available
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    Write-Host "❌ pg_dump not found!" -ForegroundColor Red
    Write-Host "   Please install PostgreSQL client tools" -ForegroundColor Yellow
    Write-Host "   Or use Docker: docker exec rrnet-postgres pg_dump ..." -ForegroundColor Yellow
    exit 1
}

Write-Host "[1] Connecting to database..." -ForegroundColor Yellow
Write-Host "    Host: ${DB_HOST}:${DB_PORT}" -ForegroundColor Gray
Write-Host "    Database: $DB_NAME" -ForegroundColor Gray
Write-Host "    User: $DB_USER" -ForegroundColor Gray
Write-Host ""

# Set password as environment variable
$env:PGPASSWORD = $DB_PASSWORD

# Export data only (no schema, only INSERT statements)
Write-Host "[2] Exporting data (this may take a few minutes)..." -ForegroundColor Yellow
Write-Host "    Output: $OUTPUT_PATH" -ForegroundColor Gray
Write-Host ""

# pg_dump options:
# --data-only: Only data, no schema
# --column-inserts: Use INSERT with column names (safer for different schemas)
# --no-owner: Don't include ownership commands
# --no-privileges: Don't include privilege commands
# --disable-triggers: Disable triggers during restore (faster)
pg_dump `
    -h $DB_HOST `
    -p $DB_PORT `
    -U $DB_USER `
    -d $DB_NAME `
    --data-only `
    --column-inserts `
    --no-owner `
    --no-privileges `
    --disable-triggers `
    --exclude-table=public.schema_migrations `
    -f $OUTPUT_PATH

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Export failed!" -ForegroundColor Red
    exit 1
}

# Get file size
$fileSize = (Get-Item $OUTPUT_PATH).Length / 1MB
Write-Host ""
Write-Host "✓ Export completed!" -ForegroundColor Green
Write-Host "  File: $OUTPUT_PATH" -ForegroundColor Gray
Write-Host "  Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray
Write-Host ""

# Show summary
Write-Host "[3] Data summary:" -ForegroundColor Yellow
$env:PGPASSWORD = $DB_PASSWORD
$tables = @(
    "tenants", "users", "clients", "invoices", "payments",
    "service_packages", "network_profiles", "client_groups",
    "routers", "pppoe_secrets", "ip_pools"
)

foreach ($table in $tables) {
    $count = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM $table;" 2>$null
    if ($count) {
        Write-Host "    ${table}: $($count.Trim()) rows" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "1. Upload file to VPS:" -ForegroundColor Yellow
Write-Host "   scp ${OUTPUT_FILE} root@72.60.74.209:/opt/rrnet/" -ForegroundColor White
Write-Host ""
Write-Host "2. Import on VPS:" -ForegroundColor Yellow
Write-Host "   ssh root@72.60.74.209" -ForegroundColor White
Write-Host "   cd /opt/rrnet" -ForegroundColor White
Write-Host "   ./scripts/import_dev_data.sh ${OUTPUT_FILE}" -ForegroundColor White
Write-Host ""

# Clean up password
Remove-Item Env:\PGPASSWORD

