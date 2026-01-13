plan build_1.7
addon_engine_force_spec_v1:
  meta:
    module: "addon_engine"
    version: "1.0-forced"
    notes:
      - "Global add-on engine. Applies to Billing, Maps, Network, Tenant Limits."
      - "Addon has: auto-activation, price estimation, approval flows, and flexible pricing."

  concept:
    addon_category_types:
      - resource_addons      # nambah limit, contoh: extra router, extra ODP, extra client
      - feature_addons       # buka fitur tertentu, contoh: advanced monitoring
      - usage_addons         # add-on berdasarkan usage bulanan
      - marketplace_addons   # add-on buatan sistem (contoh: WhatsApp premium)
    selection_modes:
      - direct_activate      # tidak perlu approval
      - require_approval     # jika kategori "lainnya" dipilih user
    billing_modes:
      - recurring_monthly
      - one_time
      - prorated_midcycle

  master_addon_catalog:
    description: "Daftar add-on yang disediakan oleh super admin dan didefinisikan secara global."
    model:
      table: "addon_catalog"
      fields:
        - id
        - key
        - name
        - category   # resource_addons / feature_addons / marketplace_addons
        - description
        - base_price
        - unit_name        # ex: per_router, per_100_users, per_odp
        - unit_amount      # jumlah unit
        - is_variable      # harga bisa berubah? true/false
        - allow_other_option: true/false
        - require_approval_for_others: true/false
        - active
        - created_at
        - updated_at
    examples:
      - key: extra_router
        name: "Extra Router"
        category: resource_addons
        base_price: 20000
        unit_name: "per_router"
        unit_amount: 1
        is_variable: true
        allow_other_option: true
        require_approval_for_others: true

      - key: extra_ODP_maps
        name: "Extra ODP Maps"
        category: resource_addons
        base_price: 10000
        unit_name: "per_odp"
        unit_amount: 1
        is_variable: true

      - key: extra_client_maps
        name: "Extra Client Maps"
        category: resource_addons
        base_price: 20000
        unit_name: "per_500_clients"
        unit_amount: 500
        is_variable: true

      - key: wa_premium
        name: "WhatsApp Premium"
        category: feature_addons
        base_price: 30000
        is_variable: true
        allow_other_option: false

  tenant_addons:
    summary: "Add-on yang telah diaktifkan oleh tenant."
    model:
      table: "tenant_addons"
      fields:
        - id
        - tenant_id
        - addon_catalog_id
        - units_purchased
        - price_per_unit
        - status: ["active","pending_approval","rejected","disabled"]
        - metadata (jsonb)
        - created_at
        - updated_at
    behavior:
      - "Jika units_purchased naik → update prorata tagihan bulan berjalan."
      - "Jika add-on dinonaktifkan → berlaku per next cycle, bukan langsung."

  addon_request_flow:
    user_actions:
      - "User memilih add-on dari halaman Add-on Marketplace"
      - "Jika pilih kategori resmi → langsung aktif"
      - "Jika pilih Others → masuk mode 'require approval'"
    approval_flow:
      - "Super Admin menerima request"
      - "Bisa set harga custom"
      - "Jika disetujui, status → active"
      - "Jika ditolak → rejected"
    request_model:
      table: "addon_requests"
      fields:
        - id
        - tenant_id
        - addon_catalog_id (null if custom-other)
        - request_type: ["existing_addon","other_custom"]
        - requested_units
        - description
        - status: ["pending","approved","rejected"]
        - admin_notes
        - created_at
        - updated_at

  tenant_limit_integration:
    - extra_router → increases tenant.limits.max_routers
    - extra_user_pack → increases tenant.limits.max_users
    - extra_ODP_maps → increases maps_module.odp_limits
    - extra_client_maps → increases maps_module.client_limits
    - future: extra_voucher, extra_radius_bandwidth, wa_premium_rate
    logic:
      - "apply limits immediately after activation"
      - "request in pending_approval state does NOT change limits"
      - "limits merged: base_plan_limit + addon_units"

  billing_integration:
    summary: "Add-ons masuk ke SaaS billing bulanan."
    calculation:
      monthly_amount = units_purchased * price_per_unit
    prorate_rules:
      - "Jika aktivasi tanggal 15 → charge prorate setengah bulan"
      - "Jika disable → efektif next cycle"
    invoice_item_format:
      - "Add-on: {name} x {units} = {amount}"
    addon_mid_cycle_events:
      - "on upgrade units → add prorated fee"
      - "on variable price change by admin → next cycle price updates"
    free_trial_support:
      - optional: super admin dapat berikan free X days

  UI_Marketplace:
    pages:
      - addon_marketplace
      - addon_detail
      - addon_price_calculator
      - addon_request_custom
      - addon_current_usage
    marketplace_features:
      - show active plan
      - show base limits vs addon limits
      - show real-time price calculation
      - list add-ons with toggle ON/OFF
      - show "Other Option" field untuk custom add-on
      - show estimated monthly cost
      - show approval flow for requests

  api_endpoints:
    - GET /api/v1/addons/catalog
    - GET /api/v1/addons/tenant
    - POST /api/v1/addons/activate
    - POST /api/v1/addons/request-other
    - PATCH /api/v1/addons/update-units
    - GET /api/v1/addons/requests
    - PATCH /api/v1/admin/addons/requests/:id/approve
    - PATCH /api/v1/admin/addons/requests/:id/reject

  super_admin_panel_integration:
    actions:
      - create_addon_catalog
      - edit_addon_price_global
      - approve_custom_request
      - reject_request
      - set_variable_price_per_tenant
      - view_addon_usage
      - view_addon_billing_summary

  business_rules:
    - "All add-ons affect billing automatically."
    - "Addon for next cycles cannot be cancelled mid-cycle unless super admin override."
    - "Custom add-on must always require approval."
    - "Tenant cannot remove add-on if used beyond limits (ex: remove extra ODP but tenant ODP > base limit)."

  acceptance_criteria_addon_engine:
    - "Tenant can activate add-on instantly from UI."
    - "Custom add-on flows require admin approval."
    - "Price estimation works correctly live."
    - "Add-on applied → tenant limits update."
    - "Add-ons appear in SaaS monthly billing."
    - "Disable is only effective next billing cycle."
    - "Maps add-on and Router add-on fully integrated with limits."

  next_step_instruction:
    - "Step 7 (Add-on Engine) selesai."
    - "Jika sudah oke, balas: 'lanjut step 8' untuk Super Admin Panel."
