# Database Verification Script
# Verifies that database is properly set up for login

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RRNET Database Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Database connection
$DB_HOST = "localhost"
$DB_PORT = "15432"
$DB_NAME = "rrnet_dev"
$DB_USER = "rrnet"
$DB_PASS = "rrnet_secret"

$env:PGPASSWORD = $DB_PASS

Write-Host "Checking database connection..." -ForegroundColor Yellow
$connectionTest = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Cannot connect to database!" -ForegroundColor Red
    Write-Host $connectionTest -ForegroundColor Red
    exit 1
}
Write-Host "✓ Database connection OK" -ForegroundColor Green
Write-Host ""

# Check tables
Write-Host "Checking tables..." -ForegroundColor Yellow
$tables = @("users", "tenants", "roles", "plans")
foreach ($table in $tables) {
    $result = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '$table';" 2>&1
    if ($result -match '1') {
        Write-Host "  ✓ Table '$table' exists" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Table '$table' NOT FOUND!" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Check roles
Write-Host "Checking roles..." -ForegroundColor Yellow
$roles = @("super_admin", "owner", "admin")
foreach ($role in $roles) {
    $result = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM roles WHERE code = '$role';" 2>&1
    if ($result -match '1') {
        Write-Host "  ✓ Role '$role' exists" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Role '$role' NOT FOUND!" -ForegroundColor Red
    }
}
Write-Host ""

# Check tenant
Write-Host "Checking tenant 'acme'..." -ForegroundColor Yellow
$tenantCheck = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT id, name, slug, status FROM tenants WHERE slug = 'acme';" 2>&1
if ($tenantCheck -match "acme") {
    Write-Host "  ✓ Tenant 'acme' exists" -ForegroundColor Green
    Write-Host "  $tenantCheck" -ForegroundColor Gray
} else {
    Write-Host "  ✗ Tenant 'acme' NOT FOUND!" -ForegroundColor Red
    Write-Host "  Run seed script: .\scripts\setup-database.ps1" -ForegroundColor Yellow
}
Write-Host ""

# Check super admin user
Write-Host "Checking Super Admin user..." -ForegroundColor Yellow
$superAdminCheck = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT u.id, u.email, u.name, u.status, r.code as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = 'admin@rrnet.test';" 2>&1
if ($superAdminCheck -match "admin@rrnet.test") {
    Write-Host "  ✓ Super Admin user exists" -ForegroundColor Green
    Write-Host "  $superAdminCheck" -ForegroundColor Gray
} else {
    Write-Host "  ✗ Super Admin user NOT FOUND!" -ForegroundColor Red
    Write-Host "  Run seed script: .\scripts\setup-database.ps1" -ForegroundColor Yellow
}
Write-Host ""

# Check owner user
Write-Host "Checking Owner user..." -ForegroundColor Yellow
$ownerCheck = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT u.id, u.email, u.name, u.status, r.code as role, t.slug as tenant FROM users u JOIN roles r ON u.role_id = r.id LEFT JOIN tenants t ON u.tenant_id = t.id WHERE u.email = 'owner@acme.test';" 2>&1
if ($ownerCheck -match "owner@acme.test") {
    Write-Host "  ✓ Owner user exists" -ForegroundColor Green
    Write-Host "  $ownerCheck" -ForegroundColor Gray
    
    # Check if owner has tenant_id
    $ownerTenantCheck = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT tenant_id FROM users WHERE email = 'owner@acme.test';" 2>&1
    if ($ownerTenantCheck -match "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") {
        Write-Host "  ✓ Owner has correct tenant_id" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Owner tenant_id is incorrect!" -ForegroundColor Red
        Write-Host "  $ownerTenantCheck" -ForegroundColor Gray
    }
} else {
    Write-Host "  ✗ Owner user NOT FOUND!" -ForegroundColor Red
    Write-Host "  Run seed script: .\scripts\setup-database.ps1" -ForegroundColor Yellow
}
Write-Host ""

# Check password hash
Write-Host "Checking password hash..." -ForegroundColor Yellow
$passwordHash = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT password_hash FROM users WHERE email = 'owner@acme.test';" 2>&1
if ($passwordHash -match '^\$2a\$12\$') {
    Write-Host "  ✓ Password hash format is correct (bcrypt)" -ForegroundColor Green
} else {
    Write-Host "  ✗ Password hash format is incorrect!" -ForegroundColor Red
    Write-Host "  $passwordHash" -ForegroundColor Gray
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

