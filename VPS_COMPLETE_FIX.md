# Complete VPS Fix Instructions

## Masalah yang Perlu Diperbaiki:

1. ✅ Migration error - kolom sudah ada
2. ✅ npm install error - dependency conflict
3. ✅ TypeScript build error - missing discount fields

## Solusi Lengkap (Jalankan di VPS):

### Step 1: Copy File yang Sudah Diperbaiki

Dari Windows PowerShell, jalankan (masukkan password `LLaptop7721@` saat diminta):

```powershell
# Copy migration file
scp BE/migrations/000038_add_nas_identifier_to_routers.up.sql root@72.60.74.209:/opt/rrnet/BE/migrations/

# Copy package.json
scp fe/package.json root@72.60.74.209:/opt/rrnet/fe/

# Copy clientService.ts (fix TypeScript)
scp fe/src/lib/api/clientService.ts root@72.60.74.209:/opt/rrnet/fe/src/lib/api/
```

### Step 2: Update di VPS

SSH ke VPS dan jalankan semua perintah ini:

```bash
ssh root@72.60.74.209
# Password: LLaptop7721@

# Update frontend dependencies
cd /opt/rrnet/fe
npm install --legacy-peer-deps

# Build frontend
npm run build

# Run migrations
cd ../BE
export PATH=$PATH:/usr/local/go/bin
export PATH=$PATH:/root/go/bin
migrate -path migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" up

# Restart backend
systemctl restart rrnet-backend
systemctl status rrnet-backend
```

## Atau Gunakan Script All-in-One:

Copy script ini ke VPS dan jalankan:

```bash
# Di VPS, buat file update script
cat > /opt/rrnet/complete_fix.sh << 'EOF'
#!/bin/bash
set -e

cd /opt/rrnet

echo "========================================"
echo "Step 1: Updating frontend dependencies..."
echo "========================================"
cd fe
npm install --legacy-peer-deps
echo "Frontend dependencies updated!"

echo ""
echo "========================================"
echo "Step 2: Building frontend..."
echo "========================================"
npm run build
echo "Frontend build completed!"

echo ""
echo "========================================"
echo "Step 3: Running database migrations..."
echo "========================================"
cd ../BE
export PATH=$PATH:/usr/local/go/bin
export PATH=$PATH:/root/go/bin
if [ -d "migrations" ]; then
    migrate -path migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" up
    echo "Migrations completed!"
else
    echo "No migrations directory found, skipping..."
fi

echo ""
echo "========================================"
echo "Step 4: Restarting backend service..."
echo "========================================"
if systemctl is-active --quiet rrnet-backend; then
    systemctl restart rrnet-backend
    echo "Backend service restarted!"
    sleep 2
    systemctl status rrnet-backend --no-pager -l | head -10
elif [ -f "/etc/systemd/system/rrnet-backend.service" ]; then
    systemctl start rrnet-backend
    systemctl status rrnet-backend --no-pager -l | head -10
else
    echo "Backend service not found. Please create it manually."
fi

echo ""
echo "========================================"
echo "Update completed successfully!"
echo "========================================"
EOF

chmod +x /opt/rrnet/complete_fix.sh
/opt/rrnet/complete_fix.sh
```

## Quick Command (All-in-One):

```bash
cd /opt/rrnet/fe && npm install --legacy-peer-deps && npm run build && cd ../BE && export PATH=$PATH:/usr/local/go/bin:/root/go/bin && migrate -path migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" up && systemctl restart rrnet-backend && echo "Done!"
```

## File yang Sudah Diperbaiki:

1. ✅ `BE/migrations/000038_add_nas_identifier_to_routers.up.sql` - Migration idempotent
2. ✅ `fe/package.json` - Tambah script install:legacy
3. ✅ `fe/src/lib/api/clientService.ts` - Tambah discount_type dan discount_value

Setelah semua langkah di atas, semua masalah seharusnya sudah teratasi!

