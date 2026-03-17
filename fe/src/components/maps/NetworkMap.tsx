"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents, Pane, Tooltip, Circle } from "react-leaflet";
import L from "leaflet";
import { ODC, ODP, ClientLocation, TopologyLink, NodeStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils/styles";
import { mapsService } from "@/lib/api/mapsService";
import { getOsrmRoute, type LatLng as OsrmLatLng } from "@/lib/maps/osrmRouting";
import { Button } from "@/components/ui/button";
import { Maximize2, Layers, Satellite, Route, Expand, Shrink, Search, X, MapPin, Eye, EyeOff, Settings, Zap, Database, Move } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMapsStore, type LinkPreference, type LinkRoutingMode } from "@/stores/mapsStore";
import { useNotificationStore } from "@/stores/notificationStore";

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
  topologyLinks: TopologyLink[];
  onNodeClick?: (type: "odc" | "odp" | "client", id: string) => void;
  onEditClient?: (client: ClientLocation) => void;
  className?: string;
  showTopologyLines?: boolean;
  showLegend?: boolean;
  userRole?: string; // For role-based visibility
  onFullscreenChange?: (isFullscreen: boolean) => void;
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
        width: 28px;
        height: 28px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-weight: 800;
      ">
        <div style="transform: rotate(45deg);">${label}</div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

