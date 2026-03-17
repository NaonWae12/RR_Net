"use client";

import { useEffect, useState } from "react";
import { useMapsStore } from "@/stores/mapsStore";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { PlusIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { useRole } from "@/lib/hooks/useRole";
import dynamic from "next/dynamic";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { SubmitLocationModal } from "@/components/maps/SubmitLocationModal";
import { technicianService } from "@/lib/api/technicianService";
import { CreateLocationSubmissionRequest, TopologyLink, ClientLocation } from "@/lib/api/types";
import { EditClientLocationModal } from "@/components/maps/EditClientLocationModal";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils/styles";
import { 
  List, 
  Plus, 
  Map as MapIcon, 
  Database, 
  MapPin, 
  Box, 
  CheckCircle2, 
  Eye, 
  Layers as LayersIcon
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const { role, isCollector, isTechnician, isAdmin } = useRole();
  const { 
    odcs, odps, clientLocations, topologyLinks, loading, error, 
    fetchAllMapData 
  } = useMapsStore();
  const { showToast } = useNotificationStore();
  const { isAuthenticated } = useAuth();
  const [showSubmitLocationModal, setShowSubmitLocationModal] = useState(false);
  const [submittingLocation, setSubmittingLocation] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingClientLocation, setEditingClientLocation] = useState<ClientLocation | null>(null);

  // Role-based permissions - using effectiveRole
  const canCreate = isAdmin; // Only admin/owner can create nodes
  const canSubmitLocation = isTechnician; // Technician can submit locations for review
  const canViewODC = !isCollector; // Collector cannot see ODC
  const canViewODP = !isCollector; // Collector cannot see ODP

  // Default layer: collector only sees clients, others see all
  const [selectedLayer, setSelectedLayer] = useState<"all" | "odc" | "odp" | "client">(
    isCollector ? "client" : "all"
  );

  useEffect(() => {
    // Only fetch if authenticated
    if (!isAuthenticated) return;
    
    // Fetch everything efficiently in one go
    fetchAllMapData({ canViewODC, canViewODP });
  }, [fetchAllMapData, canViewODC, canViewODP, isAuthenticated]);

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

  const handleEditClient = (client: ClientLocation) => {
    setEditingClientLocation(client);
  };

  const handleSubmitLocation = async (data: CreateLocationSubmissionRequest) => {
    try {
      setSubmittingLocation(true);
      await technicianService.createLocationSubmission(data);
      showToast({
        title: "Location submitted",
        description: "Your location has been submitted and is waiting for admin review.",
        variant: "success",
      });
      setShowSubmitLocationModal(false);
    } catch (err: any) {
      showToast({
        title: "Failed to submit location",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
      throw err;
    } finally {
      setSubmittingLocation(false);
    }
  };

  // Filter data based on role and selected layer
  const filteredODCs = (canViewODC && (selectedLayer === "all" || selectedLayer === "odc")) ? (odcs || []) : [];
  const filteredODPs = (canViewODP && (selectedLayer === "all" || selectedLayer === "odp")) ? (odps || []) : [];
  const filteredClients = (selectedLayer === "all" || selectedLayer === "client") ? (clientLocations || []) : [];

  return (
    <RoleGuard allowedRoles={["owner", "admin", "technician"]} redirectTo="/dashboard">
      <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
        {!isFullscreen && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <MapIcon className="h-8 w-8 text-indigo-600" />
                Network Maps
              </h1>
              <p className="text-slate-500 text-sm mt-1">Manage and monitor your physical network infrastructure</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 border-slate-200 shadow-sm hover:bg-slate-50">
                    <List className="h-4 w-4 mr-2 text-slate-500" />
                    View Lists
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Resources</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/maps/odcs")} className="cursor-pointer">
                    <Database className="h-4 w-4 mr-2 text-indigo-500" />
                    ODC List
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/maps/odps")} className="cursor-pointer">
                    <Box className="h-4 w-4 mr-2 text-emerald-500" />
                    ODP List
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {canCreate && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" className="h-10 shadow-md bg-indigo-600 hover:bg-indigo-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add New
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Physical Infrastructure</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {canViewODC && (
                      <DropdownMenuItem onClick={() => router.push("/maps/odcs/create")} className="cursor-pointer">
                        <Database className="h-4 w-4 mr-2 text-indigo-500" />
                        Add ODC Node
                      </DropdownMenuItem>
                    )}
                    {canViewODP && (
                      <DropdownMenuItem onClick={() => router.push("/maps/odps/create")} className="cursor-pointer">
                        <Box className="h-4 w-4 mr-2 text-emerald-500" />
                        Add ODP Node
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => router.push("/maps/clients/create")} className="cursor-pointer">
                      <MapPin className="h-4 w-4 mr-2 text-rose-500" />
                      Add Client Location
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {canSubmitLocation && (
                <Button 
                  variant="secondary" 
                  className="h-10 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100"
                  onClick={() => setShowSubmitLocationModal(true)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Submit Location
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Layer Filter & Stats */}
        {!isCollector && !isFullscreen && (
          <div className="flex items-center gap-3 p-1.5 bg-white border border-slate-200 rounded-xl w-fit shadow-sm">
            <button
              onClick={() => setSelectedLayer("all")}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2",
                selectedLayer === "all" 
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <LayersIcon className="h-3.5 w-3.5" />
              All
            </button>
            {canViewODC && (
              <button
                onClick={() => setSelectedLayer("odc")}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2",
                  selectedLayer === "odc" 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                ODCs
                <span className={cn(
                  "ml-1 text-[10px] px-1.5 py-0.5 rounded-full",
                  selectedLayer === "odc" ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {odcs?.length || 0}
                </span>
              </button>
            )}
            {canViewODP && (
              <button
                onClick={() => setSelectedLayer("odp")}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2",
                  selectedLayer === "odp" 
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" 
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                ODPs
                <span className={cn(
                  "ml-1 text-[10px] px-1.5 py-0.5 rounded-full",
                  selectedLayer === "odp" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                )}>
                  {odps?.length || 0}
                </span>
              </button>
            )}
            <button
              onClick={() => setSelectedLayer("client")}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2",
                selectedLayer === "client" 
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-100" 
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <div className="w-2 h-2 rounded-full bg-rose-400" />
              Clients
              <span className={cn(
                "ml-1 text-[10px] px-1.5 py-0.5 rounded-full",
                selectedLayer === "client" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
              )}>
                {clientLocations?.length || 0}
              </span>
            </button>
          </div>
        )}

        {/* Map */}
        {loading ? (
          <div className="flex justify-center items-center h-[600px]">
            <LoadingSpinner size={40} />
          </div>
        ) : (
          <div className={cn(
            "bg-white rounded-lg shadow border border-slate-200 p-4",
            isFullscreen && "p-0 border-0 rounded-none shadow-none bg-transparent"
          )}>
            {error && (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span className="font-medium text-amber-900">Maps data failed to load.</span> <span className="text-amber-800">The base map should still render; check API/CSP/network if you see no nodes.</span>
              </div>
            )}
            <NetworkMap
              odcs={filteredODCs}
              odps={filteredODPs}
              clientLocations={filteredClients}
              topologyLinks={topologyLinks}
              onNodeClick={handleNodeClick}
              onEditClient={handleEditClient}
              className="h-[600px]"
              showTopologyLines={!isCollector} // Collector cannot see topology lines
              showLegend={true}
              userRole={role}
              onFullscreenChange={setIsFullscreen}
            />
          </div>
        )}

        {/* Submit Location Modal */}
        {showSubmitLocationModal && (
          <SubmitLocationModal
            isOpen={showSubmitLocationModal}
            onClose={() => setShowSubmitLocationModal(false)}
            onSubmit={handleSubmitLocation}
            isLoading={submittingLocation}
          />
        )}

        <EditClientLocationModal
          isOpen={!!editingClientLocation}
          onClose={() => setEditingClientLocation(null)}
          clientLocation={editingClientLocation}
          odcs={odcs}
          odps={odps}
        />
      </div>
    </RoleGuard>
  );
}

