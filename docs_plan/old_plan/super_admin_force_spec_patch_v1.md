super_admin_force_spec_patch_v1
# ============================================================================
# PATCH: super_admin_force_spec_v1 (Full Super Admin Panel Integration)
# ============================================================================
super_admin_force_spec_patch_v1:
  meta:
    patched_from: 
      - core_system_force_spec_v1
      - addon_engine_force_spec_v1
      - billing_force_spec_v1
      - maps_force_spec_v1
    module: "super_admin_panel"
    timestamp: 2025-12-12

  super_admin_panel:
    overview: >
      Super Admin Panel is the global control center of the entire SaaS platform.
      Handles:
        - Tenant lifecycle
        - Domain & routing
        - Plan & Limits
        - Add-on catalog & approval
        - SaaS billing & invoices
        - System-wide feature toggles
        - Global WA provider config
        - Monitoring & audit (high-level only)
      Super admin does NOT have access to tenant internal logs (collector logs, tenant payment history, etc).

    global_permissions:
      - full_access_to_all_saas_operations
      - cannot_view_internal_tenant_logs (privacy isolation)
      - override_everything_except_internal_activity

    modules:
      tenant_management:
        capabilities:
          - create_tenant
          - edit_tenant_profile
          - suspend_tenant
          - unsuspend_tenant
          - delete_tenant
          - view_tenant_usage_limits
          - impersonate_tenant_admin
        impersonation_rules:
          - "Super admin can impersonate tenant's admin/owner to troubleshoot."
          - "Actions taken during impersonation logged as super_admin_impersonation."
          - "Impersonation session is view-only unless explicitly allowed via override toggle."

      domain_management:
        capabilities:
          - assign_custom_domain_to_tenant
          - manage_subdomain_prefix
          - assign_ssl_certificate
          - enforce_https_routing
        validations:
          - no_duplicate_subdomains
          - domain_dns_validated
          - ssl_auto_provisioning_supported

      plan_management:
        capabilities:
          - create_plan
          - edit_plan
          - delete_plan
          - set_plan_limits (router_limit, odp_limit, client_map_limit, wa_quota)
          - assign_plan_to_tenant
          - override_plan_for_tenant
        plan_fields:
          - name
          - monthly_price
          - base_feature_set
          - base_limits
          - max_addon_allowed

      addon_management:
        catalog_management:
          - create_addon_catalog_item
          - edit_addon_catalog_item
          - remove_addon_catalog_item
        custom_addon_approval:
          - view_custom_addon_requests
          - approve_request (set custom pricing)
          - reject_request (add reason)
        override_tenant_limits:
          - increase_limit
          - decrease_limit (only if tenant usage is below limit)
        billing_integration:
          - generate_addon_invoice
          - auto-activate_addon_when_paid

      billing_saas:
        capabilities:
          - view_all_tenant_invoices
          - override_invoice
          - cancel_invoice
          - mark_invoice_paid
          - adjust_tenant_balance
          - resend_invoice_to_owner
        reports:
          - revenue_summary
          - addon_sales_summary
          - active_tenants_report
          - delinquent_tenants_report

      feature_toggle_center:
        capabilities:
          - enable_feature_globally
          - disable_feature_globally
          - enable_feature_for_tenant
          - disable_feature_for_tenant
        scope:
          - global_features
          - tenant_features
          - experimental_features
        notes:
          - "Tenant feature toggles override global settings if explicitly set."

      wa_provider_control:
        capabilities:
          - set_primary_wa_provider (Fonnte or wwebjs)
          - configure_wwebjs_nodes
          - set_rate_limit
          - monitor_message_errors
        notes:
          - "Super admin cannot read tenant WA message contents, but can see volume & error counts."

      monitoring_center:
        logs_available:
          - system_health_logs
          - api_performance_logs
          - error_logs
          - radius_logs_global
          - router_sync_errors (high-level)
        logs_not_available:
          - tenant_payment_history
          - tenant_collector_logs
          - tenant_internal_activity
        dashboards:
          - active_connections_overview
          - routing_status_overview
          - usage_per_tenant (high-level, aggregated)
          - server_resource_monitor

      security_and_compliance:
        capabilities:
          - enforce_mfa_globally
          - set_global_password_policy
          - tenant_ip_whitelist_policy
          - lock_or_force_logout_user
          - require_domain_verification
          - override_suspicious_activity
        compliance_notes:
          - "Super admin cannot access customer PII (tenant customers)."

    ui_components:
      main_navigation:
        - tenants
        - plans
        - addons
        - billing_saas
        - wa_providers
        - feature_toggles
        - monitoring
        - security
      tenants_ui:
        - tenant_list_page
        - tenant_detail_page
        - tenant_usage_limits_page
        - impersonate_tenant_button
      addons_ui:
        - addon_catalog_manager
        - addon_custom_requests_panel
        - addon_pricing_panel
        - addon_usage_by_tenant
      billing_ui:
        - tenant_invoice_table
        - invoice_detail_dialog
        - override_invoice_modal
      monitoring_ui:
        - health_dashboard
        - api_latency_table
        - service_status_widget
      security_ui:
        - password_policy_manager
        - mfa_toggle_center
        - ip_whitelist_manager

    visibility_rules:
      super_admin_can_see:
        - global_status
        - all_tenant_saas_billing
        - plan_limits
        - addon_usage
        - system_health
      super_admin_cannot_see:
        - collector_logs
        - tenant-level payment history of their customers
        - internal tenant HR records
        - tenant payroll
        - tenant outage internal notes (only high-level outage flag allowed)
      impersonation_visibility:
        - "During impersonation, super admin sees tenant panel as its user sees it."
        - "Actions taken via impersonation must be logged separately."

    apis:
      tenant_admin:
        - POST /superadmin/tenants
        - PATCH /superadmin/tenants/:id
        - POST /superadmin/tenants/:id/suspend
        - POST /superadmin/tenants/:id/unsuspend
      plan_admin:
        - POST /superadmin/plans
        - PATCH /superadmin/plans/:id
        - DELETE /superadmin/plans/:id
        - POST /superadmin/plans/:id/assign/:tenant_id
      addon_admin:
        - POST /superadmin/addons/catalog
        - PATCH /superadmin/addons/catalog/:id
        - GET  /superadmin/addons/requests
        - POST /superadmin/addons/requests/:id/approve
        - POST /superadmin/addons/requests/:id/reject
      billing_admin:
        - GET  /superadmin/billing
        - PATCH /superadmin/billing/invoice/:id
      wa_admin:
        - POST /superadmin/wa/provider
        - PATCH /superadmin/wa/config
      feature_toggle_admin:
        - POST /superadmin/features/global
        - POST /superadmin/features/tenant/:tenant_id

    acceptance_criteria:
      - "Super admin access limited to SaaS-level scope only."
      - "Super admin cannot view tenant-internal logs (privacy isolation)."
      - "Super admin can manage plans, domains, addons, SaaS billing."
      - "Custom addons require approval workflow."
      - "Feature toggles work globally and per-tenant."
      - "Impersonation logged separately."
      - "System monitoring shows global status without exposing tenant private activity."
