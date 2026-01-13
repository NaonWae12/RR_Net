plan build_1.8
super_admin_panel_force_spec_v1:
  meta:
    module: "super_admin_panel"
    version: "1.0-forced"
    notes:
      - "Full system-wide root access. Manages tenants, billing, plans, add-ons, domains, logs, WA provider, outages, roles, templates, and global settings."
      - "Only users with super_admin flag = true can access."

  super_admin_roles:
    model:
      fields:
        - id
        - name: "super_admin"
        - permissions: "unrestricted"
    abilities:
      - "view/manage all tenants"
      - "override pricing, plans, limits"
      - "approve addon requests"
      - "manage global templates"
      - "manage WA provider settings"
      - "manage system domains and routing"
      - "view system logs, billing logs, audit, and error reports"
      - "disable/enable tenant"
      - "update global settings"
      - "access all monitoring dashboards"

  dashboard:
    widgets:
      - tenant_count_total
      - active_tenants
      - overdue_tenants
      - revenue_monthly
      - addon_usage_summary
      - wa_usage_global
      - system_health_status
    charts:
      - monthly_revenue_chart
      - tenant_growth_chart
      - addon_sales_chart
      - message_delivery_success_rate

  tenant_management:
    pages:
      - tenant_list
      - tenant_detail
      - tenant_edit
    detail_sections:
      - basic_info
      - plan_and_addons
      - domain_settings
      - usage_metrics
      - payment_history
      - logs
    admin_actions:
      - switch_plan
      - override_price
      - set_custom_limit
      - enable_or_disable_tenant
      - regenerate_invoice
      - force_unlock_panel
      - reset_tenant_isolation_state
      - impersonate_tenant (for troubleshooting)
    isolation_controls:
      - "Manually isolate tenant"
      - "Manually un-isolate tenant"
      - "Override grace period"

  domain_and_routing_management:
    domain_model:
      table: "tenant_domains"
      fields:
        - id
        - tenant_id
        - domain_name
        - type: ["root","subdomain"]
        - ssl_certificate (optional)
        - active
    capabilities:
      - add_domain
      - remove_domain
      - force_ssl_renewal
      - validate_dns
    routing:
      - "Admin can assign subdomain per tenant (tenant.example.com)"
      - "Custom domain mapping supported"
      - "Admin can reset routing cache"

  plan_and_pricing_management:
    plan_catalog:
      editable_fields:
        - plan_name
        - base_price
        - base_limit_router
        - base_limit_user
        - base_limit_odp
        - base_limit_client
        - enable_features
      actions:
        - create_plan
        - edit_plan
        - deactivate_plan
        - preview_plan_effect
    pricing_manager:
      - global_price_update
      - override_for_specific_tenant
      - variable_price_rules (e.g., dynamic per region)
      - custom_plan_creation (utility for enterprise)

  addon_management:
    catalog_actions:
      - create_addon
      - edit_addon
      - change_base_price
      - change_unit_amount
      - deactivate_addon
    request_approval_actions:
      - approve_request
      - reject_request
      - set_custom_price
      - add_internal_note
    reports:
      - addon_sales_report
      - addon_usage_report
      - tenant_addon_distribution

  billing_super_admin:
    billing_controls:
      - create_manual_invoice
      - edit_invoice_amount
      - void_invoice
      - resend_invoice
      - override_due_date
      - override_payment_status
      - adjust_balance
    global_settings:
      - invoice_grace_period_default
      - tax_percentage_global
      - auto_invoice_day_default
    reports:
      - saas_revenue_monthly
      - tenant_revenue_breakdown
      - overdue_tenants_list
      - billing_health_check
    payment_logs:
      stored_tables:
        - payment_gateway_logs
        - invoice_history
        - billing_adjustments

  wa_provider_management:
    provider_list:
      - fonnte_free_tier
      - wwebjs_local
    actions:
      - add_provider
      - edit_provider
      - rotate_api_key
      - set_default_provider
      - update_provider_rate_limit
      - health_check_provider
    monitoring:
      - wa_delivery_rate_global
      - wa_error_rate_global
      - tenant_wa_usage_list

  system_templates:
    manages:
      - WA templates
      - Email templates
      - Notification templates
      - Invoice templates
    actions:
      - create_template
      - edit_template
      - delete_template
      - clone_template_to_tenant
      - reset_default_template

  logs_and_audit:
    log_tables:
      - system_logs
      - wa_logs (global view)
      - error_logs
      - router_sync_logs
      - radius_logs
      - login_logs
      - admin_activity_logs
    capabilities:
      - filter_by_tenant
      - export_logs
      - view_raw_json
      - auto-rotate retention
    audit_trails:
      actions_tracked:
        - super_admin_changes
        - pricing_updates
        - domain_changes
        - billing_overrides
        - addon_approvals
        - impersonation_usage

  monitoring_and_health:
    system_health_dashboard:
      metrics:
        - cpu
        - memory
        - db_latency
        - redis_latency
        - background_job_queues
      alerts:
        - high_error_rate
        - delayed_jobs
        - provider_down
    dependencies_check:
      - mikrotik_connectivity_global
      - radius_server_status
      - wa_provider_gateway_status
      - domain_dns_health

  security_controls:
    features:
      - mfa_for_super_admin
      - admin_ip_whitelist
      - session_timeout
      - role_restrictions_for_staff
    impersonation_rules:
      - allowed_only_for_super_admin
      - auto-log every impersonation
      - automatic revert after timeout

  ui_pages:
    - admin_dashboard
    - tenant_management
    - domain_manager
    - plan_manager
    - addon_manager
    - billing_manager
    - wa_provider_manager
    - template_manager
    - system_logs
    - system_monitoring
    - security_settings

  acceptance_criteria_super_admin_panel:
    - "Super admin dapat kontrol penuh seluruh tenant & billing."
    - "Domain routing dan SSL bisa diatur."
    - "Add-on approvals jalan."
    - "Monitoring dan logs terpusat."
    - "Billing override berfungsi dengan jejak audit."
    - "WA provider bisa dikelola dari panel pusat."
    - "Semua aksi tercatat di audit log."

  next_step_instruction:
    - "Step 8 selesai."
    - "Jika sudah oke → balas: 'lanjut step 9' untuk Integrations."
