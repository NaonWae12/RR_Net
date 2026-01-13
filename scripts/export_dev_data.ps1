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
$parentDir = Split-Path -Parent $PSScriptRoot
$OUTPUT_PATH = Join-Path $parentDir $OUTPUT_FILE

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Export Development Data" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if pg_dump is available, or use Docker
$USE_DOCKER = $false
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    # Try Docker instead
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        $dockerPs = docker ps --filter "name=rrnet-postgres" --format "{{.Names}}" 2>$null
        if ($dockerPs -eq "rrnet-postgres") {
            Write-Host "⚠️  pg_dump not found, using Docker instead..." -ForegroundColor Yellow
            $USE_DOCKER = $true
        } else {
            Write-Host "❌ pg_dump not found and Docker container 'rrnet-postgres' not running!" -ForegroundColor Red
            Write-Host "   Please install PostgreSQL client tools or start Docker container" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "❌ pg_dump not found and Docker not available!" -ForegroundColor Red
        Write-Host "   Please install PostgreSQL client tools" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "[1] Connecting to database..." -ForegroundColor Yellow
$hostInfo = "    Host: ${DB_HOST}:${DB_PORT}"
Write-Host $hostInfo -ForegroundColor Gray
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
if ($USE_DOCKER) {
    Write-Host "   Using Docker container: rrnet-postgres" -ForegroundColor Gray
    docker exec rrnet-postgres pg_dump `
        -U $DB_USER `
        -d $DB_NAME `
        --data-only `
        --column-inserts `
        --no-owner `
        --no-privileges `
        --disable-triggers `
        --exclude-table=public.schema_migrations `
        > $OUTPUT_PATH
} else {
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
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Export failed!" -ForegroundColor Red
    exit 1
}

# Get file size
$fileSize = (Get-Item $OUTPUT_PATH).Length / 1MB
Write-Host ""
Write-Host '✓ Export completed!' -ForegroundColor Green
Write-Host "  File: $OUTPUT_PATH" -ForegroundColor Gray
$sizeMsg = '  Size: ' + [math]::Round($fileSize, 2).ToString() + ' MB'
Write-Host $sizeMsg -ForegroundColor Gray
Write-Host ""

# Show summary
Write-Host '[3] Data summary:' -ForegroundColor Yellow
$env:PGPASSWORD = $DB_PASSWORD
$tables = @(
    'tenants', 'users', 'clients', 'invoices', 'payments',
    'service_packages', 'network_profiles', 'client_groups',
    'routers', 'pppoe_secrets', 'ip_pools'
)

foreach ($table in $tables) {
    $query = 'SELECT COUNT(*) FROM ' + $table + ';'
    if ($USE_DOCKER) {
        $count = docker exec rrnet-postgres psql -U $DB_USER -d $DB_NAME -t -c $query 2>$null
    } else {
        $count = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $query 2>$null
    }
    if ($count) {
        $rowCount = $count.Trim()
        $output = '    ' + $table + ' : ' + $rowCount + ' rows'
        Write-Host $output -ForegroundColor Gray
    }
}

Write-Host ""
$separator = '=========================================='
Write-Host $separator -ForegroundColor Cyan
Write-Host 'Next Steps:' -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host '1. Upload file to VPS:' -ForegroundColor Yellow
$uploadCmd = '   scp ' + $OUTPUT_FILE + ' root@72.60.74.209:/opt/rrnet/'
Write-Host $uploadCmd -ForegroundColor White
Write-Host ""
Write-Host '2. Import on VPS:' -ForegroundColor Yellow
Write-Host '   ssh root@72.60.74.209' -ForegroundColor White
Write-Host '   cd /opt/rrnet' -ForegroundColor White
$importCmd = '   ./scripts/import_dev_data.sh ' + $OUTPUT_FILE
Write-Host $importCmd -ForegroundColor White
Write-Host ""

# Clean up password
Remove-Item Env:\PGPASSWORD

