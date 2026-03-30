# Check Super Admin Account Script
# Verifies that super admin account exists in database

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Super Admin Account Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Database connection
$DB_HOST = "localhost"
$DB_PORT = "15432"
$DB_NAME = "rrnet_dev"
$DB_USER = "rrnet"
$DB_PASS = "rrnet_secret"

$env:PGPASSWORD = $DB_PASS

Write-Host "Checking super admin account..." -ForegroundColor Yellow

# Check if user exists
$userCheck = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT u.id, u.email, u.name, u.status, r.code as role, u.tenant_id FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = 'admin@rrnet.test';" 2>&1

if ($userCheck -match "admin@rrnet.test") {
    Write-Host "✓ Super Admin user exists" -ForegroundColor Green
    Write-Host $userCheck -ForegroundColor Gray
    
    # Check tenant_id (should be NULL)
    $tenantCheck = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT tenant_id FROM users WHERE email = 'admin@rrnet.test';" 2>&1
    if ($tenantCheck -match "^\s*$" -or $tenantCheck -match "NULL") {
        Write-Host "✓ Super Admin has no tenant (correct)" -ForegroundColor Green
    } else {
        Write-Host "✗ Super Admin has tenant_id (should be NULL)" -ForegroundColor Red
    }
    
    # Check role
    $roleCheck = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT r.code FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = 'admin@rrnet.test';" 2>&1
    if ($roleCheck -match "super_admin") {
        Write-Host "✓ Super Admin has correct role" -ForegroundColor Green
    } else {
        Write-Host "✗ Super Admin role is incorrect: $roleCheck" -ForegroundColor Red
    }
    
    # Check status
    $statusCheck = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT status FROM users WHERE email = 'admin@rrnet.test';" 2>&1
    if ($statusCheck -match "active") {
        Write-Host "✓ Super Admin status is active" -ForegroundColor Green
    } else {
        Write-Host "✗ Super Admin status is not active: $statusCheck" -ForegroundColor Red
    }
    
    # Check password hash
    $hashCheck = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT LEFT(password_hash, 20) FROM users WHERE email = 'admin@rrnet.test';" 2>&1
    if ($hashCheck -match "^\$2a\$12\$") {
        Write-Host "✓ Password hash format is correct (bcrypt)" -ForegroundColor Green
    } else {
        Write-Host "✗ Password hash format is incorrect: $hashCheck" -ForegroundColor Red
    }
} else {
    Write-Host "✗ Super Admin user NOT FOUND!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run database setup:" -ForegroundColor Yellow
    Write-Host "  cd BE" -ForegroundColor White
    Write-Host "  .\scripts\setup-database.ps1" -ForegroundColor White
}

Write-Host ""

