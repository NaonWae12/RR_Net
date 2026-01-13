DROP INDEX IF EXISTS idx_topology_links_to;
DROP INDEX IF EXISTS idx_topology_links_from;
DROP INDEX IF EXISTS idx_topology_links_tenant_id;
DROP TABLE IF EXISTS topology_links;

DROP INDEX IF EXISTS idx_outage_events_resolved;
DROP INDEX IF EXISTS idx_outage_events_node;
DROP INDEX IF EXISTS idx_outage_events_tenant_id;
DROP TABLE IF EXISTS outage_events;

DROP INDEX IF EXISTS idx_client_locations_location;
DROP INDEX IF EXISTS idx_client_locations_odp_id;
DROP INDEX IF EXISTS idx_client_locations_client_id;
DROP INDEX IF EXISTS idx_client_locations_tenant_id;
DROP TABLE IF EXISTS client_locations;

DROP INDEX IF EXISTS idx_odps_location;
DROP INDEX IF EXISTS idx_odps_odc_id;
DROP INDEX IF EXISTS idx_odps_tenant_id;
DROP TABLE IF EXISTS odps;

DROP INDEX IF EXISTS idx_odcs_location;
DROP INDEX IF EXISTS idx_odcs_tenant_id;
DROP TABLE IF EXISTS odcs;

