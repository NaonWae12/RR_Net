"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useNetworkStore } from "@/stores/networkStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { RouterStatusBadge } from "@/components/network";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Server,
  Globe,
  Shield,
  Settings,
  Activity,
  Network
} from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";
import { networkService } from "@/lib/api/networkService";

export default function RouterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { router: routerData, loading, error, fetchRouter, deleteRouter, clearRouter } = useNetworkStore();
  const { showToast } = useNotificationStore();
  const [currentHost, setCurrentHost] = useState("");
  const [isolirStatus, setIsolirStatus] = useState<{
    firewall_installed: boolean;
    router_id: string;
    router_name: string;
    rule_count: number;
    hotspot_ip?: string;
    has_nat: boolean;
    has_filter: boolean;
  } | null>(null);
  const [installingFirewall, setInstallingFirewall] = useState(false);
  const [uninstallingFirewall, setUninstallingFirewall] = useState(false);
  const [hotspotIP, setHotspotIP] = useState("");
  const [isUpdateMode, setIsUpdateMode] = useState(false);

  useEffect(() => {
    if (id) {
      fetchRouter(id);
      // Fetch isolir status
      networkService.getIsolirStatus(id).then(setIsolirStatus).catch(() => {
        // Ignore errors (router might not support isolir)
      });
    }
    if (typeof window !== "undefined") {
      setCurrentHost(window.location.hostname);
    }
    return () => {
      clearRouter();
    };
  }, [id, fetchRouter, clearRouter]);

  const handleDelete = async () => {
    if (!routerData) return;
    if (!confirm(`Are you sure you want to delete router "${routerData.name}"?`)) {
      return;
    }
    try {
      await deleteRouter(routerData.id);
      showToast({
        title: "Router deleted",
        description: `Router "${routerData.name}" has been successfully deleted.`,
        variant: "success",
      });
      router.push("/network/routers");
    } catch (err: any) {
      showToast({
        title: "Failed to delete router",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading router: {error}
      </div>
    );
  }

  if (!routerData) {
    return (
      <div className="p-6 text-slate-500">
        Router not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Routers
        </Button>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.push(`/network/routers/${routerData.id}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      {/* Main Title & Status */}
      <div className="flex items-center space-x-4">
        <h1 className="text-3xl font-bold text-slate-900">{routerData.name}</h1>
        <RouterStatusBadge status={routerData.status} className="text-lg px-3 py-1" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Card: Device Info */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-900">Device Information</CardTitle>
            <Server className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Type</p>
              <p className="text-lg font-semibold uppercase text-slate-900">{routerData.type}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Description</p>
              <p className="text-slate-900">{routerData.description || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide ">Last Seen</p>
              <p className="text-slate-900">
                {routerData.last_seen ? format(new Date(routerData.last_seen), "PPp") : "Never"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card: Connectivity */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-1 border-indigo-100 bg-indigo-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-900">Connectivity</CardTitle>
            <Network className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Mode</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 uppercase">
                {routerData.connectivity_mode.replace("_", " ")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Internal Host
                </p>
                <p className="font-mono text-slate-700">{routerData.host}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Port</p>
                <p className="font-mono text-slate-700">{routerData.port}</p>
              </div>
            </div>

            {/* Remote Access Highlight */}
            {routerData.remote_access_enabled && routerData.remote_access_port ? (
              <div className="mt-4 p-3 bg-white rounded-lg border border-indigo-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-100 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Globe className="w-3 h-3" /> Remote Winbox Access
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold text-indigo-700 font-mono tracking-tight">
                    {currentHost}:{routerData.remote_access_port}
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Use this address to connect via Winbox from public internet.</p>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200">
                <p className="text-sm text-slate-500 italic">Remote access disabled</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card: Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-900">Management</CardTitle>
            <Settings className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Shield className="w-3 h-3" /> API Port
              </p>
              <p className="font-mono text-slate-900">{routerData.api_port || "Default"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">API Use TLS</p>
              <p className="text-slate-900">{routerData.api_use_tls ? "Yes (SSL)" : "No"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Radius Server</p>
              <p className="text-slate-900">{routerData.radius_enabled ? "Enabled" : "Disabled"}</p>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-400">Credentials hidden for security.</p>
            </div>
          </CardContent>
        </Card>

        {/* Card: Isolir Setup */}
        <Card className="border-orange-100 bg-orange-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">Isolir Setup (Hotspot)</CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Show input only if: not installed yet OR in update mode */}
            {(!isolirStatus?.firewall_installed || isUpdateMode) && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Hotspot IP Address</p>
                <input
                  type="text"
                  placeholder="192.168.88.1"
                  value={hotspotIP || routerData?.host || ""}
                  onChange={(e) => setHotspotIP(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  disabled={installingFirewall || uninstallingFirewall}
                />
                <p className="text-xs text-slate-400 mt-1">
                  {!isolirStatus?.firewall_installed 
                    ? "Gateway IP for HTTP redirect (auto-detected from router host)" 
                    : "Enter new IP to update firewall rules"}
                </p>
              </div>
            )}

            {/* Show status if already installed and not in update mode */}
            {isolirStatus?.firewall_installed && !isUpdateMode && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-xs font-medium text-green-900 mb-1">✓ Firewall Installed</p>
                <p className="text-xs text-green-700">
                  {isolirStatus.rule_count} rules active • Hotspot IP: {isolirStatus.hotspot_ip}
                </p>
              </div>
            )}

            {/* Buttons */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Actions</p>
              <div className="flex gap-2">
                {!isolirStatus?.firewall_installed ? (
                  // First time install
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-100"
                    disabled={installingFirewall}
                    onClick={async () => {
                      if (!routerData) return;
                      const ipToUse = hotspotIP || routerData.host;
                      if (!ipToUse) {
                        showToast({
                          title: "Missing IP",
                          description: "Please enter hotspot IP address",
                          variant: "error"
                        });
                        return;
                      }
                      setInstallingFirewall(true);
                      try {
                        await networkService.installIsolirFirewall(routerData.id, ipToUse);
                        showToast({
                          title: "Firewall Installed",
                          description: "Isolir firewall rules installed successfully",
                          variant: "success"
                        });
                        const status = await networkService.getIsolirStatus(routerData.id);
                        console.log('[Isolir] Status after install:', status);
                        setIsolirStatus(status);
                        setHotspotIP("");
                      } catch (err: any) {
                        showToast({
                          title: "Installation Failed",
                          description: err?.message || "Failed to install firewall",
                          variant: "error"
                        });
                      } finally {
                        setInstallingFirewall(false);
                      }
                    }}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    {installingFirewall ? "Installing..." : "Install Firewall"}
                  </Button>
                ) : isUpdateMode ? (
                  // Update mode: Reinstall or Cancel
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-100"
                      disabled={!hotspotIP || installingFirewall}
                      onClick={async () => {
                        if (!routerData || !hotspotIP) return;
                        setInstallingFirewall(true);
                        try {
                          await networkService.installIsolirFirewall(routerData.id, hotspotIP);
                          showToast({
                            title: "Firewall Updated",
                            description: "Isolir firewall rules reinstalled with new IP",
                            variant: "success"
                          });
                          const status = await networkService.getIsolirStatus(routerData.id);
                          setIsolirStatus(status);
                          setHotspotIP("");
                          setIsUpdateMode(false);
                        } catch (err: any) {
                          showToast({
                            title: "Update Failed",
                            description: err?.message || "Failed to update firewall",
                            variant: "error"
                          });
                        } finally {
                          setInstallingFirewall(false);
                        }
                      }}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      {installingFirewall ? "Reinstalling..." : "Reinstall Firewall"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-slate-200 text-slate-700 hover:bg-slate-100"
                      disabled={installingFirewall}
                      onClick={() => {
                        setIsUpdateMode(false);
                        setHotspotIP("");
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  // Already installed: Update IP or Uninstall
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-100"
                      onClick={() => setIsUpdateMode(true)}
                    >
                      📝 Update IP
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-red-200 text-red-700 hover:bg-red-100"
                      disabled={uninstallingFirewall}
                      onClick={async () => {
                        if (!routerData) return;
                        setUninstallingFirewall(true);
                        try {
                          await networkService.uninstallIsolirFirewall(routerData.id);
                          showToast({
                            title: "Firewall Uninstalled",
                            description: "Isolir firewall rules removed successfully",
                            variant: "success"
                          });
                          const status = await networkService.getIsolirStatus(routerData.id);
                          setIsolirStatus(status);
                        } catch (err: any) {
                          showToast({
                            title: "Uninstall Failed",
                            description: err?.message || "Failed to uninstall firewall",
                            variant: "error"
                          });
                        } finally {
                          setUninstallingFirewall(false);
                        }
                      }}
                    >
                      {uninstallingFirewall ? "Uninstalling..." : "🗑️ Uninstall"}
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {!isolirStatus?.firewall_installed 
                  ? "Creates NAT redirect for HTTP and blocks HTTPS/other traffic" 
                  : isUpdateMode
                  ? "Enter new IP and click Reinstall to update rules"
                  : "NAT redirect + Filter blocks active"}
              </p>
            </div>

            <div className="pt-2 border-t border-orange-100">
              {isolirStatus?.firewall_installed ? (
                <>
                  <p className="text-xs text-green-600 font-medium">✓ Firewall Configured</p>
                  <p className="text-xs text-slate-500 mt-1">Isolir feature is ready to use</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-orange-600 font-medium">⚠️ Setup Required</p>
                  <p className="text-xs text-slate-500 mt-1">Install firewall before using Isolir feature</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-slate-900">
              <Activity className="w-4 h-4 text-slate-900" /> Recent Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-500 text-sm italic">No recent logs available.</p>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

