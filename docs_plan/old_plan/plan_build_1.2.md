plan build_1.2
network_modules_force_spec_v1:
  meta:
    module: "network_modules"
    parts: ["mikrotik", "radius", "voucher"]
    version: "1.0-forced"
    notes:
      - "Covers all Router, Radius, Voucher logic with forced revisions from user."
      - "Designed to be modular, scalable, and easily implemented using Golang backend."
      - "Integrates with tenant limits, RBAC, feature toggle, and billing modules."

  mikrotik:
    summary: "Mikrotik router management for Hotspot & PPPoE with sync + isolated but NOT disabled."
    connector:
      library: "routeros-go (or custom wrapper)"
      connection_method: "API port 8728 or 8729 (TLS)"
      credentials_storage: "encrypted in DB (AES-GCM recommended)"
    router_model:
      table: "routers"
      fields:
        id: "uuid"
        tenant_id: "uuid"
        name: "string"
        host: "string (IP/domain)"
        port: "int"
        username: "encrypted string"
        password: "encrypted string"
        use_tls: "bool"
        sync_interval: "int (seconds)"
        status: "enum (online, offline, error)"
        created_at: "timestamp"
    router_endpoints:
      - GET   /api/v1/routers
      - POST  /api/v1/routers
      - GET   /api/v1/routers/:id
      - PATCH /api/v1/routers/:id
      - DELETE /api/v1/routers/:id
      - POST /api/v1/routers/:id/test-connection
      - GET  /api/v1/routers/:id/active-users
      - GET  /api/v1/routers/:id/dhcp-leases
      - POST /api/v1/routers/:id/active-users/:session_id/disconnect
    features:
      active_users:
        hotspot: true
        pppoe: true
      create_user:
        hotspot_user:
          fields: ["name", "password", "profile"]
        pppoe_user:
          fields: ["name", "password", "profile", "service"]
      list_accounts:
        hotspot: true
        pppoe: true
      sync_router:
        configurable_interval: true
        default: 300
        short_live_session_polling: 10-30 seconds
      metrics:
        supported: ["cpu", "memory", "uptime"]
      optional:
        auto_push_voucher: true
    sync_behavior:
      caching:
        store: "Redis"
        ttl_seconds: 60-180
      background_job:
        queue: "Asynq"
        tasks:
          - router_sync_job
          - dhcp_sync_job
          - active_sessions_sync_job
    tenant_limit_enforcement:
      - "On create router -> check tenant.limits.max_router + addons.extra_router"
      - "If limit exceeded -> return error 'limit_reached'"
    isolir_rules:
      tenant_isolated:
        ui_access: "blocked"
        router_connection: "allowed"
        radius_auth: "may reject based on config"
        mikrotik_router_shutdown: "NEVER allowed"
    logs:
      sync_logs: "store in router_sync_logs table"
      connection_errors: "stored for debugging"
    ui_pages:
      - router_list
      - router_detail_overview
      - router_active_users
      - router_accounts
      - router_dhcp
      - router_settings

  radius:
    summary: "Backend acts as REST-based authentication provider via FreeRADIUS."
    architecture:
      - "FreeRADIUS ➜ backend (REST auth/acct) ➜ backend validates user ➜ respond ACCEPT/REJECT"
      - "Backend controls user rules, expiry, voucher validity, billing lock, tenant isolation."
    endpoints:
      - POST /radius/auth
      - POST /radius/acct
    auth_flow:
      receive_fields:
        - username
        - password
        - nas_ip
        - called_station_id
        - calling_station_id
        - service (hotspot/pppoe)
      validation_steps:
        - "check tenant active"
        - "check user exists"
        - "check user category (regular/hotspot/member)"
        - "check user status"
        - "check voucher validity (if voucher)"
        - "check billing status: end-user unpaid -> reject if auto-isolir enabled"
        - "check tenant isolated -> reject or accept depending on policy"
        - "check profile assignment"
      possible_responses:
        - ACCEPT
        - REJECT (with reason code)
    reason_codes:
      - expired_account
      - user_not_found
      - invalid_credentials
      - billing_unpaid
      - voucher_expired
      - tenant_isolated
      - profile_denied
    accounting_flow:
      acct_start:
        - store session
        - mark user online
      acct_interim:
        - update bytes
        - update session_time
      acct_stop:
        - finalize bytes
        - compute cost if needed
        - mark user offline
      session_table_fields:
        - id
        - tenant_id
        - user_id
        - username
        - router_id
        - session_id
        - start_at
        - stop_at
        - upload_bytes
        - download_bytes
    billing_integration:
      - "acct_stop triggers billing for pay-per-use (future optional)"
    security:
      - "shared-secret between FreeRADIUS and backend"
    ui_pages:
      - radius_settings
      - radius_logs
      - radius_active_sessions

  voucher:
    summary: "Voucher system similar to Mikhmon, with package & batch generator."
    modes:
      validation_mode:
        server_validation: true
        mikrotik_only_mode: false
      push_modes:
        auto_push_enabled: "configurable per tenant"
        manual_push: "via UI"
    package_model:
      table: "voucher_packages"
      fields:
        - id
        - tenant_id
        - name
        - price
        - duration_hours
        - expiration_days
        - speed_limit
        - profile
        - multi_use: boolean
    voucher_code_model:
      table: "vouchers"
      fields:
        - id
        - tenant_id
        - code
        - package_id
        - status: ["unused", "used", "expired", "revoked"]
        - used_by
        - used_at
        - created_at
    batch_generator:
      params:
        - count
        - prefix
        - charset
        - code_length
        - package_id
        - export_pdf: bool
        - export_csv: bool
      output:
        - "generated voucher records"
        - "export files (PDF/CSV)"
      behavior:
        - "bulk insert for speed"
        - "optionally auto-push to mikrotik via job queue"
    validation_rules:
      server_mode:
        - "check code exists"
        - "check not used"
        - "check not expired"
        - "apply usage -> mark used"
      mikrotik_push_mode:
        - "voucher pushed to router as hotspot/pppoe user"
        - "server marks voucher as used"
    tenant_limit_enforcement:
      - "Generating vouchers checks tenant.limits.max_voucher"
    expirations:
      - "daily cron to expire vouchers automatically"
    ui_pages:
      - package_list
      - create_package
      - voucher_batch_generator
      - generated_voucher_list
      - voucher_settings
    apis:
      - GET /api/v1/vouchers
      - POST /api/v1/vouchers/batch
      - POST /api/v1/vouchers/validate
      - POST /api/v1/vouchers/push/:router_id
    business_rules:
      - "Voucher usage logs stored in voucher_usage table"
      - "One-click export"
      - "Profiles auto-mapped with Mikrotik profiles"
      - "For member category, voucher may have discount logic (future)"

  integrations_between_network_modules:
    mikrotik_radius:
      - "Router user creation via BE ensures RADIUS user created too"
      - "Disconnect event triggers acct-stop"
    voucher_radius:
      - "Voucher → RADIUS auth code if server-validation"
    billing_dependency:
      - "acct_stop produces usage logs for future pay-per-use billing"
      - "vouchers tied to tenant billing limits"
    maps_dependency:
      - "router location stored for maps (optional future)"
    wa_notification_dependency:
      - "optional WA notification when voucher used or expiring soon"

  acceptance_criteria_network_system:
    - "Routers can be added, edited, deleted, tested, synced."
    - "Active hotspot & PPPoE sessions retrieved correctly."
    - "Voucher validation works (server mode primary)."
    - "Radius auth returns correct ACCEPT/REJECT reason codes."
    - "Tenant limit enforcement works for routers, vouchers."
    - "Auto-push vouchers runs via background jobs."
    - "Tenant isolation does NOT disable routers, only panel + radius (optional)."

  next_step_instruction:
    - "Step 2 (network_modules) selesai. Silakan cek YAML ini."
    - "Jika sudah oke, balas: 'lanjut step 3'."
    - "Step 3 = Billing Systems (SaaS Billing + End-User Billing + Upstream Billing)."
