plan build_1.6
maps_module_force_spec_v1:
  meta:
    module: "maps_module"
    version: "1.0-forced"
    notes:
      - "Force-applied based on user revisions: ODC–ODP–Client with full topology and cascade outage system."
      - "Supports add-on extra_ODP_maps & extra_client_maps."
      - "Technician activity integration included."

  scope:
    included:
      - odc_management
      - odp_management
      - client_mapping
      - topologi_visualization
      - outage_indicator_system
      - technician_activity_overlay
      - add-on limit integration
    excluded_for_v1:
      - auto-routing path generator (future)
      - fiber-length calculator (future)
      - batch-import via .kml (future)

  shared_fields:
    coordinate_definition:
      - lat
      - lon
    icon_states:
      - normal
      - warning
      - outage
      - maintenance
    node_types: ["ODC","ODP","Client"]

  odc_management:
    summary: "ODC acts as the root node of topology; parent for multiple ODPs."
    model:
      table: "odc_nodes"
      fields:
        - id
        - tenant_id
        - name
        - coordinate_lat
        - coordinate_lon
        - address
        - capacity_port
        - used_port
        - status: ["normal","outage","maintenance"]
        - created_at
        - updated_at
    limits:
      - depends_on_addon: extra_ODP_maps affects how many ODPs can hang under ODC
    ui_pages:
      - odc_list
      - odc_create
      - odc_detail
      - odc_edit
    actions:
      - update_status
      - view_connected_odp

  odp_management:
    summary: "ODP is child-node of ODC; parent for multiple client nodes."
    model:
      table: "odp_nodes"
      fields:
        - id
        - tenant_id
        - odc_id
        - name
        - coordinate_lat
        - coordinate_lon
        - address
        - capacity_port
        - used_port
        - status: ["normal","outage","maintenance"]
        - created_at
        - updated_at
    limits:
      - "Max ODP per tenant = base + addon.extra_ODP_maps"
    ui_pages:
      - odp_list
      - odp_create
      - odp_detail
      - odp_edit
    actions:
      - update_status
      - view_connected_clients

  client_mapping:
    summary: "Represents customer physical installation on map."
    model:
      table: "client_nodes"
      fields:
        - id
        - tenant_id
        - odp_id
        - customer_id
        - coordinate_lat
        - coordinate_lon
        - address
        - status: ["normal","outage","warning"]
        - created_at
        - updated_at
    limits:
      - "Max client maps per tenant = base + addon.extra_client_maps"
    ui_pages:
      - client_map
      - client_marker_detail
    actions:
      - update_status
      - jump_to_customer_profile

  topologi_visualization:
    summary: "Draw lines ODC → ODP → Client with real-time state colors."
    behavior:
      - "ODC-to-ODP shown as fiber line"
      - "ODP-to-Client shown as branch line"
      - "Auto-color adjusts based on outage status"
    rendering:
      library: "Leaflet / Mapbox (frontend side)"
    path_states:
      normal: green
      outage: red
      maintenance: yellow
      warning: orange
    map_layers:
      - odc_layer
      - odp_layer
      - customer_layer
      - fiber_links_layer
      - technician_activity_layer (toggle)

  outage_indicator_system:
    summary: "Cascade outage system with auto-propagation ODC → ODP → Client."
    rules:
      odc_outage:
        effect:
          - all child ODP status → outage
          - all child Client status → outage
        reason: "ODC root failure"
      odp_outage:
        effect:
          - child clients only → outage
        parent_effect:
          - does NOT elevate ODC outage (one-way propagation)
      client_outage:
        effect:
          - only that client flagged outage
          - no effect on other clients/ODP/ODC
      maintenance_mode:
        effect:
          - cascades like outage but with state = maintenance
      warning_mode:
        effect:
          - does not cascade
    api_endpoints:
      - PATCH /api/v1/maps/odc/:id/status
      - PATCH /api/v1/maps/odp/:id/status
      - PATCH /api/v1/maps/client/:id/status
    background_jobs:
      - propagate_outage_job
      - resolve_outage_job

  technician_activity_overlay:
    summary: "Integrates technician logs onto the map nodes."
    sources:
      - technician_activity table from HR module
    behavior:
      - "ODC/ODP/Client detail page shows technician logs related to this node"
      - "Map can toggle heatmap of technician recent visits"
    overlay_fields:
      - technician_id
      - description
      - timestamp
      - photo (optional)
    ui:
      - tech_activity_layer_toggle: true
      - node_activity_list: true

  add_on_map_limits:
    extra_ODP_maps:
      effect: "Allows additional ODP nodes beyond base limit"
    extra_client_maps:
      effect: "Allows additional client markers beyond base limit"
    auto_pricing:
      - "SaaS billing includes addon counts every cycle"
    ui:
      - map_addon_usage: "Page showing current ODP/Client count and limit"

  api_endpoints:
    odc:
      - GET /api/v1/maps/odc
      - POST /api/v1/maps/odc
      - GET /api/v1/maps/odc/:id
      - PATCH /api/v1/maps/odc/:id
    odp:
      - GET /api/v1/maps/odp
      - POST /api/v1/maps/odp
      - GET /api/v1/maps/odp/:id
      - PATCH /api/v1/maps/odp/:id
    client:
      - GET /api/v1/maps/client
      - POST /api/v1/maps/client
      - GET /api/v1/maps/client/:id
      - PATCH /api/v1/maps/client/:id
    topology:
      - GET /api/v1/maps/topology/full
      - GET /api/v1/maps/topology/odc/:id
      - GET /api/v1/maps/topology/odp/:id
    outage_control:
      - POST /api/v1/maps/outage/trigger
      - POST /api/v1/maps/outage/resolve

  ui_pages:
    - maps_dashboard
    - maps_topology_view
    - odc_detail_page
    - odp_detail_page
    - client_detail_page
    - technician_overlay_layer
    - addon_usage_page

  acceptance_criteria_maps:
    - "ODC, ODP, Client nodes can be created and visualized."
    - "Topology lines are displayed and update on status change."
    - "Outage cascade works exactly as specified."
    - "Add-on limits enforced correctly."
    - "Technician activity overlays visible and filtered."
    - "Map performance okay for 1k–5k nodes."

  next_step_instruction:
    - "Step 6 (Maps Module) selesai. Silakan REVIEW YAML ini."
    - "Jika sudah oke, balas: 'lanjut step 7'."
