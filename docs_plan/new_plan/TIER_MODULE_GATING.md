# TIER → MODULE / PAGE GATING (MVP)

Dokumen ini mendefinisikan **modul/halaman tenant** apa yang harus muncul/aksesible berdasarkan **plan features** (kolom `plans.features`).

Tujuan:

- Tier Basic: modul yang tidak tersedia **di-hide** (sidebar) dan **di-block** (backend/route guard).
- Tier RBAC: tetap 1-role-per-user (RBAC role berbeda topik); gating ini murni per-tier (feature availability).

Sumber fitur per tier: `BE/migrations/000004_create_plans.up.sql`

## Feature codes per tier (current)

- **basic**: `radius_basic`, `mikrotik_api_basic`, `wa_gateway_basic`, `isolir_manual`, `addon_router`, `addon_user_packs`
- **pro**: `radius_basic`, `mikrotik_api_basic`, `mikrotik_control_panel_advanced`, `wa_gateway`, `isolir_manual`, `isolir_auto`, `rbac_employee`, `rbac_client_reseller`, `payment_gateway`, `api_integration_partial`, `hcm_module`, `payment_reporting_advanced`, `dashboard_pendapatan`, `addon_router`, `addon_user_packs`
- **business**: pro + `odp_maps`, `client_maps`, `custom_login_page`, `custom_isolir_page`, `ai_agent_client_wa`, `api_integration_full`
- **enterprise**: `*` (all)

## Module gating rules (tenant UI)

Catatan: ini mapping “modul UI” → “feature codes minimal”.

| Module           | Route prefix (FE)      | Minimal feature(s)                                     | Notes                                                                                                       |
| ---------------- | ---------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Dashboard        | `/dashboard`           | (core)                                                 | Selalu ada. Beberapa widget bisa gated lagi nanti.                                                          |
| Clients          | `/clients`             | (core)                                                 | Core tenant ops (client CRUD).                                                                              |
| Billing          | `/billing`             | (core)                                                 | Billing dasar tetap ada di Basic (manual). Payment Gateway adalah feature terpisah.                         |
| Network          | `/network`             | `mikrotik_api_basic`                                   | Basic sudah punya. Fitur advanced bisa gated oleh `mikrotik_control_panel_advanced`.                        |
| Maps             | `/maps`                | `odp_maps` OR `client_maps`                            | Business+ saja (Enterprise via `*`).                                                                        |
| Technician       | `/technician`          | `odp_maps` OR `client_maps`                            | MVP: teknisi diasumsikan butuh maps/topology. Bisa dipisah lagi jika nanti ada feature `technician_module`. |
| Reports          | `/reports`             | `payment_reporting_advanced` OR `dashboard_pendapatan` | Pro+ saja (jika halaman diimplement).                                                                       |
| Settings         | `/settings`            | (core)                                                 | Selalu ada. Beberapa setting bisa gated (contoh: custom login page).                                        |
| Employees (RBAC) | `/employees` (planned) | `rbac_employee`                                        | Pro+ saja. (Belum diimplement di fase ini.)                                                                 |

## Expected tenant sidebar per tier (MVP)

### Basic

- Show: Dashboard, Clients, Billing, Network, Settings
- Hide: Maps, Technician, Reports, Employees

### Pro

- Show: Dashboard, Clients, Billing, Network, Reports, Settings
- Hide: Maps, Technician (karena maps tidak ada)
- Note: Employees akan muncul setelah implement employee module (karena `rbac_employee` ada)

### Business

- Show: Dashboard, Clients, Billing, Network, Maps, Technician, Reports, Settings

### Enterprise

- Show: Semua modul (subject to implementation status)
