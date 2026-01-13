plan build_1.3
billing_system_force_spec_v1:
  meta:
    module: "billing_system"
    parts: ["saas_billing", "enduser_billing", "upstream_billing"]
    version: "1.0-forced"
    notes:
      - "Contains all billing logic across SaaS, Tenant, and ISP Upstream flows."
      - "Highly sensitive module — all auto-isolir, invoice policy and payment rules obeyed."
      - "Designed to integrate with WA Gateway and Maps module when needed."

  common_definitions:
    invoice_states: ["draft", "pending", "paid", "overdue", "canceled"]
    payment_methods: ["manual", "bank_transfer", "payment_gateway"]
    reminder_policy:
      default_reminders:
        - days_before_due: 3
        - days_before_due: 1
        - days_after_due: 1
      channels: ["WA", "Email"]
    currency: "IDR"

  saas_billing:
    summary: "Tenant -> membayar SaaS Owner untuk penggunaan platform."
    model:
      table: "saas_invoices"
      fields:
        - id
        - tenant_id
        - amount
        - items (jsonb: plan, addons, overrides)
        - billing_period
        - status
        - due_date
        - paid_at
        - payment_method
        - notes
    plan_pricing:
      basic: 150000
      pro: 400000
      business: 950000
      enterprise: "custom manually set"
    addons_pricing:
      example:
        extra_router: 20000_per_router
        extra_user_pack: 50000_per_100_users
        extra_ODP_maps: 10000_per_odp
        extra_client_maps: 20000_per_500_clients
    billing_cycle:
      generation_day: 1
      grace_period_days: 5
      auto_generate: true
      auto_send_notification: true
    invoice_generation:
      logic:
        - "Every month on generation_day → generate invoice for all tenants"
        - "Include: base plan + addons + overrides + carry-over adjustments"
        - "If enterprise plan → use custom price"
      prorate_policy:
        - "If tenant upgrades mid-cycle → add prorated charge"
        - "If tenant downgrades mid-cycle → apply next cycle"
    payment_flow:
      manual:
        - tenant uploads proof or admin marks as paid
      gateway:
        - auto-confirmed when callback received
      invoice_status_change:
        - paid: when payment confirmed
        - overdue: after due_date + grace_period
    auto_isolir_policy:
      when_overdue: true
      behavior:
        panel_lock: true
        api_lock: "partial"
        mikrotik_shutdown: false
        radius_reject: false (configurable)
      notification:
        channels: ["WA", "Email"]
    super_admin_controls:
      - adjust_price
      - override_limits
      - activate/deactivate tenant
      - manual invoice creation
      - view payment logs
    ui_pages:
      - saas_billing_dashboard
      - tenant_invoice_list
      - invoice_detail_admin
      - override_history
      - addon_usage

  enduser_billing:
    summary: "Tenant menagih pelanggan internet mereka (RT/RW Net)."
    models:
      customer_table:
        fields:
          - id
          - tenant_id
          - name
          - phone
          - address
          - category: ["regular","hotspot","member","custom"]
          - status
          - created_at
      enduser_invoice_table:
        fields:
          - id
          - tenant_id
          - customer_id
          - amount
          - package_id
          - billing_period
          - status
          - due_date
          - paid_at
          - payment_method
          - notes
    package_system:
      table: "internet_packages"
      fields:
        - id
        - tenant_id
        - name
        - speed
        - quota_gb (optional)
        - price
        - description
        - type: ["prepaid","postpaid"]
    billing_rules:
      prepaid:
        - "Paid first → service active"
        - "Voucher-like behavior but tied to customer record"
      postpaid:
        - "Generate invoice monthly"
        - "Auto reminders supported"
      custom_pricing:
        - "Admin can override price per customer"
    invoice_generation:
      auto_generate_day: configurable_per_tenant
      flow:
        - "generate invoice"
        - "send WA/email to customer"
        - "customer pays"
        - "invoice status updates"
    payment_gateway:
      supported: true_if_tenant_enabled
      gateway_options: ["Xendit", "Tripay", "Midtrans", "Fonnte-Pay (future)"]
      return_url: "tenant-subdomain.com/payment/success"
    auto_isolir_enduser:
      enabled_per_tenant: true/false
      behavior:
        - "Suspend UNPAID customers based on Mikrotik firewall or profile drop"
        - "Remove suspension when paid"
        - "Grace period configurable per tenant"
    integration_mikrotik:
      - "For PPPoE: disable secret or change profile"
      - "For Hotspot: move user to isolated profile"
    notifications:
      - invoice_created
      - reminder_before_due
      - overdue_notice
      - payment_confirmed
    ui_pages:
      - customer_list
      - customer_profile
      - package_catalog
      - customer_invoices
      - payment_page
      - auto_isolir_settings
    reports:
      - revenue_monthly
      - unpaid_customers
      - churn_report

  upstream_billing:
    summary: "RT/RW Net membayar ISP utama (sumber internet)."
    provider_model:
      table: "upstream_providers"
      fields:
        - id
        - tenant_id
        - provider_name
        - product_name
        - speed
        - monthly_cost
        - billing_cycle_day
        - notes
    upstream_invoice_model:
      table: "upstream_invoices"
      fields:
        - id
        - tenant_id
        - provider_id
        - amount
        - billing_period
        - due_date
        - status
        - paid_at
        - payment_method
    flow:
      invoice_generation:
        - "Created manually or auto every cycle day"
      reminders:
        - same_policy_as_enduser
      payment:
        - manual: tenant confirms payment
        - no gateway required (optional future)
    reports:
      - monthly_expenses
      - provider_cost_breakdown
      - profit_dashboard: "income (end-user) - expenses (upstream)"
    ui_pages:
      - upstream_provider_list
      - provider_detail
      - upstream_invoice_list
      - upstream_payment_history

  integration_points:
    saas_enduser_dependency:
      - "Tenant must be active for end-user billing to operate."
      - "If tenant isolated from SaaS → end-user billing panel locked."
    billing_wa_dependency:
      - "All modules use WA templates from communication module."
    billing_maps_dependency:
      - "Outage impact may influence compensation (future logic)."
    radius_dependency:
      - "End-user unpaid triggers RADIUS REJECT if auto-isolir enabled."
    router_side_effects:
      - "Suspending customer updates Mikrotik user profile or firewall rules."

  acceptance_criteria_billing_system:
    - "Tenant receives SaaS invoice monthly with complete add-ons."
    - "End-user invoices generated accurately with reminders."
    - "Auto-isolir works without breaking routers."
    - "Upstream billing records expenses and profit."
    - "Payment gateway integration updates invoice status automatically."
    - "WA notifications correctly triggered."
    - "All billing flows tied to tenant plan, overrides, and addons."

  next_step_instruction:
    - "Step 3 (billing_system) selesai. Silakan cek YAML ini."
    - "Jika sudah oke, balas: 'lanjut step 4'."
    - "Step 4 = Communication System (WA Gateway, notifications, templates, queues)."
