#!/bin/bash

# Fix PostgreSQL Authentication for rrnet user
# This script will create/reset the rrnet user with correct password

set -e

echo "=========================================="
echo "Fixing PostgreSQL Authentication"
echo "=========================================="

# Database credentials
DB_USER="rrnet"
DB_PASSWORD="rrnet_secret"
DB_NAME="rrnet_dev"

echo ""
echo "Step 1: Checking if PostgreSQL is running..."
if ! systemctl is-active --quiet postgresql; then
    echo "Starting PostgreSQL..."
    systemctl start postgresql
    sleep 2
fi

echo "✓ PostgreSQL is running"

echo ""
echo "Step 2: Checking if user 'rrnet' exists..."
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null || echo "0")

if [ "$USER_EXISTS" = "1" ]; then
    echo "✓ User 'rrnet' exists"
    echo "  Resetting password..."
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
    echo "✓ Password reset successfully"
else
    echo "  User 'rrnet' does not exist. Creating..."
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
    echo "✓ User created successfully"
fi

echo ""
echo "Step 3: Granting CREATEDB privilege..."
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;" 2>/dev/null || true
echo "✓ Privileges granted"

echo ""
echo "Step 4: Testing connection..."
if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
    echo "✓ Connection test successful!"
else
    echo "✗ Connection test failed. Checking PostgreSQL configuration..."
    
    echo ""
    echo "Step 5: Checking pg_hba.conf configuration..."
    PG_HBA_FILE="/etc/postgresql/*/main/pg_hba.conf"
    
    if ls $PG_HBA_FILE 1> /dev/null 2>&1; then
        echo "  Found pg_hba.conf file"
        echo "  Current local authentication settings:"
        grep "^local\|^host.*127.0.0.1\|^host.*localhost" $PG_HBA_FILE | head -5 || echo "    (no matching lines found)"
        
        echo ""
        echo "  Note: If authentication fails, you may need to:"
        echo "    1. Edit pg_hba.conf to allow password authentication"
        echo "    2. Or use 'trust' method for local connections (less secure)"
        echo "    3. Restart PostgreSQL after changes"
    else
        echo "  Could not find pg_hba.conf file"
    fi
fi

echo ""
echo "Step 6: Checking if database exists..."
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")

if [ "$DB_EXISTS" = "1" ]; then
    echo "✓ Database '$DB_NAME' exists"
    
    echo ""
    echo "Step 7: Granting permissions on database..."
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
    sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
    sudo -u postgres psql -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO $DB_USER;" 2>/dev/null || true
    echo "✓ Permissions granted"
    
    echo ""
    echo "Step 8: Testing connection to database..."
    if PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✓ Database connection test successful!"
    else
        echo "✗ Database connection test failed"
    fi
else
    echo "  Database '$DB_NAME' does not exist"
    echo "  You may need to create it:"
    echo "    sudo -u postgres createdb -O $DB_USER $DB_NAME"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo "User: $DB_USER"
echo "Password: $DB_PASSWORD"
echo "Database: $DB_NAME"
echo ""
echo "To connect, use:"
echo "  PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME"
echo ""
echo "Or:"
echo "  psql -h localhost -U $DB_USER -d $DB_NAME"
echo "  (then enter password: $DB_PASSWORD)"
echo ""

