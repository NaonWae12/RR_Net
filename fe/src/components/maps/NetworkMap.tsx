"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Pane } from "react-leaflet";
import L from "leaflet";
import { ODC, ODP, ClientLocation, TopologyLink, NodeStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils/styles";
import { mapsService } from "@/lib/api/mapsService";
import { getOsrmRoute, type LatLng as OsrmLatLng } from "@/lib/maps/osrmRouting";
import { Button } from "@/components/ui/button";
import { Maximize2, Layers, Satellite, Route } from "lucide-react";

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface NetworkMapProps {
  odcs: ODC[];
  odps: ODP[];
  clientLocations: ClientLocation[];
  onNodeClick?: (type: "odc" | "odp" | "client", id: string) => void;
  className?: string;
  showTopologyLines?: boolean;
  showLegend?: boolean;
  userRole?: string; // For role-based visibility
}

type BaseMap = "osm" | "satellite";

function getStatusColor(status: NodeStatus): string {
  switch (status) {
    case "ok":
      return "#10B981"; // green
    case "warning":
      return "#EAB308"; // yellow
    case "full":
      return "#F59E0B"; // orange
    case "outage":
      return "#DC2626"; // red
    default:
      return "#6B7280"; // gray
  }
}

function createCustomIcon(color: string, label: string) {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: bold;
      ">${label}</div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// Leaflet sometimes renders blank when the container size changes (common with layouts + dynamic import).
// This forces a reflow after mount and on window resize.
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);
  return null;
}

// Component to fit map bounds to all markers (only on initial load)
function FitBounds({ odcs, odps, clientLocations }: { odcs: ODC[]; odps: ODP[]; clientLocations: ClientLocation[] }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    // Only fit bounds once when we have data
    if (hasFitted.current || (odcs.length === 0 && odps.length === 0 && clientLocations.length === 0)) {
      return;
    }

    const allMarkers: L.LatLng[] = [];

    odcs.forEach((odc) => {
      allMarkers.push(L.latLng(odc.latitude, odc.longitude));
    });

    odps.forEach((odp) => {
      allMarkers.push(L.latLng(odp.latitude, odp.longitude));
    });

    clientLocations.forEach((client) => {
      allMarkers.push(L.latLng(client.latitude, client.longitude));
    });

    if (allMarkers.length > 0) {
      const bounds = L.latLngBounds(allMarkers);
      map.fitBounds(bounds.pad(0.1));
      hasFitted.current = true;
    }
  }, [map, odcs, odps, clientLocations]);

  return null;
}

