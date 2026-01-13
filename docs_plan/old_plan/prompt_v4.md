prompt v4
rrnet_saas_force_spec:
meta:
version: 1.0.0
date_generated: 2025-12-12
mode: "FULL MERGE — production ready"
purpose: >
Blueprint lengkap untuk development SaaS RRNet menggunakan Cursor.
Meliputi: Backend, Frontend, Modules, RBAC, Billing, Maps, Add-ons,
Integrations, WA, Mikrotik, Radius, Collector, Technician, Super Admin.

# =========================================================

# 1. ARCHITECTURE SPEC

# =========================================================

architecture:
backend:
language: golang
style: modular-block-architecture
principles: - setiap container/fitur harus menjadi module sendiri - service kecil, terorganisir, mudah dirawat - gunakan event bus (Redis/Asynq) untuk async flow - gunakan domain layer yang jelas - gunakan repository pattern
frontend:
framework: nextjs
style: MVVM
requirements: - setiap container halaman dipisah ke file module - setiap module punya ViewModel - komponen harus reusable semaksimal mungkin - ulangi UI layout jangan lebih dari 1x - konsisten struktur folder: pages / screens / components / viewmodels

# =========================================================

# 2. RBAC — ROLE PERMISSION SYSTEM

# =========================================================

roles:
super_admin:
scope: global_saas
can: - manage_plans - manage_addons - manage_domains - manage_tenant - manage_feature_toggles - manage_saas_billing - impersonate_tenant_admin
cannot: - view_tenant_internal_logs - view_collector_logs - view_internal_payment_history_of_tenant - view_customer_PII
owner:
scope: tenant
can: - full_access_all_modules - manage_admin - manage_finance - manage_hr - manage_collector - manage_technician - purchase_addon - request_custom_addon
cannot: []
admin:
scope: tenant
can: - manage_packages - manage_clients - manage_routers - manage_radius - manage_billing_clients - manage_finance - create_employee_roles (HR/Finance/Collector/Technician) - create_client_roles - purchase_addons - request_custom_addons - create_owner2_3 (for investor mode)
cannot: - approve_custom_addon - change_saas_plan
hr:
can: - manage_employee_data - manage_attendance_basic
cannot: - see_finance
finance:
can: - manage_invoice_deposit (phase_3 collector flow) - manage_saas_payment - see_finance_reports
cannot: - edit_radius - edit_router
technician:
can: - see_full_topology - update_outage_status - upload_activity_photo - complete_tasks
cannot: - edit_billing
collector:
can: - see_assigned_clients_only - mark_visit_success - confirm_setoran_phase1 - see_nama_alamat_koordinat_client
cannot: - see_odp - see_odc - see_full_map

# =========================================================

# 3. TENANT LIFECYCLE & DOMAIN ROUTING

# =========================================================

tenant_system:
signup:
generates: - owner_default_user - admin_default_user
default_credentials_must_be_changed: true
send_wa_credentials: true
domains:
support: - custom_domain - subdomain
ssl: - auto_provision

# =========================================================

# 4. FEATURE TOGGLES

# =========================================================

feature_toggles:
scope: - global - per_tenant
behavior: - overridden_per_tenant_allowed
categories: - basic - pro - enterprise - addon

# =========================================================

# 5. NETWORK MODULES (MIKROTIK, RADIUS, VOUCHER)

# =========================================================

network:
mikrotik:
support: - hotspot - pppoe
api: - login - fetch_users - create_user - disable_user - sync_status
radius:
functions: - auth - accounting - integration_with_billing
voucher:
behavior: "mirip mikhmon"
features: - bulk_generate - profile_management - expiration_rules

# =========================================================

# 6. BILLING (SAAS + END USER + UPSTREAM + CASH FLOW)

# =========================================================

billing:
saas_billing:
triggers: - plan - addons
invoices: - auto_generate
end_user_billing:
components: - packages (regular/hotspot) - recurring_invoice - auto_isolir - payment_gateway - payment_history_with_reset:
reset_schedule:
basic: 1_year
pro: 5_years
configurable_by_super_admin: true
upstream_billing:
purpose: "billing RT/RW ke ISP sumber"
cash_billing_with_collector:
phases: - phase1_visit_success - phase2_setoran_collector - phase3_finance_confirm_deposit
invoice_status_flow: - unpaid - waiting_setoran - waiting_finance_deposit - paid

# =========================================================

# 7. ISOLIR SYSTEM

# =========================================================

isolir:
triggers: - unpaid_invoice - overdue_invoice
behavior: - disable_router_user - set_radius_profile_isolated
unisolir:
triggers: - payment_gateway_success - finance_phase3_complete

# =========================================================

# 8. MAPS + OUTAGE PROPAGATION (ODC → ODP → CLIENT)

# =========================================================

maps:
hierarchy: - odc - odp - client
topology: - auto_visual_linking
outage_rules:
odc_outage: propagate_to_all
odp_outage: propagate_to_clients
client_outage: local_only
ui_indicator:
odc: red
odp: red_soft
client: orange
normal: green
degraded: yellow

# =========================================================

# 9. ADD-ON ENGINE

# =========================================================

addons:
builtin: - extra_ODP_maps - extra_client_maps - extra_router_limit - extra_collector_quota - extra_WA_quota
custom_request:
approval: super_admin_required
subscription_behavior: - update_limits_instantly - generate_billing_event

# =========================================================

# 10. COLLECTOR SYSTEM (CASH)

# =========================================================

collector_system:
visibility: - assigned_clients_only - see_location - see_phone
3_phase_flow: - phase1_kolektor_tagih_berhasil - phase2_setoran_ke_admin - phase3_finance_confirm_ke_rekening
ui: - progress_colors_per_phase - list_of_unvisited_clients - list_of_visited_clients

# =========================================================

# 11. TECHNICIAN SYSTEM

# =========================================================

technician:
tasks: - auto_generated_on_outage
can: - update_outage_status - upload_photo
map_integration: - full_access_to_topology

# =========================================================

# 12. WA GATEWAY

# =========================================================

wa_gateway:
supported_providers: - fonnte - wwebjs
usage: - send_credentials - send_billing_info - send_payment_success - send_isolir_warning - send_unisolir_notice - send_outage_notice

# =========================================================

# 13. SUPER ADMIN PANEL

# =========================================================

super_admin:
can: - manage_tenants - manage_domains - manage_ssl - manage_plans - manage_addon_catalog - manage_feature_toggle_global - see_saas_billing - impersonate_admin
cannot: - see_tenant_internal_logs - see_collector_logs - see_end_user_payment_history - see_customer_private_info

# =========================================================

# 14. INTEGRATION LAYER (EVENT BUS)

# =========================================================

integration:
event_bus:
topics: - billing_events - collector_events - outage_events - addon_events - technician_events
billing_to_isolir_flow: enabled
payment_to_unisolir_flow: enabled
addon_to_limits_flow: enabled
outage_to_technician_flow: enabled
collector_to_billing_flow: enabled

# =========================================================

# 15. ACCEPTANCE CRITERIA SYSTEM-WIDE

# =========================================================

acceptance_criteria: - semua role berjalan sesuai RBAC - billing, isolir, wa terhubung otomatis - maps outage propagate benar - addon update limit real-time - collector flow 3-phase berjalan - super admin tidak melihat data privat tenant - frontend MVVM konsisten - backend modular-block konsisten - semua API terstruktur bersih
