# MikroTik Onboarding Guide (Step-by-step, Copy-Paste Friendly)

> **📌 Looking for a simpler guide?** Check out [`MIKROTIK_SETUP_SIMPLE.md`](./MIKROTIK_SETUP_SIMPLE.md) for a more beginner-friendly, step-by-step guide with clear examples.

---

Goal: make a customer MikroTik **reachable from RRNET backend** without complex onboarding.

This guide is optimized for **Basic (DDNS + Port Forward)** and provides:

- a **basic MikroTik script** that is safe (minimal changes, tagged, undo-able),
- an **undo script** to revert RRNET changes,
- a simple checklist to verify connectivity.

> Important: there is no way to avoid **any** MikroTik-side configuration. At minimum, someone must run a one-time script (Winbox/WebFig/terminal).

---

## What “connect router” means in RRNET

RRNET connects to MikroTik using **RouterOS API**:

- **TCP 8728**: API (no TLS)
- **TCP 8729**: API-SSL (TLS) — recommended when possible

So “connect router from RRNET” means:

1. The RRNET backend server can reach `HOST:PORT` (8728/8729).
2. The credentials are correct.

If RRNET is deployed on a VPS/cloud, then **the VPS** must be able to reach the router (not your laptop).

---

## Pre-check (important): Public IP vs CGNAT

DDNS + port forwarding only works if the customer has a real public IP.

- **If WAN IP on MikroTik = public IP** and it matches “What is my IP” → OK.
- **If WAN IP is private (CGNAT)** → inbound port forward will not work.
  - Options: ask ISP for public IP, or use VPN (WireGuard/Tailscale/site-to-site).

---

## Data you need before onboarding

- **ERP server IP**: the public IP of RRNET backend (VPS) that will connect to MikroTik.
  - If you are still developing locally: this will be your laptop public IP, but it changes often.
  - **Alternative for development**: use ngrok TCP tunnel (see below).
- **API port**:
  - Start with **8728** (most compatible)
  - Move to **8729** later (hardening)
- **RouterOS admin access** for one-time copy/paste (Winbox/WebFig/terminal).

---

## Development option: Using ngrok TCP tunnel (for local testing)

If you are developing locally and want to test MikroTik connectivity without port forwarding:

1. **On your laptop** (same network as MikroTik), run:

   **Option 1: Using helper script (recommended)**

   ```powershell
   cd E:\Project\ERP_NET\BE
   .\scripts\start_ngrok_tcp.ps1
   ```

   **Option 2: Direct ngrok command**

   ```bash
   ngrok tcp 8728
   ```

   You'll get output like:

   ```
   Forwarding    tcp://0.tcp.ngrok.io:12345 -> localhost:8728
   ```

   > **Note**: If ngrok shows "authentication failed" or "version too old", run `ngrok update` first.

2. **Note the ngrok hostname and port** (e.g., `0.tcp.ngrok.io:12345`).

3. **In MikroTik BASIC script**: use ngrok's IP (resolve the hostname) or allowlist ngrok's IP range.

   - To get ngrok IP: `nslookup 0.tcp.ngrok.io` or check ngrok dashboard.

4. **In RRNET "Add Router"**:
   - **host**: `0.tcp.ngrok.io` (or the ngrok hostname you got)
   - **api_port**: `12345` (the ngrok port, not 8728)
   - **api_use_tls**: `false`

> **Note**: ngrok TCP tunnel URLs change on each restart (free plan). For production, use DDNS + port forward instead.

---

## Step 1 — MikroTik: run BASIC setup script (safe + tagged)

This script:

- enables `/ip service api` on port `8728`,
- creates an allowlist address-list: `rrnet-allow`,
- adds a firewall input rule allowing API **only from** your RRNET backend IP,
- tags everything it adds with `RRNET:` so it can be undone safely.

### BASIC setup script (copy-paste)

**Option A: Simplified (recommended, no variables)**

Replace `1.2.3.4` with your RRNET server public IP (or ngrok IP if using ngrok TCP tunnel).

