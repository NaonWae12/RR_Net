"use client";

import { useEffect, useState } from "react";
import { useMapsStore } from "@/stores/mapsStore";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { PlusIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { useAuthStore } from "@/stores/authStore";
import dynamic from "next/dynamic";

const NetworkMap = dynamic(
  () => import("@/components/maps/NetworkMap").then((m) => m.NetworkMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center h-[600px]">
        <LoadingSpinner size={40} />
      </div>
    ),
  }
);

export default function MapsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { odcs, odps, clientLocations, loading, error, fetchODCs, fetchODPs, fetchClientLocations } = useMapsStore();
  const { showToast } = useNotificationStore();
  
  // Role-based permissions
  const userRole = user?.role;
  const isCollector = userRole === "collector";
  const isTechnician = userRole === "technician";
  const isAdmin = userRole === "admin" || userRole === "owner";
  const canCreate = isAdmin; // Only admin/owner can create nodes
  const canViewODC = !isCollector; // Collector cannot see ODC
  const canViewODP = !isCollector; // Collector cannot see ODP
  
  // Default layer: collector only sees clients, others see all
  const [selectedLayer, setSelectedLayer] = useState<"all" | "odc" | "odp" | "client">(
    isCollector ? "client" : "all"
  );

  useEffect(() => {
    // Only fetch data based on role permissions
    if (canViewODC) {
      fetchODCs();
    }
    if (canViewODP) {
      fetchODPs();
    }
    fetchClientLocations(); // All roles can see client locations (but collector only sees assigned ones)
  }, [fetchODCs, fetchODPs, fetchClientLocations, canViewODC, canViewODP]);

  useEffect(() => {
    if (!error) return;
    showToast({
      title: "Maps error",
      description: error,
      variant: "error",
    });
  }, [error, showToast]);

  const handleNodeClick = (type: "odc" | "odp" | "client", id: string) => {
    if (type === "odc") {
      router.push(`/maps/odcs/${id}`);
    } else if (type === "odp") {
      router.push(`/maps/odps/${id}`);
    } else {
      // We haven't implemented client location detail pages yet.
      // Avoid routing to a missing page; show a friendly message instead.
      showToast({
        title: "Client location",
        description: "Client location detail page is not implemented yet.",
        variant: "info",
      });
    }
  };

  // Filter data based on role and selected layer
  const filteredODCs = (canViewODC && (selectedLayer === "all" || selectedLayer === "odc")) ? (odcs || []) : [];
  const filteredODPs = (canViewODP && (selectedLayer === "all" || selectedLayer === "odp")) ? (odps || []) : [];
  const filteredClients = (selectedLayer === "all" || selectedLayer === "client") ? (clientLocations || []) : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Network Maps</h1>
        {canCreate && (
          <div className="flex space-x-2">
            {canViewODC && (
              <Button variant="outline" onClick={() => router.push("/maps/odcs/create")}>
                <PlusIcon className="h-5 w-5 mr-2" /> Add ODC
              </Button>
            )}
            {canViewODP && (
              <Button variant="outline" onClick={() => router.push("/maps/odps/create")}>
                <PlusIcon className="h-5 w-5 mr-2" /> Add ODP
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push("/maps/clients/create")}>
              <PlusIcon className="h-5 w-5 mr-2" /> Add Client Location
            </Button>
          </div>
        )}
      </div>

      {/* Layer Filter */}
      {!isCollector && (
        <div className="flex space-x-2">
          <Button
            variant={selectedLayer === "all" ? "default" : "outline"}
            onClick={() => setSelectedLayer("all")}
            size="sm"
          >
            All
          </Button>
          {canViewODC && (
            <Button
              variant={selectedLayer === "odc" ? "default" : "outline"}
              onClick={() => setSelectedLayer("odc")}
              size="sm"
            >
              ODCs ({odcs?.length || 0})
            </Button>
          )}
          {canViewODP && (
            <Button
              variant={selectedLayer === "odp" ? "default" : "outline"}
              onClick={() => setSelectedLayer("odp")}
              size="sm"
            >
              ODPs ({odps?.length || 0})
            </Button>
          )}
          <Button
            variant={selectedLayer === "client" ? "default" : "outline"}
            onClick={() => setSelectedLayer("client")}
            size="sm"
          >
            Clients ({clientLocations?.length || 0})
          </Button>
        </div>
      )}

      {/* Map */}
      {loading ? (
        <div className="flex justify-center items-center h-[600px]">
          <LoadingSpinner size={40} />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          {error && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="font-medium">Maps data failed to load.</span> The base map should still render; check API/CSP/network if you see no nodes.
            </div>
          )}
          <NetworkMap
            odcs={filteredODCs}
            odps={filteredODPs}
            clientLocations={filteredClients}
            onNodeClick={handleNodeClick}
            className="h-[600px]"
            showTopologyLines={!isCollector} // Collector cannot see topology lines
            showLegend={true}
            userRole={userRole}
          />
        </div>
      )}
    </div>
  );
}

