ROLE CAPABILITY SPEC
role_capability_spec_v1:
  meta:
    version: "1.0"
    purpose: "Menjelaskan kapabilitas masing-masing role dalam sistem RRNet SaaS OS"
    note:
      - "Feature Toggle dapat menambah/mengurangi kemampuan tiap role."
      - "RBAC menentukan batasan UI, API, dan data visibility."
      - "Owner = Admin tapi dengan akses finansial + tenant-level control."

  roles:
    super_admin:
      description: "Pengelola utama platform SaaS. Unlimited access."
      can:
        tenant_management:
          - view_all_tenants
          - create_tenant
          - edit_tenant
          - delete_tenant
          - suspend_tenant
          - unsuspend_tenant
          - impersonate_tenant
        domain_management:
          - manage_domains
          - edit_dns_routing
          - ssl_control
        plan_management:
          - create_plan
          - edit_plan
          - override_plan_per_tenant
        addon_system:
          - create_addon_catalog
          - edit_addon_catalog
          - approve_addon_request
          - reject_addon_request
          - set_custom_addon_pricing
        billing_control:
          - view_saas_billing_all
          - override_invoice
          - manual_invoice
          - change_payment_status
          - adjust_tenant_balance
        wa_gateway:
          - manage_global_provider
          - override_rate_limit
          - view_all_logs
        global_settings:
          - edit_system_configs
          - enable_disable_feature_default
        audit_monitoring:
          - view_system_logs
          - view_admin_activity
          - view_error_logs
          - view_radius_logs
          - view_router_sync_logs
        security_controls:
          - enforce_mfa
          - set_ip_whitelist
          - force_logout

    owner:
      description: "Pemilik tenant. Akses tertinggi di level tenant."
      can:
        tenant_scope:
          - manage_tenant_profile
          - manage_domain
          - manage_subdomain
        user_management:
          - create_admin
          - create_hr
          - create_technician
          - create_finance
          - create_client_user (optional)
          - deactivate_any_user
        billing:
          - view_saas_invoice
          - pay_saas_invoice
          - manage_enduser_billing
          - override_enduser_price
          - refund_enduser_invoice
        network:
          - manage_all_routers
          - run_router_sync
          - manage_radius_config
          - create_hotspot_user
          - create_pppoe_user
        voucher:
          - create_voucher_package
          - generate_voucher_batch
        maps:
          - manage_ODC
          - manage_ODP
          - manage_client_map
          - trigger_outage
          - resolve_outage
        hr:
          - create_employee
          - manage_attendance
          - create_payroll
        wa:
          - manage_wa_settings
          - send_broadcast
        addons:
          - activate_addon
          - request_custom_addon
        reports:
          - full_access_reports

    admin:
      description: "Pengelola tenant. Sama seperti owner minus kontrol finansial ke SaaS."
      can:
        tenant_scope:
          - edit_tenant_info
        user_management:
          - create_hr
          - create_technician
          - create_finance
          - create_client_user
          - manage_roles_except_owner
        billing_enduser:
          - create_enduser_invoice
          - edit_enduser_invoice
          - mark_invoice_paid
          - configure_auto_isolir
          - manage_packages
        network:
          - manage_routers
          - run_router_sync
          - manage_radius
          - manage_pppoe_users
          - manage_hotspot_users
        voucher:
          - manage_packages
          - generate_vouchers
          - export_vouchers
        maps:
          - manage_odc
          - manage_odp
          - manage_client_maps
          - set_outage
          - resolve_outage
        hr:
          - manage_employee
          - approve_leave
          - manage_payroll (optional)
        wa:
          - send_message
          - send_broadcast
        addons:
          - activate_existing_addon
          - request_custom_addon
        reports:
          - view_all_reports_except_saas_billing

    hr:
      description: "Mengelola data karyawan tenant."
      can:
        employees:
          - create_employee
          - edit_employee
          - deactivate_employee
        attendance:
          - input_attendance_manual
          - edit_attendance_record
          - view_attendance_summary
        leave:
          - approve_leave
          - decline_leave
          - view_leave_list
        payroll:
          - create_payroll
          - edit_payroll
          - view_payroll
        tech:
          - view_technician_activity
        restrictions:
          - cannot_manage_routers
          - cannot_manage_billing
          - cannot_manage_maps (except view)

    technician:
      description: "Teknisi lapangan, fokus pada pekerjaan di ODC/ODP/Client."
      can:
        tasks:
          - log_technician_activity
          - upload_activity_photo
          - close_task
        maps:
          - view_odc
          - view_odp
          - view_clients
          - view_outage_status
        network:
          - view_router_status_only
        restrictions:
          - cannot_manage_billing
          - cannot_generate_voucher
          - cannot_modify_network
          - cannot_manage_employee

    finance:
      description: "Staff finance di tenant."
      can:
        enduser_billing:
          - create_invoice
          - edit_invoice
          - manage_invoice_status
          - record_payment
          - export_payment_report
        upstream_billing:
          - input_upstream_invoice
          - mark_upstream_paid
          - view_cost_report
        reports:
          - view_financial_reports
        restrictions:
          - cannot_manage_router
          - cannot_manage_maps
          - cannot_manage_employees

    client:
      description: "End-user dari tenant (optional panel)."
      can:
        billing:
          - view_their_invoice
          - pay_their_invoice
        account:
          - view_profile
          - download_payment_proof
        notifications:
          - receive_outage_info
        restrictions:
          - no access to router/mikrotik
          - cannot see other clients
          - cannot manage anything

  summary_matrix:
    super_admin: "full_access (global)"
    owner: "full_tenant_access + finance + addons"
    admin: "full_operations, no SaaS billing control"
    hr: "employee + attendance + payroll"
    technician: "maps + activity + limited network"
    finance: "billing/enduser + upstream only"
    client: "view/pay own invoice only"