```routeros
# RRNET BASIC SETUP (simplified, no variables)
# Replace "1.2.3.4" with your RRNET server public IP

/ip service set api disabled=no port=8728
/ip firewall address-list add list=rrnet-allow address=1.2.3.4 comment="RRNET: allow ERP server"
/ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728 src-address-list=rrnet-allow comment="RRNET: allow API (tcp/8728) from allowlist"
:log info "RRNET: BASIC setup done"
```

**Option B: With variables (if you need to reuse values)**

Replace `1.2.3.4` with your RRNET server public IP.

```routeros
# RRNET BASIC SETUP (with variables)
# Replace "1.2.3.4" with your RRNET server public IP

:local ERPServerIP "1.2.3.4"
:local allowListName "rrnet-allow"
:local commentTag "RRNET:"

/ip service set api disabled=no port=8728
/ip firewall address-list add list=$allowListName address=$ERPServerIP comment=($commentTag . " allow ERP server")
/ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728 src-address-list=$allowListName comment=($commentTag . " allow API (tcp/8728) from allowlist")
:log info ($commentTag . " BASIC setup done")
```

**Important notes:**

- Do **not** paste markdown fences (the ``` lines).
- If using **ngrok TCP tunnel**: replace `1.2.3.4` with ngrok's IP (resolve the ngrok hostname to get IP).
- If you already have "drop all input" rules, you may need to move this accept rule above them manually.

---

## Step 2 — Network/WAN: DDNS + Port Forward (if router is behind NAT)

This is environment-dependent. There are 3 common cases:

### Case A — MikroTik is the main gateway (does NAT)

- Add **dst-nat port forward** from WAN → router itself (8728/8729).
- Ensure firewall input allows the port only from allowlist.

### Case B — MikroTik is behind another router/ONT

- You must set port forwarding on the upstream router/ONT to the MikroTik WAN/LAN IP.
- Then MikroTik firewall must allow the port.

### Case C — CGNAT

- Port forwarding won’t work. Use VPN or get a public IP.

> Keep it safe: do NOT open Winbox/SSH to the internet. Only open RouterOS API ports and only to allowlisted IPs.

---

## Step 3 — RRNET: add router (minimal fields)

In RRNET, the connection test uses:

- `host` + `api_port` + `api_use_tls` + `username` + `password`

For BASIC onboarding:

- **host**: customer DDNS hostname or public IP (whichever points to the router)
- **api_port**: `8728`
- **api_use_tls**: `false`

Then click **Test Connection**.

Expected success: RRNET shows Router identity + latency.

---

## Step 4 — Undo (remove RRNET changes only)

This undo script removes only items tagged with `RRNET:` and keeps existing customer configuration intact.

### BASIC undo script (copy-paste)

**Simplified version (recommended):**

```routeros
# RRNET BASIC UNDO (simplified)
/ip firewall filter remove [find where comment~"RRNET:"]
/ip firewall address-list remove [find where comment~"RRNET:"]
:log info "RRNET: BASIC undo done (API service not disabled)"
```

**With variables version:**

```routeros
# RRNET BASIC UNDO (with variables)
:local allowListName "rrnet-allow"
:local commentTag "RRNET:"

/ip firewall filter remove [find where comment~$commentTag]
:foreach i in=[/ip firewall address-list find where list=$allowListName and comment~$commentTag] do={
  /ip firewall address-list remove $i
}
:log info ($commentTag . " BASIC undo done (API service not disabled)")
```

---

## Troubleshooting (fast)

- **Test Connection fails immediately**:

  - check if you used the correct `host` (public vs private),
  - confirm `8728` is reachable from the RRNET server public IP,
  - confirm firewall rule exists and allowlist contains RRNET server IP.

- **Works only when laptop is on the same LAN**:

  - you used private `192.168.x.x` host; when RRNET is deployed, server can’t reach private LAN.

- **Still can’t reach from outside even after port forward**:
  - very likely CGNAT or upstream router/ONT not forwarding correctly.

---

## Next step (later hardening)

After BASIC works, we can add an **ADVANCED script** (optional, router-specific) for:

- API-SSL `8729`,
- stronger firewall hardening,
- optional WireGuard profiles.

# Start ngrok tunnel ke port 8080

#ngrok http 8080
