# VPS Fix Instructions

## Masalah yang Ditemukan:

1. ✅ **Migration Error**: Kolom `nas_identifier` sudah ada - sudah diperbaiki dengan membuat migration idempotent
2. ⚠️ **npm install Error**: Conflict dependency `@sentry/nextjs` dengan Next.js 16
3. ⚠️ **Build Error**: `react-icons` tidak terinstall karena npm install gagal

## Solusi:

### 1. Pull Perubahan Terbaru
```bash
cd /opt/rrnet
git pull origin main
```

### 2. Fix Migration (jika masih error)
Migration sudah diperbaiki untuk idempotent. Jika masih error, jalankan:
```bash
cd /opt/rrnet/BE
export PATH=$PATH:/usr/local/go/bin
export PATH=$PATH:/root/go/bin
migrate -path migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" up
```

### 3. Install Frontend Dependencies dengan --legacy-peer-deps
```bash
cd /opt/rrnet/fe
npm install --legacy-peer-deps
```

### 4. Build Frontend
```bash
npm run build
```

### 5. Restart Services
```bash
# Restart backend
if systemctl is-active --quiet rrnet-backend; then
    systemctl restart rrnet-backend
fi

# Restart frontend (jika ada)
if systemctl is-active --quiet rrnet-frontend; then
    systemctl restart rrnet-frontend
elif command -v pm2 &> /dev/null && pm2 list | grep -q "rrnet-frontend"; then
    pm2 restart rrnet-frontend
fi
```

## Quick Fix Command (All-in-One):

```bash
cd /opt/rrnet && \
git pull origin main && \
cd BE && \
export PATH=$PATH:/usr/local/go/bin && \
export PATH=$PATH:/root/go/bin && \
if [ -d "migrations" ]; then migrate -path migrations -database "postgres://rrnet:rrnet_secret@localhost:5432/rrnet_dev?sslmode=disable" up; fi && \
cd ../fe && \
npm install --legacy-peer-deps && \
npm run build && \
if systemctl is-active --quiet rrnet-backend; then systemctl restart rrnet-backend; fi
```

