# Database Setup Script for RRNET
# This script runs migrations and seeds development accounts

$ErrorActionPreference = "Stop"

$DB_URL = "postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable"
$MIGRATIONS_PATH = "./migrations"
$SEED_PATH = "./migrations/seed/001_dev_accounts.sql"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RRNET Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if migrate command exists
$migrateCmd = Get-Command migrate -ErrorAction SilentlyContinue
if (-not $migrateCmd) {
    Write-Host "ERROR: 'migrate' command not found!" -ForegroundColor Red
    Write-Host "Please install golang-migrate:" -ForegroundColor Yellow
    Write-Host "  go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest" -ForegroundColor Yellow
    exit 1
}

# Check if psql command exists
$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlCmd) {
    Write-Host "ERROR: 'psql' command not found!" -ForegroundColor Red
    Write-Host "Please install PostgreSQL client tools" -ForegroundColor Yellow
    exit 1
}

# Step 1: Run migrations
Write-Host "Step 1: Running migrations..." -ForegroundColor Yellow
try {
    migrate -path $MIGRATIONS_PATH -database $DB_URL up
    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed with exit code $LASTEXITCODE"
    }
    Write-Host "✓ Migrations completed successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Migration failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Seed development accounts
Write-Host "Step 2: Seeding development accounts..." -ForegroundColor Yellow
try {
    $env:PGPASSWORD = "rrnet_secret"
    psql -h localhost -p 15432 -U rrnet -d rrnet_dev -f $SEED_PATH
    if ($LASTEXITCODE -ne 0) {
        throw "Seed failed with exit code $LASTEXITCODE"
    }
    Write-Host "✓ Seed data inserted successfully" -ForegroundColor Green
} catch {
    Write-Host "✗ Seed failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Database setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Development accounts:" -ForegroundColor Yellow
Write-Host "  Super Admin: admin@rrnet.test / password" -ForegroundColor White
Write-Host "  Owner: owner@acme.test / password (tenant: acme)" -ForegroundColor White
Write-Host ""