// Component for Fit Bounds button (needs to be inside MapContainer to access map instance)
function FitBoundsButton({
  odcs,
  odps,
  clientLocations
}: {
  odcs: ODC[];
  odps: ODP[];
  clientLocations: ClientLocation[]
}) {
  const map = useMap();

  const handleFitBounds = () => {
    const allMarkers: L.LatLng[] = [];

    odcs.forEach((odc) => {
      allMarkers.push(L.latLng(odc.latitude, odc.longitude));
    });

    odps.forEach((odp) => {
      allMarkers.push(L.latLng(odp.latitude, odp.longitude));
    });

    clientLocations.forEach((client) => {
      allMarkers.push(L.latLng(client.latitude, client.longitude));
    });

    if (allMarkers.length > 0) {
      const bounds = L.latLngBounds(allMarkers);
      map.fitBounds(bounds.pad(0.1));
    }
  };

  return (
    <div className="absolute bottom-4 right-4 z-1000">
      <Button
        variant="outline"
        size="sm"
        onClick={handleFitBounds}
        className="bg-white shadow-md"
        title="Fit to all nodes"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function DevMapReadyBadge({ onReady }: { onReady?: () => void }) {
  const map = useMap();
  useEffect(() => {
    // Run once after mount
    map.whenReady(() => {
      onReady?.();
      // Helpful debug info if the map mounts but tiles don't show
      if (process.env.NODE_ENV === "development") {
        const size = map.getSize();
        // eslint-disable-next-line no-console
        console.log("[Maps] Leaflet map ready. size=", size);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function NetworkMap({
  odcs,
  odps,
  clientLocations,
  onNodeClick,
  className,
  showTopologyLines = true,
  showLegend = true,
}: NetworkMapProps) {
  const [center, setCenter] = useState<[number, number]>([-6.2088, 106.8456]); // Jakarta default
  const [zoom, setZoom] = useState(13);
  const [topologyLinks, setTopologyLinks] = useState<TopologyLink[]>([]);
  const [loadingTopology, setLoadingTopology] = useState(false);
  const [internalShowTopologyLines, setInternalShowTopologyLines] = useState(showTopologyLines);
  const [baseMap, setBaseMap] = useState<BaseMap>("osm");
  const [mapReady, setMapReady] = useState(false);
  const [roadRoutesEnabled, setRoadRoutesEnabled] = useState(true);
  const [roadRoutesByLink, setRoadRoutesByLink] = useState<Record<string, OsrmLatLng[]>>({});
  const [roadRoutesFailed, setRoadRoutesFailed] = useState<Record<string, true>>({});

  // Sync internal state with prop
  useEffect(() => {
    setInternalShowTopologyLines(showTopologyLines);
  }, [showTopologyLines]);

  // Fetch topology links
  useEffect(() => {
    if (internalShowTopologyLines) {
      setLoadingTopology(true);
      mapsService
        .getTopology()
        .then((links) => {
          setTopologyLinks(links || []); // Ensure it's always an array
          setLoadingTopology(false);
        })
        .catch((err) => {
          console.error("Failed to fetch topology:", err);
          setTopologyLinks([]); // Reset to empty array on error
          setLoadingTopology(false);
        });
    } else {
      // Reset topology links when disabled
      setTopologyLinks([]);
    }
  }, [internalShowTopologyLines]);

  // Fetch road-following routes from OSRM (best-effort; cached + throttled inside client).
  useEffect(() => {
    if (!internalShowTopologyLines) return;
    if (!roadRoutesEnabled) return;
    if (loadingTopology) return;
    if (!topologyLinks || topologyLinks.length === 0) return;

    let cancelled = false;
    const t = window.setTimeout(async () => {
      for (const link of topologyLinks) {
        if (cancelled) return;
        if (roadRoutesByLink[link.id] || roadRoutesFailed[link.id]) continue;

        const fromCoords = getNodeCoordinates(link.from_type, link.from_id);
        const toCoords = getNodeCoordinates(link.to_type, link.to_id);
        if (!fromCoords || !toCoords) continue;

        try {
          const route = await getOsrmRoute({
            from: fromCoords,
            to: toCoords,
            profile: "driving",
          });
          if (cancelled) return;
          setRoadRoutesByLink((prev) => ({ ...prev, [link.id]: route.geometry }));
        } catch (err) {
          if (cancelled) return;
          // Mark failed so we don't retry constantly in a tight loop.
          setRoadRoutesFailed((prev) => ({ ...prev, [link.id]: true }));
          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.warn("[Maps] OSRM route failed for link", link.id, err);
          }
        }
      }
    }, 400); // debounce to avoid refetch loops while data is settling

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // Intentionally depends on node lists because coords resolution uses them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    internalShowTopologyLines,
    roadRoutesEnabled,
    loadingTopology,
    topologyLinks,
    odcs,
    odps,
    clientLocations,
    roadRoutesByLink,
    roadRoutesFailed,
  ]);

  // Auto-center map based on data
  useEffect(() => {
    if (odcs.length > 0) {
      const firstODC = odcs[0];
      setCenter([firstODC.latitude, firstODC.longitude]);
    } else if (odps.length > 0) {
      const firstODP = odps[0];
      setCenter([firstODP.latitude, firstODP.longitude]);
    } else if (clientLocations.length > 0) {
      const firstClient = clientLocations[0];
      setCenter([firstClient.latitude, firstClient.longitude]);
    }
  }, [odcs, odps, clientLocations]);

  // Helper function to get node coordinates
  const getNodeCoordinates = (nodeType: "odc" | "odp" | "client", nodeId: string): [number, number] | null => {
    if (nodeType === "odc") {
      const node = odcs.find((n) => n.id === nodeId);
      return node ? [node.latitude, node.longitude] : null;
    } else if (nodeType === "odp") {
      const node = odps.find((n) => n.id === nodeId);
      return node ? [node.latitude, node.longitude] : null;
    } else {
      const node = clientLocations.find((n) => n.id === nodeId);
      return node ? [node.latitude, node.longitude] : null;
    }
  };

  // Helper function to get node status
  const getNodeStatus = (nodeType: "odc" | "odp" | "client", nodeId: string): NodeStatus | null => {
    if (nodeType === "odc") {
      const node = odcs.find((n) => n.id === nodeId);
      return node ? node.status : null;
    } else if (nodeType === "odp") {
      const node = odps.find((n) => n.id === nodeId);
      return node ? node.status : null;
    } else {
      const node = clientLocations.find((n) => n.id === nodeId);
      return node ? node.status : null;
    }
  };

  // Render topology lines
  const renderTopologyLines = () => {
    if (!internalShowTopologyLines || loadingTopology) return null;
    if (!topologyLinks || !Array.isArray(topologyLinks) || topologyLinks.length === 0) return null;

    return topologyLinks.map((link) => {
      const fromCoords = getNodeCoordinates(link.from_type, link.from_id);
      const toCoords = getNodeCoordinates(link.to_type, link.to_id);

      if (!fromCoords || !toCoords) return null;

      const roadRoute = roadRoutesEnabled ? roadRoutesByLink[link.id] : undefined;
      const positions = roadRoute && roadRoute.length >= 2 ? roadRoute : ([fromCoords, toCoords] as OsrmLatLng[]);

      // Determine line color and weight based on link type and status
      let color = "#3B82F6"; // Default blue for ODC→ODP
      let weight = roadRoute ? 4 : 3;
      let opacity = 0.7;

      if (link.from_type === "odc" && link.to_type === "odp") {
        color = "#3B82F6"; // Blue
        weight = 3;
      } else if (link.from_type === "odp" && link.to_type === "client") {
        color = "#10B981"; // Green
        weight = 2;
      }

      // Check if either node is in outage
      const fromStatus = getNodeStatus(link.from_type, link.from_id);
      const toStatus = getNodeStatus(link.to_type, link.to_id);
      if (fromStatus === "outage" || toStatus === "outage") {
        color = "#DC2626"; // Red for outage
        opacity = 1.0;
      } else if (fromStatus === "warning" || toStatus === "warning") {
        color = "#EAB308"; // Yellow for warning
      }

      return (
        <Polyline
          key={`link-${link.id}`}
          positions={positions}
          color={color}
          weight={weight}
          opacity={opacity}
        />
      );
    });
  };

  // Calculate summary stats
  const activeOutages = [
    ...odcs.filter((n) => n.status === "outage"),
    ...odps.filter((n) => n.status === "outage"),
    ...clientLocations.filter((n) => n.status === "outage"),
  ].length;

  return (
    <div className={cn("w-full h-full min-h-[500px] rounded-lg overflow-hidden relative", className)}>
      <MapContainer
        center={center}
        zoom={zoom}
        // IMPORTANT:
        // Leaflet needs a *definite* height. If a parent only has min-height (not height),
        // `height: 100%` may resolve to "auto" and Leaflet ends up with 0px height.
        // Provide a minHeight fallback to prevent a blank (0px) map.
        style={{ height: "100%", width: "100%", minHeight: 500 }}
        scrollWheelZoom={true}
        // Allow slightly deeper zoom. Actual useful zoom depends on tile provider coverage.
        minZoom={3}
        maxZoom={19}
        // Explicit className helps ensure sizing/styles apply even if some CSS is missing
        className="h-full w-full"
      >
        {process.env.NODE_ENV === "development" && <DevMapReadyBadge onReady={() => setMapReady(true)} />}
        <InvalidateSize />
        {baseMap === "osm" ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            // OSM typically supports high zoom in most areas
            maxNativeZoom={19}
            maxZoom={20}
          />
        ) : (
          <>
            {/* Satellite imagery (no labels) */}
            <TileLayer
              attribution='Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              // Esri World Imagery often tops out around 18 in many areas.
              // If we set this too high, Esri returns "map data not yet available" tiles.
              maxNativeZoom={18}
              maxZoom={19}
            />
            {/* Labels overlay so satellite view still shows place/road names */}
            <Pane name="labels" style={{ zIndex: 650, pointerEvents: "none" }}>
              <TileLayer
                attribution='Labels &copy; Esri'
                url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                // Match imagery limits to avoid "data not available" at extreme zooms
                maxNativeZoom={18}
                maxZoom={19}
              />
            </Pane>
          </>
        )}

        {/* Fit Bounds Component (auto-fit on initial load) */}
        <FitBounds odcs={odcs} odps={odps} clientLocations={clientLocations} />

        {/* Fit Bounds Button */}
        <FitBoundsButton odcs={odcs} odps={odps} clientLocations={clientLocations} />

        {/* Topology Lines */}
        {renderTopologyLines()}

        {/* ODC Markers */}
        {odcs.map((odc) => (
          <Marker
            key={`odc-${odc.id}`}
            position={[odc.latitude, odc.longitude]}
            icon={createCustomIcon(getStatusColor(odc.status), "O")}
            eventHandlers={{
              click: () => onNodeClick?.("odc", odc.id),
            }}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold">{odc.name}</h3>
                <p className="text-sm text-slate-600">ODC</p>
                <p className="text-xs text-slate-500">Status: {odc.status}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* ODP Markers */}
        {odps.map((odp) => (
          <Marker
            key={`odp-${odp.id}`}
            position={[odp.latitude, odp.longitude]}
            icon={createCustomIcon(getStatusColor(odp.status), "P")}
            eventHandlers={{
              click: () => onNodeClick?.("odp", odp.id),
            }}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold">{odp.name}</h3>
                <p className="text-sm text-slate-600">ODP</p>
                <p className="text-xs text-slate-500">
                  Ports: {odp.used_ports}/{odp.port_count}
                </p>
                <p className="text-xs text-slate-500">Status: {odp.status}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Client Location Markers */}
        {clientLocations.map((client) => (
          <Marker
            key={`client-${client.id}`}
            position={[client.latitude, client.longitude]}
            icon={createCustomIcon(getStatusColor(client.status), "C")}
            eventHandlers={{
              click: () => onNodeClick?.("client", client.id),
            }}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold">Client</h3>
                <p className="text-sm text-slate-600">ID: {client.client_id.slice(0, 8)}...</p>
                <p className="text-xs text-slate-500">Type: {client.connection_type}</p>
                <p className="text-xs text-slate-500">Status: {client.status}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend & Status Panel */}
      {showLegend && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 z-1000 max-w-xs">
          <h3 className="font-semibold text-sm mb-3">Map Legend</h3>

          {/* Status Colors */}
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-600 mb-2">Status Colors:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-4 rounded-full bg-[#10B981] border-2 border-white"></div>
                <span>OK</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-4 rounded-full bg-[#EAB308] border-2 border-white"></div>
                <span>Warning</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-4 rounded-full bg-[#F59E0B] border-2 border-white"></div>
                <span>Full</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-4 rounded-full bg-[#DC2626] border-2 border-white"></div>
                <span>Outage</span>
              </div>
            </div>
          </div>

          {/* Node Types */}
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-600 mb-2">Node Types:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold">O</span>
                <span>ODC</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold">P</span>
                <span>ODP</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold">C</span>
                <span>Client</span>
              </div>
            </div>
          </div>

          {/* Topology Lines */}
          {internalShowTopologyLines && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-600 mb-2">Topology Lines:</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-8 h-0.5 bg-[#3B82F6]"></div>
                  <span>ODC → ODP</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-8 h-0.5 bg-[#10B981]"></div>
                  <span>ODP → Client</span>
                </div>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-slate-600 mb-2">Summary:</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>ODCs:</span>
                <span className="font-semibold">{odcs.length}</span>
              </div>
              <div className="flex justify-between">
                <span>ODPs:</span>
                <span className="font-semibold">{odps.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Clients:</span>
                <span className="font-semibold">{clientLocations.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Outages:</span>
                <span className={cn("font-semibold", activeOutages > 0 ? "text-red-600" : "text-green-600")}>
                  {activeOutages}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Topology Lines Button (outside MapContainer) */}
      <div className="absolute bottom-4 right-16 z-1000 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBaseMap((v) => (v === "osm" ? "satellite" : "osm"))}
          className={cn(
            "bg-white shadow-md",
            baseMap === "satellite" && "bg-slate-100 border-slate-300"
          )}
          title={baseMap === "satellite" ? "Switch to map view" : "Switch to satellite view"}
        >
          <Satellite className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRoadRoutesEnabled((v) => !v)}
          disabled={!internalShowTopologyLines}
          className={cn(
            "bg-white shadow-md",
            roadRoutesEnabled && internalShowTopologyLines && "bg-emerald-50 border-emerald-300",
            !internalShowTopologyLines && "opacity-60"
          )}
          title={
            internalShowTopologyLines
              ? roadRoutesEnabled
                ? "Road routes (beta): ON"
                : "Road routes (beta): OFF"
              : "Enable topology lines first"
          }
        >
          <Route className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setInternalShowTopologyLines(!internalShowTopologyLines)}
          className={cn(
            "bg-white shadow-md",
            internalShowTopologyLines && "bg-blue-50 border-blue-300"
          )}
          title="Toggle topology lines"
        >
          <Layers className="h-4 w-4" />
        </Button>
      </div>

      {/* Dev-only status badge to confirm Leaflet actually mounted */}
      {process.env.NODE_ENV === "development" && (
        <div className="absolute bottom-4 left-4 z-1000 rounded bg-white/90 px-2 py-1 text-xs text-slate-700 shadow">
          Leaflet: {mapReady ? "ready" : "loading"}
        </div>
      )}
    </div>
  );
}

