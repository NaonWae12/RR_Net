# Database Connection Information

## PostgreSQL Database (Docker)

### Connection Details untuk pgAdmin:

| Field        | Value          |
| ------------ | -------------- |
| **Host**     | `localhost`    |
| **Port**     | `15432`        |
| **Database** | `rrnet_dev`    |
| **Username** | `rrnet`        |
| **Password** | `rrnet_secret` |

### Connection String:

```
postgresql://rrnet:rrnet_secret@localhost:15432/rrnet_dev
```

### Docker Container Info:

- **Container Name**: `rrnet-postgres`
- **Image**: `postgres:16-alpine`
- **Internal Port**: `5432` (mapped to host `15432`)
- **Volume**: `postgres_data` (persistent storage)

---

## Setup Connection di pgAdmin

### Step 1: Buka pgAdmin

1. Buka pgAdmin
2. Klik kanan pada **Servers** → **Create** → **Server**

### Step 2: General Tab

- **Name**: `RRNET Development` (atau nama lain)

### Step 3: Connection Tab

- **Host name/address**: `localhost`
- **Port**: `15432`
- **Maintenance database**: `rrnet_dev`
- **Username**: `rrnet`
- **Password**: `rrnet_secret`
- ✅ **Save password** (optional, untuk convenience)

### Step 4: Advanced Tab (Optional)

- **DB restriction**: `rrnet_dev` (untuk hanya show database ini)

### Step 5: Save

Klik **Save** untuk menyimpan connection.

---

## Test Connection via psql

```bash
psql -h localhost -p 15432 -U rrnet -d rrnet_dev
```

Password: `rrnet_secret`

---

## Test Connection via PowerShell

```powershell
# Install module jika belum ada
# Install-Module -Name SqlServer -AllowClobber

# Test connection
$connectionString = "Server=localhost,15432;Database=rrnet_dev;User Id=rrnet;Password=rrnet_secret;"
# Atau gunakan psql command
```

---

## Environment Variable (untuk Backend)

Di file `BE/.env`:

```env
DATABASE_URL=postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable
```

Atau:

```env
DATABASE_URL=postgresql://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable
```

---

## Redis Connection (Bonus Info)

| Field        | Value          |
| ------------ | -------------- |
| **Host**     | `localhost`    |
| **Port**     | `6379`         |
| **Password** | (none, kosong) |
| **Database** | `0`            |

---

## Troubleshooting

### Connection Refused

1. Pastikan Docker container running:

   ```bash
   docker ps | grep rrnet-postgres
   ```

2. Jika tidak running, start container:
   ```bash
   docker-compose up -d postgres
   ```

### Authentication Failed

1. Pastikan username dan password sesuai dengan `docker-compose.yml`
2. Cek apakah database sudah dibuat:
   ```sql
   SELECT datname FROM pg_database WHERE datname = 'rrnet_dev';
   ```

### Port Already in Use

Jika port 15432 sudah digunakan:

1. Cek process yang menggunakan port:
   ```powershell
   netstat -ano | findstr :15432
   ```
2. Atau ubah port di `docker-compose.yml`:
   ```yaml
   ports:
     - "15433:5432" # Ganti 15432 dengan port lain
   ```

---

_Last updated: Manual Testing Phase_