// Leaflet sometimes renders blank when the container size changes (common with layouts + dynamic import).
// This forces a reflow after mount and on window resize.
function InvalidateSize({ isFullscreen }: { isFullscreen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    // We need a slight timeout to wait for the CSS transition to finish or for the DOM to update its size
    const t = window.setTimeout(() => {
      map.invalidateSize();
    }, 300);

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [map, isFullscreen]);
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

// Right-click context menu handler
function MapRightClickHandler({ onRightClick }: { 
  onRightClick: (lat: number, lng: number, screenX: number, screenY: number) => void 
}) {
  useMapEvents({
    contextmenu(e) {
      e.originalEvent.preventDefault();
      onRightClick(e.latlng.lat, e.latlng.lng, e.containerPoint.x, e.containerPoint.y);
    },
    click() {
      // Clicks on the map dismiss context menu – handled via the parent
    },
  });
  return null;
}

interface ContextMenuState {
  lat: number;
  lng: number;
  screenX: number;
  screenY: number;
}


export function NetworkMap({
  odcs,
  odps,
  clientLocations,
  topologyLinks,
  onNodeClick,
  onEditClient,
  className,
  showTopologyLines = true,
  showLegend = true,
  onFullscreenChange,
}: NetworkMapProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [center, setCenter] = useState<[number, number]>([-6.2088, 106.8456]); // Jakarta default
  const [zoom, setZoom] = useState(13);
  const [internalShowTopologyLines, setInternalShowTopologyLines] = useState(showTopologyLines);
  const [baseMap, setBaseMap] = useState<BaseMap>("osm");
  const [mapReady, setMapReady] = useState(false);
  const [roadRoutesEnabled, setRoadRoutesEnabled] = useState(true);
  const [roadRoutesByLink, setRoadRoutesByLink] = useState<Record<string, OsrmLatLng[]>>({});
  const [roadRoutesFailed, setRoadRoutesFailed] = useState<Record<string, true>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; type: "odc" | "odp" | "client"; lat: number; lng: number }[]>([]);
  const [showInternalLegend, setShowInternalLegend] = useState(showLegend);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{ type: string; id: string } | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<{ type: "odc" | "odp" | "client"; id: string } | null>(null);

  const [draggableNodeId, setDraggableNodeId] = useState<string | null>(null);

  const { linkPreferences, setLinkPreference, updateODC, updateODP, updateClientLocation } = useMapsStore();
  const { showToast } = useNotificationStore();

  const handleNodeRelocate = async (
    type: "odc" | "odp" | "client",
    id: string,
    lat: number,
    lng: number,
    name: string
  ) => {
    try {
      if (type === "odc") {
        await updateODC(id, { latitude: lat, longitude: lng });
      } else if (type === "odp") {
        await updateODP(id, { latitude: lat, longitude: lng });
      } else {
        await updateClientLocation(id, { latitude: lat, longitude: lng });
      }
      showToast({
        title: "Node Relocated",
        description: `${name} moved to (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        title: "Relocation Failed",
        description: err?.message || "Could not save new coordinates.",
        variant: "error",
      });
    } finally {
      setDraggableNodeId(null);
    }
  };

  // Sync legend state with prop
  useEffect(() => {
    setShowInternalLegend(showLegend);
  }, [showLegend]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Sync fullscreen state with parent
  useEffect(() => {
    onFullscreenChange?.(isFullscreen);
  }, [isFullscreen, onFullscreenChange]);

  // Internal map ref to use for panning
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    const element = containerRef.current;
    if (!element) return;

    if (!document.fullscreenElement) {
      if (element.requestFullscreen) {
        element.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          setIsFullscreen(false);
        });
      } else {
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Sync internal state with prop
  useEffect(() => {
    setInternalShowTopologyLines(showTopologyLines);
  }, [showTopologyLines]);

  // Handle Search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: typeof searchResults = [];

    // ODCs
    odcs.forEach(n => {
      if (n.name.toLowerCase().includes(query) || n.id.toLowerCase().includes(query)) {
        results.push({ id: n.id, name: n.name, type: "odc", lat: n.latitude, lng: n.longitude });
      }
    });

    // ODPs
    odps.forEach(n => {
      if (n.name.toLowerCase().includes(query) || n.id.toLowerCase().includes(query)) {
        results.push({ id: n.id, name: n.name, type: "odp", lat: n.latitude, lng: n.longitude });
      }
    });

    // Clients
    clientLocations.forEach(n => {
      const name = n.client_name || `Client ${n.client_id.slice(0, 8)}`;
      if (
        n.client_id.toLowerCase().includes(query) || 
        n.id.toLowerCase().includes(query) ||
        (n.client_name && n.client_name.toLowerCase().includes(query))
      ) {
        results.push({ id: n.id, name, type: "client", lat: n.latitude, lng: n.longitude });
      }
    });

    setSearchResults(results.slice(0, 10));
  }, [searchQuery, odcs, odps, clientLocations]);

  const handleSearchResultClick = (res: typeof searchResults[0]) => {
    if (mapRef.current) {
      mapRef.current.setView([res.lat, res.lng], 18);
    }
    setSearchQuery("");
    setSearchResults([]);
    setFocusedNode({ type: res.type, id: res.id });
    // Removed onNodeClick call to prevent redirect to detail page
  };

  const handleClearFocus = () => {
    setFocusedNode(null);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      showToast({
        title: "Geolocation Error",
        description: "Geolocation is not supported by your browser.",
        variant: "error",
      });
      return;
    }

    if (window.isSecureContext === false) {
      showToast({
        title: "HTTPS Required",
        description: "Browser blocks location access on non-HTTPS sites. Please use HTTPS or localhost.",
        variant: "warning",
      });
      // Continue anyway, but it will likely auto-fail
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 16);
        }
      },
      (error) => {
        console.error("Error getting location:", error);
        
        let errorMsg = "Could not retrieve your location.";
        if (error.code === 1) { // PERMISSION_DENIED
          errorMsg = "Permission denied. Browsers block location on non-HTTPS sites. Use HTTPS or check browser settings.";
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          errorMsg = "Position unavailable. Device signal might be weak.";
        } else if (error.code === 3) { // TIMEOUT
          errorMsg = "Location request timed out.";
        } else if (error.message) {
          errorMsg = error.message;
        }

        showToast({
          title: "Location Access Failed",
          description: errorMsg,
          variant: "error",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };


  // Fetch road-following routes from OSRM (best-effort; cached + throttled inside client).
  useEffect(() => {
    if (!internalShowTopologyLines) return;
    if (!roadRoutesEnabled) return;
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

  // Programmatically open popup for focused node
  useEffect(() => {
    if (!focusedNode || !mapRef.current) return;

    const map = mapRef.current;
    // We need to wait for the next tick to ensure the markers are rendered after filtering
    const timeout = setTimeout(() => {
      map.eachLayer((layer: any) => {
        // Leaflet markers have options that we can use to identify them
        if (layer instanceof L.Marker) {
          const latLng = layer.getLatLng();
          const targetCoords = getNodeCoordinates(focusedNode.type, focusedNode.id);
          
          if (targetCoords && 
              Math.abs(latLng.lat - targetCoords[0]) < 0.0001 && 
              Math.abs(latLng.lng - targetCoords[1]) < 0.0001) {
            layer.openPopup();
          }
        }
      });
    }, 100);

    return () => clearTimeout(timeout);
  }, [focusedNode]);

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

  // Calculate Isolation Sets
  const isolation = (() => {
    if (!focusedNode) return null;

    const visibleNodeIds = new Set<string>([focusedNode.id]);
    const visibleLinkIds = new Set<string>();

    if (focusedNode.type === "client") {
      // Trace up: Client -> ODP -> ODC
      const odpLink = topologyLinks.find(l => l.to_id === focusedNode.id && l.to_type === "client");
      if (odpLink) {
        visibleLinkIds.add(odpLink.id);
        visibleNodeIds.add(odpLink.from_id);
        const odcLink = topologyLinks.find(l => l.to_id === odpLink.from_id && l.to_type === "odp");
        if (odcLink) {
          visibleLinkIds.add(odcLink.id);
          visibleNodeIds.add(odcLink.from_id);
        }
      }
    } else if (focusedNode.type === "odp") {
      // Trace up to ODC
      const odcLink = topologyLinks.find(l => l.to_id === focusedNode.id && l.to_type === "odp");
      if (odcLink) {
        visibleLinkIds.add(odcLink.id);
        visibleNodeIds.add(odcLink.from_id);
      }
      // Trace down to Clients
      topologyLinks.forEach(l => {
        if (l.from_id === focusedNode.id && l.from_type === "odp") {
          visibleLinkIds.add(l.id);
          visibleNodeIds.add(l.to_id);
        }
      });
    } else if (focusedNode.type === "odc") {
      // Trace down to all ODPs and their Clients
      const directOdpLinks = topologyLinks.filter(l => l.from_id === focusedNode.id && l.from_type === "odc");
      directOdpLinks.forEach(odpL => {
        visibleLinkIds.add(odpL.id);
        visibleNodeIds.add(odpL.to_id);
        topologyLinks.forEach(clientL => {
          if (clientL.from_id === odpL.to_id && clientL.from_type === "odp") {
            visibleLinkIds.add(clientL.id);
            visibleNodeIds.add(clientL.to_id);
          }
        });
      });
    }

    return { visibleNodeIds, visibleLinkIds };
  })();

  // Filter topology links based on isolation
  const filteredLinks = isolation 
    ? topologyLinks.filter(l => isolation.visibleLinkIds.has(l.id))
    : topologyLinks;

  // Render topology lines
  const renderTopologyLines = () => {
    if (!internalShowTopologyLines) return null;
    if (!filteredLinks || !Array.isArray(filteredLinks) || filteredLinks.length === 0) return null;

    return filteredLinks.map((link) => {
      const fromCoords = getNodeCoordinates(link.from_type, link.from_id);
      const toCoords = getNodeCoordinates(link.to_type, link.to_id);

      if (!fromCoords || !toCoords) return null;

      const pref = linkPreferences[link.id] || { routingMode: "smart" };
      const isSmart = pref.routingMode === "smart";
      
      const roadRoute = (isSmart && roadRoutesEnabled) ? roadRoutesByLink[link.id] : undefined;
      
      // Smart Connect: Node -> Road -> Node
      // If road route exists, we prepend and append node coords to ensure closure
      const positions = roadRoute && roadRoute.length >= 2 
        ? ([fromCoords, ...roadRoute, toCoords] as OsrmLatLng[])
        : ([fromCoords, toCoords] as OsrmLatLng[]);

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
        <React.Fragment key={`link-group-${link.id}`}>
          {/* Base Cable Line */}
          <Polyline
            positions={positions}
            color={color}
            weight={weight}
            opacity={opacity}
          />
          {/* Running Light Animation Overlay */}
          {(fromStatus !== "outage" && toStatus !== "outage") && (
            <Polyline
              positions={positions}
              pathOptions={{
                color: "white",
                weight: weight * 0.4,
                opacity: 0.9,
                className: cn(
                  "topology-line-flow",
                  link.from_type === "odc" ? "topology-line-odc-odp" : "topology-line-odp-client"
                )
              }}
            />
          )}
        </React.Fragment>
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
    <div 
      ref={containerRef}
      className={cn(
        "w-full min-h-[500px] rounded-lg overflow-hidden relative transition-all duration-300 bg-white", 
        isFullscreen 
          ? "fixed inset-0 z-[9999] rounded-none border-0 shadow-none m-0 p-0 w-screen h-screen" 
          : cn("h-full", className),
        "fullscreen:fixed fullscreen:inset-0 fullscreen:z-[9999] fullscreen:w-screen fullscreen:h-screen fullscreen:m-0 fullscreen:p-0 fullscreen:rounded-none"
      )}
      onClick={() => contextMenu && setContextMenu(null)}
    >
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={zoom}
        // IMPORTANT:
        // Leaflet needs a *definite* height. If a parent only has min-height (not height),
        // `height: 100%` resolve to "auto" and Leaflet ends up with 0px height.
        // Provide a minHeight fallback to prevent a blank (0px) map.
        style={{ height: isFullscreen ? "100vh" : "100%", width: "100%", minHeight: 500 }}
        scrollWheelZoom={true}
        // Allow slightly deeper zoom. Actual useful zoom depends on tile provider coverage.
        minZoom={3}
        maxZoom={19}
        // Explicit className helps ensure sizing/styles apply even if some CSS is missing
        className="h-full w-full"
      >
        {process.env.NODE_ENV === "development" && <DevMapReadyBadge onReady={() => setMapReady(true)} />}
        <InvalidateSize isFullscreen={isFullscreen} />
        <MapRightClickHandler
          onRightClick={(lat, lng, screenX, screenY) => {
            setContextMenu({ lat, lng, screenX, screenY });
          }}
        />
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
        {odcs.filter(o => !isolation || isolation.visibleNodeIds.has(o.id)).map((odc) => {
          const isDragging = draggableNodeId === odc.id;
          return (
            <Marker
              key={`odc-${odc.id}`}
              position={[odc.latitude, odc.longitude]}
              icon={createCustomIcon(isDragging ? "#6366F1" : getStatusColor(odc.status), isDragging ? "↔" : "O")}
              draggable={isDragging}
              eventHandlers={{
                click: () => {
                  if (isDragging) setDraggableNodeId(null);
                  else onNodeClick?.("odc", odc.id);
                },
                dblclick: () => setDraggableNodeId(isDragging ? null : odc.id),
                dragend: (e: any) => {
                  const { lat, lng } = e.target.getLatLng();
                  handleNodeRelocate("odc", odc.id, lat, lng, odc.name);
                },
              }}
            >
              {!isDragging && (
                <Popup minWidth={200} className="custom-popup" offset={[0, -10]}>
                  <div className="p-1 min-w-[180px] bg-white animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-slate-900">{odc.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold uppercase">ODC</span>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Status:</span>
                        <span className={cn("font-medium capitalize", odc.status === "ok" ? "text-green-600" : "text-amber-600")}>{odc.status}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        style={{ fontSize: 11, padding: '6px 8px', background: '#0f172a', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'white', fontWeight: 700 }}
                        onClick={() => onNodeClick?.("odc", odc.id)}
                      >
                        View Details
                      </button>
                      <button
                        style={{ fontSize: 11, padding: '6px 8px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, cursor: 'pointer', color: '#4338ca', fontWeight: 700 }}
                        onClick={() => setDraggableNodeId(odc.id)}
                      >
                        ✦ Move
                      </button>
                    </div>
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}

        {/* ODP Markers */}
        {odps.filter(o => !isolation || isolation.visibleNodeIds.has(o.id)).map((odp) => {
          // Find uplink for line editing
          const uplink = topologyLinks.find(l => l.to_id === odp.id && l.from_type === "odc");
          const isDragging = draggableNodeId === odp.id;

          return (
            <Marker
              key={`odp-${odp.id}`}
              position={[odp.latitude, odp.longitude]}
              icon={createCustomIcon(isDragging ? "#6366F1" : getStatusColor(odp.status), isDragging ? "↔" : "P")}
              draggable={isDragging}
              eventHandlers={{
                dblclick: () => setDraggableNodeId(isDragging ? null : odp.id),
                dragend: (e: any) => {
                  const { lat, lng } = e.target.getLatLng();
                  handleNodeRelocate("odp", odp.id, lat, lng, odp.name);
                },
              }}
            >
              {!isDragging && (
                <Popup minWidth={200} className="custom-popup" offset={[0, -10]}>
                  <div className="p-1 min-w-[180px] bg-white animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-slate-900">{odp.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase">ODP</span>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Status:</span>
                        <span className={cn("font-medium capitalize", odp.status === "ok" ? "text-green-600" : "text-amber-600")}>{odp.status}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Ports:</span>
                        <span className="font-medium">{odp.used_ports}/{odp.port_count}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        style={{ fontSize: 10, padding: '4px 0', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#374151', fontWeight: 600 }}
                        onClick={() => onNodeClick?.("odp", odp.id)}
                      >
                        Details
                      </button>
                      <button
                        style={{ fontSize: 10, padding: '4px 0', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, cursor: 'pointer', color: '#4338ca', fontWeight: 600 }}
                        onClick={() => setDraggableNodeId(odp.id)}
                      >
                        ✦ Move
                      </button>
                      {uplink ? (
                        <button
                          style={{ fontSize: 10, padding: '4px 0', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 }}
                          onClick={() => setEditingLinkId(uplink.id)}
                        >
                          ⚙ Line
                        </button>
                      ) : <span />}
                    </div>
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}

        {/* Client Location Markers */}
        {clientLocations.filter(o => !isolation || isolation.visibleNodeIds.has(o.id)).map((client) => {
          // Find uplink for line editing
          const uplink = topologyLinks.find(l => l.to_id === client.id && l.from_type === "odp");
          const isDragging = draggableNodeId === client.id;
          const clientName = client.client_name || `Client ${client.client_id.slice(0,8)}`;

          return (
            <React.Fragment key={`client-group-${client.id}`}>
              {client.is_reseller && client.reseller_radius > 0 && (
                <Circle
                  center={[client.latitude, client.longitude]}
                  radius={client.reseller_radius}
                  pathOptions={{
                    fillColor: '#6366F1',
                    fillOpacity: 0.1,
                    color: '#6366F1',
                    weight: 1,
                    dashArray: '5, 5'
                  }}
                />
              )}
              <Marker
                key={`client-${client.id}`}
                position={[client.latitude, client.longitude]}
                icon={createCustomIcon(
                  isDragging ? "#6366F1" : getStatusColor(client.status), 
                  isDragging ? "↔" : (client.is_reseller ? "R" : "C")
                )}
                draggable={isDragging}
                eventHandlers={{
                  dblclick: () => setDraggableNodeId(isDragging ? null : client.id),
                  dragend: (e: any) => {
                    const { lat, lng } = e.target.getLatLng();
                    handleNodeRelocate("client", client.id, lat, lng, clientName);
                  },
                }}
              >
                {!isDragging && (
                  <Popup minWidth={200} className="custom-popup" offset={[0, -10]}>
                    <div className="p-1 min-w-[180px] bg-white animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex flex-col">
                          <h3 className="font-bold text-slate-900 line-clamp-1">{clientName}</h3>
                          {client.is_reseller && (
                            <span className="text-[9px] text-indigo-600 font-bold">RESELLER ZONE ({client.reseller_radius}m)</span>
                          )}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold uppercase">CLIENT</span>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Status:</span>
                          <span className={cn("font-medium capitalize", client.status === "ok" ? "text-green-600" : "text-amber-600")}>{client.status}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Type:</span>
                          <span className="font-medium">{client.connection_type}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          style={{ fontSize: 10, padding: '4px 0', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#374151', fontWeight: 600 }}
                          onClick={() => onEditClient?.(client)}
                        >
                          ⚙ Edit
                        </button>
                        <button
                          style={{ fontSize: 10, padding: '4px 0', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, cursor: 'pointer', color: '#4338ca', fontWeight: 600 }}
                          onClick={() => setDraggableNodeId(client.id)}
                        >
                          ✦ Move
                        </button>
                        {uplink ? (
                          <button
                            style={{ fontSize: 10, padding: '4px 0', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 }}
                            onClick={() => setEditingLinkId(uplink.id)}
                          >
                            ⚙ Line
                          </button>
                        ) : <span />}
                      </div>
                    </div>
                  </Popup>
                )}
              </Marker>
            </React.Fragment>
          );
        })}
        {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={L.divIcon({
            className: "user-location-marker",
            html: `
              <div class="relative">
                <div class="absolute -inset-2 bg-blue-500/30 rounded-full animate-ping"></div>
                <div class="relative bg-blue-600 w-4 h-4 rounded-full border-2 border-white shadow-lg"></div>
              </div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })}>
            <Popup>You are here</Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Drag Mode Active Banner */}
      {draggableNodeId && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[2000] animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-indigo-700 text-white px-5 py-2.5 rounded-full shadow-2xl shadow-indigo-500/40 flex items-center gap-3 border border-indigo-500">
            <div className="w-2 h-2 bg-white rounded-full animate-ping" />
            <Move className="h-4 w-4" />
            <span className="text-sm font-bold tracking-wide">Drag Mode Active</span>
            <span className="text-xs text-indigo-300 font-mono hidden sm:block">Drag the node · Drop to save</span>
            <button
              onClick={() => setDraggableNodeId(null)}
              className="ml-2 p-1 hover:bg-indigo-600 rounded-full transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Search Box */}
      <div className="absolute top-4 left-14 z-[1001] flex items-start gap-2">
        <div className="w-64 group">
          <div className="relative">
            <Input
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/95 backdrop-blur-sm shadow-lg border-slate-200 pl-9 pr-8 h-10 focus:bg-white transition-all"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            {(searchQuery || focusedNode) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  if (focusedNode) handleClearFocus();
                }}
                className="absolute right-3 top-3 hover:text-slate-600"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="mt-1 bg-white/95 backdrop-blur-sm rounded-md shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {searchResults.map((res) => (
                <button
                  key={`${res.type}-${res.id}`}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors flex flex-col"
                  onClick={() => handleSearchResultClick(res)}
                >
                  <span className="text-sm font-medium text-slate-800">{res.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    {res.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {focusedNode && (
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg h-10 gap-2 shrink-0 animate-in fade-in slide-in-from-left-2"
            onClick={handleClearFocus}
          >
            <Eye className="h-4 w-4" />
            <span className="text-xs">Show All Nodes</span>
          </Button>
        )}
      </div>

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="absolute z-[2000] animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: Math.min(contextMenu.screenX, (containerRef.current?.clientWidth || 600) - 220),
            top: Math.min(contextMenu.screenY, (containerRef.current?.clientHeight || 400) - 200),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-52">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Physical Infrastructure</p>
                <p className="text-[10px] text-indigo-300 font-mono mt-0.5 truncate">
                  {contextMenu.lat.toFixed(6)}, {contextMenu.lng.toFixed(6)}
                </p>
              </div>
              <button
                onClick={() => setContextMenu(null)}
                className="p-1 hover:bg-indigo-500/50 rounded-lg transition-colors text-indigo-200 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="p-2 space-y-1">
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-indigo-50 hover:text-indigo-700 transition-all group"
                onClick={() => {
                  const params = new URLSearchParams({ lat: contextMenu.lat.toFixed(7), lng: contextMenu.lng.toFixed(7) });
                  window.location.href = `/maps/odcs/create?${params.toString()}`;
                  setContextMenu(null);
                }}
              >
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Database className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Add ODC</p>
                  <p className="text-[10px] text-slate-400">Root distribution cabinet</p>
                </div>
              </button>

              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-emerald-50 hover:text-emerald-700 transition-all group"
                onClick={() => {
                  const params = new URLSearchParams({ lat: contextMenu.lat.toFixed(7), lng: contextMenu.lng.toFixed(7) });
                  window.location.href = `/maps/odps/create?${params.toString()}`;
                  setContextMenu(null);
                }}
              >
                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-200 transition-colors">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Add ODP</p>
                  <p className="text-[10px] text-slate-400">Distribution point node</p>
                </div>
              </button>

              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-violet-50 hover:text-violet-700 transition-all group"
                onClick={() => {
                  const params = new URLSearchParams({ lat: contextMenu.lat.toFixed(7), lng: contextMenu.lng.toFixed(7) });
                  window.location.href = `/maps/clients/create?${params.toString()}`;
                  setContextMenu(null);
                }}
              >
                <div className="p-1.5 bg-violet-100 text-violet-600 rounded-lg group-hover:bg-violet-200 transition-colors">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Add Client</p>
                  <p className="text-[10px] text-slate-400">ONT subscriber endpoint</p>
                </div>
              </button>
            </div>

            {/* Footer Hint */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
              <p className="text-[9px] text-slate-400 text-center">Coordinates auto-filled on selection</p>
            </div>
          </div>
        </div>
      )}

      {/* Line Settings Overlay */}
      {editingLinkId && (
        <div className="absolute bottom-20 left-14 z-[1001] w-72 bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl border border-blue-200 p-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Settings className="h-4 w-4 text-blue-600" /> Line Settings
            </h3>
            <button 
              onClick={() => setEditingLinkId(null)}
              className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Routing Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={linkPreferences[editingLinkId]?.routingMode !== "direct" ? "default" : "outline"}
                  className="h-14 flex-col gap-1 text-[10px]"
                  onClick={() => setLinkPreference(editingLinkId, { routingMode: "smart" })}
                >
                  <Route className="h-4 w-4" />
                  <span>Road Route</span>
                </Button>
                <Button
                  size="sm"
                  variant={linkPreferences[editingLinkId]?.routingMode === "direct" ? "default" : "outline"}
                  className="h-14 flex-col gap-1 text-[10px]"
                  onClick={() => setLinkPreference(editingLinkId, { routingMode: "direct" })}
                >
                  <Zap className="h-4 w-4" />
                  <span>Direct Air</span>
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Settings saved locally</span>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => setEditingLinkId(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Legend & Status Panel */}
      {showInternalLegend && (
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl p-4 z-[1000] max-w-xs border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          <h3 className="font-semibold text-sm mb-3">Map Legend</h3>

          {/* Status Colors */}
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-600 mb-2">Status Colors:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <div className="w-4 h-4 rounded-full bg-[#10B981] border-2 border-white"></div>
                <span>OK</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <div className="w-4 h-4 rounded-full bg-[#EAB308] border-2 border-white"></div>
                <span>Warning</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <div className="w-4 h-4 rounded-full bg-[#F59E0B] border-2 border-white"></div>
                <span>Full</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <div className="w-4 h-4 rounded-full bg-[#DC2626] border-2 border-white"></div>
                <span>Outage</span>
              </div>
            </div>
          </div>

          {/* Node Types */}
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-600 mb-2">Node Types:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="font-mono font-bold w-4 text-center">O</span>
                <span>ODC</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="font-mono font-bold w-4 text-center">P</span>
                <span>ODP</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <span className="font-mono font-bold w-4 text-center">C</span>
                <span>Client</span>
              </div>
            </div>
          </div>

          {/* Topology Lines */}
          {internalShowTopologyLines && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-600 mb-2">Topology Lines:</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <div className="w-8 h-0.5 bg-[#3B82F6]"></div>
                  <span>ODC → ODP</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <div className="w-8 h-0.5 bg-[#10B981]"></div>
                  <span>ODP → Client</span>
                </div>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-slate-600 mb-2">Summary:</p>
            <div className="space-y-1 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>ODCs:</span>
                <span className="font-semibold text-slate-900">{odcs.length}</span>
              </div>
              <div className="flex justify-between">
                <span>ODPs:</span>
                <span className="font-semibold text-slate-900">{odps.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Clients:</span>
                <span className="font-semibold text-slate-900">{clientLocations.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Outages:</span>
                <span className={cn("font-semibold", activeOutages > 0 ? "text-red-600" : "text-emerald-600")}>
                  {activeOutages}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Topology Lines Button (outside MapContainer) */}
      <div className="absolute bottom-4 right-16 z-[1001] flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowInternalLegend(!showInternalLegend)}
          className={cn(
            "bg-white shadow-md transition-colors",
            !showInternalLegend && "text-slate-400"
          )}
          title={showInternalLegend ? "Hide Legend" : "Show Legend"}
        >
          {showInternalLegend ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLocateMe}
          className="bg-white shadow-md text-blue-600 border-blue-100 hover:bg-blue-50"
          title="Locate Me"
        >
          <MapPin className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFullscreen}
          className={cn(
            "bg-white shadow-md transition-colors",
            isFullscreen && "bg-slate-800 text-white hover:bg-slate-700 border-slate-700"
          )}
          title={isFullscreen ? "Exit Full View" : "Full View"}
        >
          {isFullscreen ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
        </Button>
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

