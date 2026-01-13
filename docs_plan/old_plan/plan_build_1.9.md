plan build_1.9
integration_layer_force_spec_v1:
  meta:
    module: "integration_layer"
    version: "1.0-forced"
    notes:
      - "Defines how every subsystem connects: RRNet SaaS OS ecosystem."
      - "Includes event flows, sync flows, limit hooks, billing hooks, notification triggers, and cascading rules."
      - "Ensures no module works in isolation."

  core_event_bus:
    summary: "All modules fire and listen to system-wide events."
    type: "Internal Event Bus (in-memory) + Background Queue Workers (Asynq)"
    event_types:
      - tenant_created
      - tenant_plan_changed
      - addon_activated
      - addon_pending_approval
      - addon_rejected
      - invoice_created
      - invoice_overdue
      - invoice_paid
      - enduser_invoice_created
      - enduser_invoice_overdue
      - enduser_invoice_paid
      - router_sync_complete
      - radius_auth_attempt
      - outage_trigger
      - outage_resolve
      - technician_activity_created

  module_to_module_integration:

    auth_to_tenant:
      - "Login returns tenant context."
      - "Tenant disabled → login rejected."
      - "Tenant isolation → login allowed? NO (panel locked)."

    tenant_to_feature_toggle:
      - "Tenant plan determines enabled features."
      - "Feature addons override plan."
      - "Toggling feature immediately updates BE middleware rules."

    tenant_to_limits:
      - "limits = base_plan_limit + addon_units"
      - "limits used by: router, users, ODP, clients, vouchers, etc."

    addon_to_billing:
      - "Every activated (or approved) addon generates prorated charge."
      - "Deactivation only effective next cycle."
      - "Custom addon requests require admin approval."

    addon_to_limits:
      - extra_router → network.max_router  
      - extra_user_pack → radius.max_users  
      - extra_ODP_maps → maps.max_ODP  
      - extra_client_maps → maps.max_client  
      - wa_premium → wa.rate_limit_override  

    billing_to_isolir:
      - "SaaS unpaid = tenant isolated"
      - "End-user unpaid = customer isolated (router rule)"
      - "Upstream unpaid = no isolir (notification only)"

    isolir_to_mikrotik:
      tenant:
        - "Tenant isolated → DO NOT disable routers"
        - "Access to system dashboard locked"
      customer:
        - "End-user unpaid → change profile / move firewall"
        - "Lift isolir automatically when invoice paid"

    network_to_billing:
      - "PPPoE sessions produce acct logs → future pay-per-use"
      - "Hotspot sessions track voucher usage"

    network_to_maps:
      - "Router location (optional future)"
      - "Technician assigned jobs appear on map"

    maps_to_outage:
      - "Changing ODC status triggers cascade to ODP/Clients."
      - "ODP outage cascades to Clients."
      - "Client outage affects only itself."
      - "Outage fired → WA notifications optional."

    hr_to_maps:
      - "Technician activities displayed on node detail pages."

    hr_to_billing:
      - "Payroll is internal tenant cost (not billed by SaaS)."

    wa_to_billing:
      - "WA sent on invoice events (tenant + end-user)."

    wa_to_voucher:
      - "Voucher generation optional WA blast."

    super_admin_to_everything:
      - "Can override tenant plan, billing, routing, limits, addons, status, isolation, WA provider, etc."

  cross-module_data_consistency:
    mechanisms:
      - foreign_key_constraints
      - background_reconciliation_jobs
      - stale_cache_invalidation
      - on-change propagation
    cache_stores:
      - redis_cache: hotspot_sessions, pppoe_sessions, router_metrics
    invalidation_triggers:
      - router_sync_complete
      - plan_changed
      - addon_activated
      - outage_trigger

  api_gateway_rules:
    enforced_by:
      - Authentication filter
      - Tenant-isolation middleware
      - Feature-toggle middleware
      - Role-based permissions middleware
      - Rate-limit per-tenant (WA + API)
    global:
      - "All tenant APIs require valid tenant_id context."
      - "Super admin bypasses tenant-scoped restrictions."

  background_jobs:
    task_types:
      - router_sync_job
      - radius_acct_job
      - outage_propagation_job
      - voucher_expiration_job
      - monthly_saas_invoice_job
      - monthly_enduser_invoice_job
      - upstream_invoice_job
      - wa_send_job
      - wa_retry_job
      - technician_activity_sync_job
      - addon_usage_reconciliation
    requirements:
      - retries
      - multiline logs
      - failure notifications
      - system queue health view in super admin panel

  data_models_unification:
    unify_ids:
      - router_id
      - odc_id
      - odp_id
      - client_id
      - tenant_id
      - user_id
      - employee_id
      - addon_id
    naming_convention: "snake_case db → camelCase API → PascalCase BE struct"
    relationship_summary:
      - tenant has many routers
      - tenant has many ODC → ODP → Client nodes
      - tenant has many employees → technician activities
      - tenant has many invoices (saas, enduser, upstream)
      - tenant has many addons & addon_requests
      - tenant owns WA settings & logs

  cross-module_ui_flows:

    tenant_reminder_flow:
      - tenant unpaid → SaaS invoice overdue → WA reminder → possible auto isolir

    customer_reminder_flow:
      - customer invoice created → WA send  
      - 3-day reminder → WA  
      - overdue → WA + isolir

    outage_flow:
      - admin sets ODC outage  
      - system cascades to ODP + clients  
      - WA notify technicians  
      - technician logs activity at node  
      - outage resolved → propagate back  

    add_on_purchase_flow:
      - tenant opens add-on marketplace  
      - select official addon → instant active  
      - choose custom → approval request → super admin approves → active  
      - billing auto-updates  

    router_management_flow:
      - tenant adds router  
      - system checks limit  
      - sync begins  
      - sessions populate  
      - bandwidth usage integration possible future  

  acceptance_criteria_integration_layer:
    - "All modules share unified tenant context."
    - "Add-on updates instantly affect system limits."
    - "Billing triggers isolir flows correctly."
    - "Outage cascade works with WA + technician integration."
    - "Router, maps, billing, WA, addon all communicate event-driven."
    - "Super admin can override anywhere."
    - "System stable even if one module fails (isolated failures)."

  next_step_instruction:
    - "Step 9 (Integration Layer) selesai."
    - "Jika sudah oke → balas: 'lanjut step 10' untuk Final Architecture (BE/FE integration)."
