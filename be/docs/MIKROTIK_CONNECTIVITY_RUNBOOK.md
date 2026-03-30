# MikroTik Connectivity Runbook (Cloud ERP)

This runbook explains how to make a customer MikroTik router reachable from a **cloud-hosted ERP backend** for:
- **Hotspot vouchers via RADIUS** (MikroTik → FreeRADIUS → ERP `/api/v1/radius/*`)
- **Router management via MikroTik API** (ERP → MikroTik API / API-SSL)

## Tier policy (recommended)

### Basic / Pro (Affordable): Direct/Public

Use **DDNS + port forwarding** with strict firewall rules.

- **Connectivity mode**: `direct_public`
- **Recommended**: MikroTik **API-SSL** (port `8729`) + `api_use_tls=true`
- **Allowed source IPs**: only ERP backend public IP(s)

### Higher tiers (Secure/Robust): VPN

Use a private network between ERP and the router (no public management ports).

- **Connectivity mode**: `vpn`
- **Preferred**: WireGuard on MikroTik
- **Fallback**: third-party VPN gateway (if router cannot run WireGuard reliably)

## Basic/Pro checklist (DDNS + Port Forward)

1. **Enable DDNS**
   - MikroTik IP Cloud (or any DDNS you use)
   - Confirm hostname resolves to the current WAN IP

2. **Enable MikroTik API**
   - Prefer **API-SSL** (`8729`) if possible
   - Create a dedicated user with least privilege

3. **Firewall allowlist (required)**
   - Allow inbound to `8729` (or `8728`) only from ERP backend public IP(s)
   - Drop all other inbound traffic to those ports

4. **Port forwarding**
   - Forward only the required port (API/API-SSL)
   - Avoid exposing Winbox/SSH publicly

## Higher tier checklist (VPN)

1. **WireGuard (preferred)**
   - Configure WG on MikroTik and assign private address
   - Restrict management access to the VPN interface only

2. **Fallback: third-party VPN gateway**
   - Deploy a small gateway on-site (mini PC/RPi) or managed gateway
   - The gateway makes an outbound VPN connection; router management stays private

## Dev/testing note (no VPS yet)

If your backend is still local (laptop), you can temporarily expose it using a tunnel:
- **ngrok**: quick but URL may change on free plan
- **cloudflared**: best with a stable Cloudflare-managed domain

This is only for development/testing; production should use a stable public backend URL.

## Dev/testing: what ngrok helps with (and what it does NOT)

This repo has **two different connectivity directions**:

1) **Router management (ERP → MikroTik API / API-SSL)**  
   - Backend initiates a connection to your router using RouterOS API:
     - TCP `8728` (API) or TCP+TLS `8729` (API-SSL).
   - For this to work across different networks, your router must be reachable from the backend via:
     - **DDNS + port forwarding** (recommended for Basic/Pro), or
     - **VPN** (WireGuard preferred), or
     - A **TCP tunnel** where the tunnel agent runs on a machine inside the router LAN (not on the router).

   **Note:** In the current code, `connectivity_mode` is stored but the test connection uses `host:api_port` directly. So “VPN mode” only works if `host` is a reachable private IP over your VPN.

2) **Hotspot vouchers (MikroTik → FreeRADIUS → ERP REST)**  
   - MikroTik talks to **FreeRADIUS via RADIUS** (`UDP 1812/1813`).
   - FreeRADIUS (rlm_rest) then calls RRNET backend via **HTTP**:
     - `POST /api/v1/radius/auth`
     - `POST /api/v1/radius/acct`

   **Important:** ngrok is great to expose the **backend HTTP** (so FreeRADIUS can reach your laptop), but it typically does **not** solve exposing **RADIUS UDP** from your laptop to a remote MikroTik.

### Recommended dev topology for “remote MikroTik” testing

- **Put FreeRADIUS on a small VPS** (public IP, UDP 1812/1813 open).
- Point MikroTik RADIUS to the VPS IP (shared secret matches your FreeRADIUS config).
- Run RRNET backend locally and expose it via **ngrok/cloudflared**.
- Set FreeRADIUS env:
  - `RRNET_RADIUS_REST_BASE` = your tunnel URL + `/api/v1/radius`
  - `RRNET_RADIUS_REST_SECRET` = matches RRNET backend env `RRNET_RADIUS_REST_SECRET`

This way:
- MikroTik can always reach FreeRADIUS (public UDP),
- FreeRADIUS can reach your local backend (public HTTP tunnel),
- and you can iterate quickly without requiring a full backend deployment.


