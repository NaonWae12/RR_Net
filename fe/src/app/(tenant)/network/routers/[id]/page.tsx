"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useNetworkStore } from "@/stores/networkStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { RouterStatusBadge } from "@/components/network";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Server,
  Globe,
  Shield,
  Settings,
  Activity,
  Network,
  Save, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Terminal
} from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";
import { networkService } from "@/lib/api/networkService";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [statusLoading, setStatusLoading] = useState(true);
  const [radiusEnabled, setRadiusEnabled] = useState(false);
  const [radiusSecret, setRadiusSecret] = useState("");
  const [updatingRadius, setUpdatingRadius] = useState(false);
  const [isEditingRadius, setIsEditingRadius] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // 1. Fetch Basic Router Data
  useEffect(() => {
    if (id) {
      fetchRouter(id);
    }
    return () => clearRouter();
  }, [id, fetchRouter, clearRouter]);

  // 2. Fetch Isolir Status Only if Online
  useEffect(() => {
    if (id && routerData && (routerData.status === 'online' || routerData.status === 'provisioning')) {
      setStatusLoading(true);
      networkService.getIsolirStatus(id)
        .then(data => {
          setIsolirStatus(data);
        })
        .catch((err) => {
          console.error('[Isolir] Error fetching status:', err);
          setIsolirStatus(null);
        })
        .finally(() => {
          setStatusLoading(false);
        });
    } else {
      setIsolirStatus(null);
      setStatusLoading(false);
    }
  }, [id, routerData?.status]); // Re-run only when status changes

  // 3. Sync Local States with Router Data
  useEffect(() => {
    if (routerData) {
      setRadiusEnabled(routerData.radius_enabled);
      setRadiusSecret(routerData.radius_secret || "");
    }
  }, [routerData]);

  // 4. Client Side Window Helpers
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentHost(window.location.hostname);
    }
  }, []);

  // 5. Fetch Logs if Router is Online
  useEffect(() => {
    const fetchLogs = async () => {
      if (id && routerData?.status === "online") {
        setLoadingLogs(true);
        try {
          const res = await networkService.getRouterLogs(id);
          setLogs(res.data || []);
        } catch (err) {
          console.error("Failed to fetch logs:", err);
        } finally {
          setLoadingLogs(false);
        }
      }
    };

    fetchLogs();
    // Refresh logs every 30 seconds if page is active
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [id, routerData?.status]);

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

  const handleUpdateRadius = async () => {
    if (!routerData) return;
    setUpdatingRadius(true);
    try {
      await useNetworkStore.getState().updateRouter(routerData.id, {
        radius_enabled: radiusEnabled,
        radius_secret: radiusSecret,
      });
      showToast({
        title: "Radius Updated",
        description: "Radius configuration has been updated successfully.",
        variant: "success",
      });
      setIsEditingRadius(false);
    } catch (err: any) {
      showToast({
        title: "Update Failed",
        description: err?.message || "Failed to update Radius configuration.",
        variant: "error",
      });
    } finally {
      setUpdatingRadius(false);
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

        {/* Card: Management & Radius */}
        <div className="space-y-6">
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
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-400">Credentials hidden for security.</p>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("transition-all duration-300 border-2", radiusEnabled ? "border-indigo-200 bg-indigo-50/10" : "border-slate-100")}>
            <CardHeader className="pb-3 border-b border-slate-100/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded-lg", radiusEnabled ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500")}>
                    <Shield className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-sm font-bold text-slate-900">Radius Server</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {isEditingRadius ? (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs" 
                      onClick={() => {
                        setIsEditingRadius(false);
                        setRadiusEnabled(routerData.radius_enabled);
                        setRadiusSecret(routerData.radius_secret || "");
                      }}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs text-indigo-600 font-bold hover:text-indigo-700 hover:bg-indigo-50"
                      onClick={() => setIsEditingRadius(true)}
                    >
                      Configure
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold text-slate-800">RADIUS Authorization</Label>
                  <p className="text-[10px] text-slate-500">Enable Hotspot & PPPoE auth via central server</p>
                </div>
                <Switch 
                  checked={radiusEnabled} 
                  onCheckedChange={(val) => {
                    setRadiusEnabled(val);
                    if (!isEditingRadius) setIsEditingRadius(true);
                  }} 
                  disabled={updatingRadius}
                  className="bg-slate-300 data-[state=checked]:bg-indigo-600 ring-offset-white focus-visible:ring-indigo-600"
                />
              </div>

              {radiusEnabled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Radius Secret (Password)</Label>
                    <div className="relative flex items-center">
                      <Input
                        type={showSecret ? "text" : "password"}
                        placeholder="Radius shared secret"
                        value={radiusSecret}
                        onChange={(e) => setRadiusSecret(e.target.value)}
                        disabled={!isEditingRadius || updatingRadius}
                        className="font-mono text-sm bg-white pr-10 border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Radius Server IP</Label>
                    <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between group">
                      <div className="flex items-center gap-2">
                         <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                         <span className="font-mono text-xs text-emerald-400 font-bold">10.10.10.1</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">VPN Gateway</span>
                    </div>
                  </div>
                </div>
              )}

              {isEditingRadius && (
                <Button 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100" 
                  onClick={handleUpdateRadius}
                  disabled={updatingRadius}
                >
                  {updatingRadius ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Configuration
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

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
                {statusLoading ? (
                  <div className="flex items-center justify-center p-2 w-full">
                    <LoadingSpinner size={20} />
                  </div>
                ) : !isolirStatus?.firewall_installed ? (
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
                      console.log('[Isolir Debug] 4. Starting installation...');
                      try {
                        const newStatus = await networkService.installIsolirFirewall(routerData.id, ipToUse);
                        console.log('[Isolir Debug] 5. Installation API call succeeded, status:', newStatus);

                        showToast({
                          title: "Firewall Installed",
                          description: "Isolir firewall rules installed successfully",
                          variant: "success"
                        });

                        // 🔥 OPTIMISTIC UPDATE: Use data directly from POST response
                        // This avoids the race condition where MikroTik hasn't indexed the rules yet
                        setIsolirStatus(newStatus);
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

      {/* Live Device Logs Section */}
      <div className="mt-8">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-900 rounded-lg text-white">
                <Terminal className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">Live Device Logs</CardTitle>
                <p className="text-[10px] text-slate-500">Recent system events from MikroTik</p>
              </div>
            </div>
            {loadingLogs && <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />}
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
              {logs.length > 0 ? (
                <div className="divide-y divide-slate-50 font-mono">
                  {logs.map((log, idx) => (
                    <div key={idx} className="p-3 hover:bg-slate-50/80 transition-colors flex gap-4 text-xs italic">
                      <div className="text-slate-400 shrink-0 select-none hidden md:block w-20">
                        {log.time || "N/A"}
                      </div>
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-[4px] font-bold text-[9px] uppercase tracking-wider",
                            log.topics?.includes("error") || log.topics?.includes("critical") ? "bg-red-100 text-red-600 border border-red-200" :
                            log.topics?.includes("warning") ? "bg-amber-100 text-amber-600 border border-amber-200" :
                            log.topics?.includes("hotspot") ? "bg-indigo-100 text-indigo-600 border border-indigo-200" :
                            log.topics?.includes("pppoe") ? "bg-blue-100 text-blue-600 border border-blue-200" :
                            log.topics?.includes("system") ? "bg-emerald-100 text-emerald-600 border border-emerald-200" :
                            "bg-slate-100 text-slate-500 border border-slate-200"
                          )}>
                            {log.topics || "info"}
                          </span>
                          <span className="text-slate-700 leading-relaxed font-semibold break-all md:break-normal">
                            {log.message}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-4">
                  {routerData?.status === 'online' ? (
                    <>
                       <div className="p-4 bg-indigo-50 rounded-full border border-indigo-100">
                         <Activity className="h-8 w-8 text-indigo-500 animate-pulse" />
                       </div>
                       <div className="text-center">
                         <p className="text-sm font-bold text-slate-600">Fetching real-time diagnostic logs...</p>
                         <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Synchronizing with MikroTik API</p>
                       </div>
                    </>
                  ) : (
                    <>
                       <div className="p-4 bg-slate-50 rounded-full border border-slate-100">
                         <Globe className="h-8 w-8 text-slate-300 opacity-50" />
                       </div>
                       <div className="text-center">
                         <p className="text-sm font-bold text-slate-500">Device Offline</p>
                         <p className="text-[10px] text-slate-400 mt-1">Logs are only available when the router is online</p>
                       </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardContent>
          <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center bg-white">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Auto-Refreshing every 30s</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Diagnostic Topic Filter: Enabled (Critical events prioritized)</p>
          </div>
        </Card>
      </div>

    </div>
  );
}

