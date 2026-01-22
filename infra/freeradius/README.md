# FreeRADIUS Configuration for RRNET

This directory contains FreeRADIUS configuration files for RRNET voucher authentication.

## Files

- `sites-enabled/default` - Main virtual server configuration (PAP + REST)
- `mods-enabled/rest` - REST module configuration for backend API integration
- `mods-config/files/authorize` - Dummy password file for PAP decode (provides password reference)

## Deployment

### 1. Copy Configuration Files

```bash
# Copy config files to FreeRADIUS directory
cp infra/freeradius/sites-enabled/default /etc/freeradius/3.0/sites-enabled/default
cp infra/freeradius/mods-enabled/rest /etc/freeradius/3.0/mods-enabled/rest

# Create mods-config/files directory if it doesn't exist
mkdir -p /etc/freeradius/3.0/mods-config/files

# Copy dummy password file for PAP decode
cp infra/freeradius/mods-config/files/authorize /etc/freeradius/3.0/mods-config/files/authorize

# Set proper permissions
chown root:freerad /etc/freeradius/3.0/sites-enabled/default
chown root:freerad /etc/freeradius/3.0/mods-enabled/rest
chown root:freerad /etc/freeradius/3.0/mods-config/files/authorize
chmod 644 /etc/freeradius/3.0/sites-enabled/default
chmod 644 /etc/freeradius/3.0/mods-enabled/rest
chmod 644 /etc/freeradius/3.0/mods-config/files/authorize
```

### 2. Configuration Notes

**No Environment Variables Required:**
- REST API URLs are hardcoded in `mods-enabled/rest` (default: `http://127.0.0.1:8080/api/v1/radius`)
- REST secret is hardcoded in `sites-enabled/default` (default: `dev-radius-rest-secret`)
- To change these values, edit the config files directly

**Dummy Password File:**
- `mods-config/files/authorize` provides dummy password reference for PAP decode
- PAP module needs password reference to decode User-Password (binary) → Cleartext-Password
- Dummy password will always fail comparison (expected), but password is already decoded
- REST module uses decoded Cleartext-Password for actual validation

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
   - `files` - Provides dummy password reference (allows PAP to decode)
   - Set `Auth-Type := PAP` if User-Password exists

2. **Authenticate Phase (PAP):**
   - `pap` - Decode User-Password (binary) → Cleartext-Password (plain text)
   - PAP comparison fails (dummy password doesn't match) - this is expected
   - `rest` - Call REST module directly (within PAP section)
   - REST uses decoded Cleartext-Password for validation
   - If REST succeeds, override PAP failure with `ok`

3. **Accounting Phase:**
   - Send accounting data (Start/Interim/Stop) to backend
   - Backend records session information

### REST Module Configuration

- **Authenticate URI:** `http://127.0.0.1:8080/api/v1/radius/auth` (hardcoded)
- **Accounting URI:** `http://127.0.0.1:8080/api/v1/radius/acct` (hardcoded)
- **Method:** POST
- **Body:** JSON
- **Password Field:** `Cleartext-Password` (decoded by PAP, plain text in JSON)
- **Secret Header:** `X-RRNET-RADIUS-SECRET: dev-radius-rest-secret` (hardcoded)

## Troubleshooting

### Error: "No password configured for the user. Cannot do authentication"

**Cause:** Dummy password file (`mods-config/files/authorize`) is missing or not readable.

**Solution:**
```bash
# Create directory if it doesn't exist
mkdir -p /etc/freeradius/3.0/mods-config/files

# Copy dummy password file
cp infra/freeradius/mods-config/files/authorize /etc/freeradius/3.0/mods-config/files/authorize

# Set proper permissions
chown root:freerad /etc/freeradius/3.0/mods-config/files/authorize
chmod 644 /etc/freeradius/3.0/mods-config/files/authorize

# Restart FreeRADIUS
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
2. Check REST URI in `mods-enabled/rest` matches your backend URL
3. Verify backend port matches the hardcoded URL in config

### Error: "PAP comparison failed but REST not called"

**Cause:** PAP failure prevents REST from being called.

**Solution:**
- This is expected behavior - PAP comparison will fail (dummy password)
- REST module should be called after PAP decode
- Check config: REST should be called within `Auth-Type PAP` section
- Verify `if (ok || updated) { ok }` is present to override PAP failure

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

