# FreeRADIUS Configuration for RRNET

This directory contains FreeRADIUS configuration files for RRNET voucher authentication.

## Files

- `sites-enabled/default` - Main virtual server configuration (PAP + REST)
- `mods-enabled/rest` - REST module configuration for backend API integration

## Deployment

### 1. Copy Configuration Files

```bash
# Copy config files to FreeRADIUS directory
cp infra/freeradius/sites-enabled/default /etc/freeradius/3.0/sites-enabled/default
cp infra/freeradius/mods-enabled/rest /etc/freeradius/3.0/mods-enabled/rest

# Set proper permissions
chown root:freerad /etc/freeradius/3.0/sites-enabled/default
chown root:freerad /etc/freeradius/3.0/mods-enabled/rest
chmod 644 /etc/freeradius/3.0/sites-enabled/default
chmod 644 /etc/freeradius/3.0/mods-enabled/rest
```

### 2. Set Environment Variables

The REST module requires environment variables to be set in the systemd service:

```bash
# Edit FreeRADIUS systemd service
systemctl edit freeradius.service
```

Add the following content:

```ini
[Service]
Environment="RRNET_RADIUS_REST_BASE=http://127.0.0.1:8080/api/v1/radius"
Environment="RRNET_RADIUS_REST_SECRET=your-secret-key-here"
```

**Note:** 
- `RRNET_RADIUS_REST_BASE`: Backend API base URL (adjust IP/port if backend is on different server)
- `RRNET_RADIUS_REST_SECRET`: Secret key for REST API authentication (must match backend config)

### 3. Reload and Restart

```bash
# Reload systemd daemon
systemctl daemon-reload

# Test configuration
freeradius -C

# Restart FreeRADIUS service
systemctl restart freeradius

# Check status
systemctl status freeradius --no-pager -l
```

## Configuration Details

### PAP Authentication Flow

1. **Authorize Phase:**
   - `preprocess` - Process incoming request
   - `pap` - Decode User-Password (binary) → Cleartext-Password (plain text)
   - If Cleartext-Password exists, set `Auth-Type := REST`

2. **Authenticate Phase:**
   - `Auth-Type REST` - Send request to backend REST API
   - Backend validates voucher and password
   - Returns success/failure

3. **Accounting Phase:**
   - Send accounting data (Start/Interim/Stop) to backend
   - Backend records session information

### REST Module Configuration

- **Authenticate URI:** `$ENV{RRNET_RADIUS_REST_BASE}/auth`
- **Accounting URI:** `$ENV{RRNET_RADIUS_REST_BASE}/acct`
- **Method:** POST
- **Body:** JSON
- **Password Field:** `Cleartext-Password` (decoded by PAP, plain text in JSON)

## Troubleshooting

### Error: "URL using bad/illegal format or missing URL"

**Cause:** `RRNET_RADIUS_REST_BASE` environment variable is not set.

**Solution:**
```bash
# Check if env var is set
systemctl show freeradius.service | grep Environment

# If not set, edit service and add environment variable
systemctl edit freeradius.service
# Add: Environment="RRNET_RADIUS_REST_BASE=http://127.0.0.1:8080/api/v1/radius"
systemctl daemon-reload
systemctl restart freeradius
```

### Error: "Duplicate module" or "Duplicate virtual server"

**Cause:** Backup files (`.backup`) exist in `mods-enabled/` or `sites-enabled/`.

**Solution:**
```bash
# Remove backup files
rm /etc/freeradius/3.0/mods-enabled/*.backup
rm /etc/freeradius/3.0/sites-enabled/*.backup
```

### Error: "Instantiation failed for module rest"

**Cause:** REST module cannot connect to backend or URL is invalid.

**Solution:**
1. Verify backend is running: `curl http://127.0.0.1:8080/api/v1/radius/auth`
2. Check environment variable is set correctly
3. Verify backend port matches `RRNET_RADIUS_REST_BASE`

## Testing

### Test Configuration Syntax

```bash
freeradius -C
```

### Test with Debug Mode

```bash
# Stop service
systemctl stop freeradius

# Run in debug mode
freeradius -X

# In another terminal, test authentication from MikroTik
# Watch debug output for request/response details
```

### Monitor Logs

```bash
# FreeRADIUS logs
journalctl -u freeradius -f

# Or log file
tail -f /var/log/freeradius/radius.log
```

## Notes

- This configuration uses **PAP authentication** (Password Authentication Protocol)
- User-Password is decoded to Cleartext-Password by PAP module
- Cleartext-Password is sent as **plain text** in JSON (not binary/encoded)
- This is the correct and stable approach for voucher-only authentication
- Backend should validate voucher code and password before consuming voucher atomically

