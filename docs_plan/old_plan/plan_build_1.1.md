plan build_1.1
core_system_force_spec_v1:
  meta:
    module: "core_system"
    parts: ["auth", "tenant", "rbac", "feature_toggle", "domain_plan"]
    version: "1.0-forced"
    notes:
      - "Force-applied revisions collected from user conversation."
      - "This file is the canonical source for Cursor to implement core system."
      - "Keep this file authoritative; any change should be edited here first."

  auth:
    summary: "JWT access + refresh token; backend acts as RADIUS REST auth provider."
    flows:
      login:
        endpoint: "POST /api/v1/auth/login"
        input: ["email_or_username", "password", "tenant_domain (optional)"]
        process:
          - "validate credentials against users table"
          - "check tenant.status == active"
          - "check user.status == active"
          - "check tenant.feature_toggle allows auth (if feature gated)"
          - "issue access_token (JWT) and refresh_token (UUID/JWT)"
          - "log login event (audit)"
        output: ["access_token", "refresh_token", "expires_in", "token_type"]
      refresh:
        endpoint: "POST /api/v1/auth/refresh"
        input: ["refresh_token"]
        process:
          - "validate refresh token exists & not revoked"
          - "rotate refresh token (optional) if rotation enabled"
          - "issue new access_token (+ new refresh token if rotate)"
        security: "refresh tokens stored server-side (DB or Redis) for revocation"
      logout:
        endpoint: "POST /api/v1/auth/logout"
        input: ["refresh_token"]
        process:
          - "invalidate refresh token (DB/Redis blacklist)"
          - "log logout event"
      password_reset:
        endpoint: "POST /api/v1/auth/password-reset-request"
        notes: "standard email token flow; token TTL short (1h)"
    token_spec:
      access_token:
        type: "JWT"
        signing_alg: "RS256 (recommended)"
        ttl_minutes: 15
        payload:
          - "sub: user_id"
          - "tid: tenant_id"
          - "rids: role_ids (array)"
          - "perms: permissions (optional, cached)"
          - "f: features (enabled features snapshot)"
      refresh_token:
        type: "UUID or opaque token"
        ttl_days: 30
        storage: "DB table refresh_tokens or Redis set"
        revocation_strategy: "store token id + expiry; mark revoked on logout/rotation"
    security:
      password_hash: "bcrypt (cost >= 12)"
      jwt_key_storage: "private key stored in Vault/KMS; public key exposed to services"
      brute_force_protection:
        - "rate-limit login attempts per IP and per username"
        - "temporary lockout policy configurable"
      mfa: "optional future; not in v1"
    audit_logging:
      events: ["login", "logout", "token_refresh", "failed_login", "password_change"]
      storage: "structured logs (DB + external log sink optional)"

  tenant:
    summary: "Tenant model, plan types, limits, addons, domain handling, override rules"
    model:
      table: "tenants"
      fields:
        id: "uuid (pk)"
        name: "string"
        slug: "string (unique, used for subdomain)"
        plan: "enum (basic|pro|business|enterprise)"
        enabled_features: "jsonb (array of feature keys)"
        limits: "jsonb {max_router, max_user, max_voucher, max_odp, max_client_maps}"
        addons: "jsonb {addon_key: {qty, active, activated_at, custom_price}}"
        domain: "string (custom domain optional)"
        status: "enum (active, suspended, isolated, deleted)"
        billing_info: "jsonb (billing metadata)"
        created_at: "timestamp"
        updated_at: "timestamp"
    default_plans:
      basic:
        price: 150000
        defaults:
          max_router: 2
          max_user: 250
          max_voucher: 15000
          max_odp: 20
          max_client_maps: 250
      pro:
        price: 400000
        defaults:
          max_router: 5
          max_user: 1000
          max_voucher: 35000
          max_odp: 50
          max_client_maps: 1000
      business:
        price: 950000
        defaults:
          max_router: 10
          max_user: 5000
          max_voucher: "unlimited"
          max_odp: 150
          max_client_maps: 4000
      enterprise:
        price: "custom"
        defaults:
          unlimited: true
    tenant_override:
      behavior:
        - "Super admin can set tenant.limits.* to override defaults."
        - "Overrides are stored in tenant.limits and used for enforcement."
      billing_implication:
        - "Overrides generate addon-charge items on next invoice (or immediate pro-rated charge if configured)."
    domain_handling:
      subdomain_default: "tenant-slug.example.com"
      custom_domain:
        procedure:
          - "Tenant submits domain & CNAME"
          - "Super admin validates & maps the domain"
          - "Automatic TLS via Let's Encrypt (or placeholder SSL in v1)"
          - "Tenant domain stored in tenant.domain"
      domain_resolution:
        - "Tenant requests without host header -> system resolves by path or default landing"
    tenant_api:
      - GET /api/v1/tenants (super_admin)
      - GET /api/v1/tenants/:id
      - POST /api/v1/tenants (super_admin/create)
      - PATCH /api/v1/tenants/:id (super_admin)
      - POST /api/v1/tenants/:id/override-limits (super_admin)
      - POST /api/v1/tenants/:id/feature-toggle (super_admin)
      - POST /api/v1/tenants/:id/domain (super_admin)
    ui_pages:
      - tenant_list
      - tenant_detail
      - tenant_limits_override
      - tenant_feature_toggle
      - tenant_domain_management

  feature_toggle:
    summary: "Two modes: simple (group) and advance (single-feature). Feature list is canonical source."
    feature_catalog:
      - mikrotik_basic
      - mikrotik_advanced
      - radius_basic
      - voucher_basic
      - wa_basic
      - payment_gateway
      - maps_basic
      - maps_odc_odp_client
      - hcm_basic
      - ai_agent (future)
    toggle_modes:
      simple:
        description: "Enable predefined feature group for tenant"
        groups:
          basic:
            includes: ["mikrotik_basic","radius_basic","voucher_basic","wa_basic","maps_basic"]
          pro:
            includes: ["mikrotik_basic","mikrotik_advanced","radius_basic","voucher_basic","wa_basic","payment_gateway","maps_basic"]
          business:
            includes: ["mikrotik_basic","mikrotik_advanced","radius_basic","voucher_basic","wa_basic","payment_gateway","maps_basic","hcm_basic","maps_odc_odp_client"]
          enterprise:
            includes: "all (admin can customize)"
      advance:
        description: "Toggle features one-by-one"
        behavior:
          - "Toggling on a feature => requires tenant.enabled_features updated"
          - "If feature requires billing (addon) -> create pending addon/invoice or charge immediately per addon policy"
    ui_behavior:
      - "When simple mode used -> all features in group are enabled and reflected in enabled_features array"
      - "When advance mode used -> single features toggled individually"
      - "Some features are auto-activated by default for plan; toggling off possible if allowed by product policy"
    api:
      - POST /api/v1/tenants/:id/feature-toggle (super_admin or tenant.admin depending on policy)
      - GET /api/v1/features (public list)
    enforcement:
      - "Middleware checks feature availability per-route; 403 if disabled."

  rbac:
    summary: "RBAC with tenant-scoped roles + super_admin global role."
    role_definitions:
      global:
        - super_admin
      tenant_scoped:
        - owner:
            description: "Full tenant privileges; in basic plans owner acts as admin"
            default_assign: "first user on tenant creation"
        - admin:
            description: "Manage tenant users, routers, billing; can create sub-owner accounts"
            can_pay_saas_invoices: true
            can_create_subowners: true
        - finance:
            description: "Handle invoices & payments (not default)"
        - HR:
            description: "Manage employees & payroll"
        - technician:
            description: "Router operations, vouchers, isolir"
        - client:
            description: "End-customer roles; subdivided into categories"
            client_categories: ["regular","hotspot","member","custom"]
    permissions:
      structure: "permissions are strings; store in roles.permissions (jsonb array)"
      sample_permissions:
        - router.read
        - router.write
        - router.manage_voucher
        - billing.read
        - billing.manage
        - tenant.settings
        - hr.read
        - hr.manage
        - maps.read
        - maps.manage
    role_management_api:
      - POST /api/v1/roles (super_admin only)
      - GET /api/v1/roles
      - PATCH /api/v1/roles/:id
      - DELETE /api/v1/roles/:id (disallow deleting built-in roles)
      - POST /api/v1/tenants/:id/assign-role (super_admin / tenant.admin)
    runtime_authorization:
      middleware_order:
        - authenticate_jwt
        - tenant_resolver
        - load_tenant_features
        - check_feature_toggle
        - check_limits (if endpoint modifies resources)
        - rbac_authorize (check permissions)
    special_notes:
      - "Owner role implicitly has all tenant permissions; if plan is basic (no RBAC), owner acts as admin."
      - "Tenant admin can create user accounts including sub-owner (investor) accounts; those are normal users with owner/admin roles assigned."

  policies_and_enforcement:
    limit_enforcement:
      principle: "Hard enforcement on resource-creating endpoints"
      examples:
        - "Create router -> check tenant.limits.max_router + sum(addons.extra_router.qty) -> if exceed -> 403 with 'limit_reached' and suggestion"
        - "Generate vouchers -> check tenant.limits.max_voucher"
    override_flow:
      - "Super admin sets override via API -> tenant.limits updated -> invoice/addon created if chargeable"
      - "Overrides can be temporary (expire_at) or permanent; store metadata in tenant.addons override object"
    billing_integration_points:
      - "Feature toggle or override that affects cost must create billing item (invoice line) for next invoice or charge immediately per config"
      - "When addon auto_active -> immediate charge (creates invoice + mark paid if auto gateway)"
    tenant_isolation:
      behavior:
        - "Panel isolation: tenant access to UI and non-network features blocked when tenant.status == isolated"
        - "Network services (routers) kept running; DO NOT auto-shutdown tenant routers"
        - "Radius: return REJECT for auth if tenant isolated and billing policy requires it (configurable)"
    data_retention:
      - "Payment history retention: default keep forever; for 'basic' category purge history >1 year (configurable)"
      - "Audit logs retention: configurable (default 1 year)"

  db_migrations_and_examples:
    notes: "Provide sample migrations for core tables: tenants, users, roles, refresh_tokens"
    sample_tenants_migration:
      - "CREATE TABLE tenants (id uuid primary key, name text, slug text unique, plan text, enabled_features jsonb, limits jsonb, addons jsonb, domain text, status text, created_at timestamp, updated_at timestamp);"
    sample_users_migration:
      - "CREATE TABLE users (id uuid primary key, tenant_id uuid references tenants(id), name text, email text unique, password_hash text, role_id uuid, status text, created_at timestamp);"
    sample_roles_migration:
      - "CREATE TABLE roles (id uuid primary key, tenant_id uuid, name text, permissions jsonb, created_at timestamp);"
    sample_refresh_tokens_migration:
      - "CREATE TABLE refresh_tokens (id uuid primary key, user_id uuid references users(id), token text, expires_at timestamp, revoked boolean default false);"

  ui_and_api_considerations:
    tenant_signup_flow:
      - "tenant registers -> create tenant (status pending) -> super_admin review or auto-approve per config -> create owner user -> send credentials"
    admin_behavior:
      - "tenant.owner initial user created automatically on tenant signup"
    feature_toggle_ui:
      - "simple mode: toggle group; advance mode: per-feature toggle with notice if chargeable"
    error_messages_standard:
      - "limit_reached: 'You reached your limit for {resource}. Please upgrade or request add-on.'"
      - "feature_disabled: 'This feature is not enabled for your plan. Contact admin.'"
      - "tenant_isolated: 'Your account is isolated. Please pay outstanding invoice or contact support.'"

  acceptance_criteria_core:
    - "All auth endpoints implement JWT + refresh flows and store refresh tokens for revocation."
    - "Tenant model supports plan defaults, overrides, addons, and custom domains."
    - "RBAC enforces tenant-scoped permissions; owner role == full tenant privileges."
    - "Feature toggle supports simple (group) and advance (single) modes; middleware enforces feature availability."
    - "Limit enforcement returns clear error codes and messages; super_admin override flow creates billing items."
    - "Sample DB migrations provided for core tables."

  next_step_instruction:
    - "This step 1 (core_system) complete. Please REVIEW this YAML and reply with any corrections."
    - "When ready, respond with: 'lanjut step 2' to proceed to Network Modules force-adjustment."
