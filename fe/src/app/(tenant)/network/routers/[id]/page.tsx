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
  Terminal,
  AlertCircle,
  Info,
  ChevronRight,
} from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";
import { networkService } from "@/lib/api/networkService";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

export default function RouterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { router: routerData, loading, error, fetchRouter, deleteRouter, clearRouter, getDeletePreview } = useNetworkStore();
  const { showToast } = useNotificationStore();
  const [currentHost, setCurrentHost] = useState("");
  const [isolirStatus, setIsolirStatus] = useState<{
    firewall_installed: boolean;
    rule_count: number;
    has_nat: boolean;
    has_filter: boolean;
  } | null>(null);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePreview, setDeletePreview] = useState<{
    preview: {
      pppoe_count: number;
      voucher_count: number;
      pppoe_usernames: string[];
      voucher_codes: string[];
    };
    status: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cleanupRemote, setCleanupRemote] = useState(false);
  const [installingFirewall, setInstallingFirewall] = useState(false);
  const [uninstallingFirewall, setUninstallingFirewall] = useState(false);
  const [hotspotIP, setHotspotIP] = useState("");
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [idleTimeout, setIdleTimeout] = useState(48);
  const [interimInterval, setInterimInterval] = useState(60);
  const [updatingRadius, setUpdatingRadius] = useState(false);
  const [isEditingRadius, setIsEditingRadius] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  
  // Remote User Setup State
  const [remoteUsername, setRemoteUsername] = useState("");
  const [remotePassword, setRemotePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSettingUpRemoteUser, setIsSettingUpRemoteUser] = useState(false);
  const [showRemoteUserDialog, setShowRemoteUserDialog] = useState(false);

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
      setIdleTimeout(routerData.idle_timeout || 48);
      setInterimInterval(routerData.interim_interval || 60);
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
    // Refresh logs every 60 seconds if page is active to prevent overloading Mikrotik API
    const interval = setInterval(fetchLogs, 60000);
    return () => clearInterval(interval);
  }, [id, routerData?.status]);

  const openDeleteDialog = async () => {
    if (!routerData) return;
    setIsDeleteDialogOpen(true);
    setPreviewLoading(true);
    setDeletePreview(null);
    setCleanupRemote(false);
    try {
      const data = await getDeletePreview(routerData.id);
      setDeletePreview(data);
      if (data.status === 'online') {
        setCleanupRemote(true);
      }
    } catch (err) {
      console.error("Failed to fetch delete preview", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!routerData) return;
    setIsDeleting(true);
    try {
      await deleteRouter(routerData.id, cleanupRemote);
      showToast({
        title: "Router deleted",
        description: `Router "${routerData.name}" has been successfully deleted.`,
        variant: "success",
      });
      setIsDeleteDialogOpen(false);
      router.push("/network");
    } catch (err: any) {
      showToast({
        title: "Termination Failed",
        description: err?.message || "An unexpected error occurred during removal.",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };



  const handleUpdateRadius = async () => {
    if (!routerData) return;
    setUpdatingRadius(true);
    try {
      await useNetworkStore.getState().updateRouter(routerData.id, {
        idle_timeout: Number(idleTimeout),
        interim_interval: Number(interimInterval),
      });
      showToast({
        title: "Radius Controls Updated",
        description: "Idle Timeout and Interim Interval updated successfully.",
        variant: "success",
      });
      setIsEditingRadius(false);
    } catch (err: any) {
      showToast({
        title: "Update Failed",
        description: err?.message || "Failed to update Radius controls.",
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
    <>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-4">
          <button 
            onClick={() => router.back()}
            className="group flex items-center text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-3 w-3 mr-2 transition-transform group-hover:-translate-x-1" />
            Back to Infrastructure
          </button>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-2xl shadow-xl shadow-slate-200">
               <Server className="h-8 w-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">{routerData.name}</h1>
                <RouterStatusBadge status={routerData.status} className="text-xs px-2 py-0.5 rounded-full font-bold uppercase" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                MikroTik {routerData.type} • ID: <span className="font-mono">{routerData.id.slice(0,8)}...</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="h-10 px-4 border-slate-200 text-slate-600 font-bold text-xs uppercase hover:bg-slate-50"
            onClick={() => fetchRouter(id)}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Sync
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="h-10 px-4 border-slate-200 text-slate-600 font-bold text-xs uppercase hover:bg-slate-50"
            onClick={() => router.push(`/network/routers/${routerData.id}/edit`)}
          >
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Edit
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            className="h-10 px-4 font-bold text-xs uppercase shadow-lg shadow-red-100"
            onClick={openDeleteDialog}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Terminate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Card: Device Info */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Device Information</CardTitle>
            <Server className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">System Type</p>
                <p className="text-lg font-bold text-slate-900">{routerData.type}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Last Check-in</p>
                <p className="text-sm font-semibold text-slate-700">
                  {routerData.last_seen ? format(new Date(routerData.last_seen), "HH:mm:ss") : "-"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Full Last Seen</p>
              <p className="text-sm text-slate-600">
                {routerData.last_seen ? format(new Date(routerData.last_seen), "PPP") : "Never connected"}
              </p>
            </div>
            <div className="pt-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Description</p>
              <p className="text-sm text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100 mt-1">
                {routerData.description || "No description provided."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card: Connectivity */}
        <Card className="border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 shadow-sm relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              Connectivity
            </CardTitle>
            <Network className="h-4 w-4 text-indigo-400 opacity-50" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase border border-indigo-200">
                {routerData.connectivity_mode.replace("_", " ")}
              </span>
              <div className="h-px flex-1 bg-indigo-100" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-1">Tunnel Destination</p>
                <p className="font-mono text-[11px] font-bold text-slate-700 bg-white/80 border border-slate-100 px-2 py-1.5 rounded-lg select-all shadow-sm">
                  {routerData.host}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-1">Winbox Port</p>
                <p className="font-mono text-[11px] font-bold text-slate-700 bg-white/80 border border-slate-100 px-2 py-1.5 rounded-lg shadow-sm">
                  {routerData.port}
                </p>
              </div>
            </div>

            {/* Remote Access Highlight */}
            {routerData.remote_access_enabled && routerData.remote_access_port ? (
              <div className="mt-4">
                <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
                  <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Globe className="w-3 h-3" /> FQDN Remote Access
                  </p>
                  <p className="text-md font-black text-indigo-700 font-mono tracking-tight select-all">
                    vpn.billrrnet.tech:{routerData.remote_access_port}
                  </p>
                </div>

                {/* Remote User Setup Alert/Button */}
                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200 border-dashed animate-in fade-in slide-in-from-top-2 duration-500 delay-300">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-1 bg-amber-100 rounded-lg text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-amber-900 uppercase tracking-tight leading-none pt-1">Recommended Action</p>
                      <p className="text-[10px] text-amber-700 font-medium leading-normal">
                        Create a dedicated <b>Remoting User</b> to avoid session collisions with ERP polling.
                      </p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-0 text-[10px] font-black text-indigo-600 hover:bg-transparent hover:text-indigo-800 flex items-center gap-1 group"
                        onClick={() => {
                          setRemoteUsername(`admin_${routerData.name.toLowerCase().replace(/\s+/g, '_')}`);
                          setRemotePassword(Math.random().toString(36).slice(-10));
                          setShowRemoteUserDialog(true);
                        }}
                      >
                        <RefreshCw className="w-3 h-3 transition-transform group-hover:rotate-180 duration-500" />
                        One-Click Winbox Setup
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
                <Globe className="h-5 w-5 text-slate-300" />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">External Access Disabled</p>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 text-[9px] font-black uppercase text-indigo-600"
                  onClick={() => networkService.toggleRemoteAccess(routerData.id, true).then(() => fetchRouter(id))}
                >
                  Enable Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card: Management */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Management API</CardTitle>
            <Settings className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> API Port
                </p>
                <p className="font-mono text-sm font-bold text-slate-900 bg-slate-50 border border-slate-100 px-2 py-1 rounded">
                  {routerData.api_port || "8728"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-1">Protocol security</p>
                <div className={cn(
                  "inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase",
                  routerData.api_use_tls ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                )}>
                  {routerData.api_use_tls ? "✓ API SSL (TLS)" : "! Standard API"}
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Router Credentials</span>
                <Shield className="h-3 w-3 text-slate-600" />
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed italic">
                Username and password are securely stored and encrypted in the cloud vault. 
                They are never exposed in the dashboard UI.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card: Advanced RADIUS Settings */}
        <Card className="border-slate-100 bg-white shadow-sm flex flex-col justify-between overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              RADIUS Controls
            </CardTitle>
            {isEditingRadius ? (
               <div className="flex gap-1.5">
                 <Button 
                   size="sm" 
                   variant="ghost" 
                   className="h-6 px-2 text-[9px] font-black uppercase text-slate-400"
                   onClick={() => {
                      setIsEditingRadius(false);
                      setIdleTimeout(routerData?.idle_timeout || 48);
                      setInterimInterval(routerData?.interim_interval || 60);
                   }}
                 >
                   Clear
                 </Button>
                 <Button 
                   size="sm" 
                   className="h-6 px-2 text-[9px] font-black uppercase bg-slate-800 hover:bg-slate-900 text-white"
                   onClick={handleUpdateRadius}
                   disabled={updatingRadius}
                 >
                   {updatingRadius ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Save
                 </Button>
               </div>
            ) : (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-[10px] font-bold uppercase text-slate-500 hover:text-slate-700 hover:bg-slate-50 relative z-10"
                  onClick={() => setIsEditingRadius(true)}
                >
                  Configure
                </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4 pt-4 relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="idle_timeout" className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Idle Timeout</Label>
                <div className="relative">
                  <Input 
                    id="idle_timeout"
                    type="number"
                    value={idleTimeout}
                    onChange={(e) => setIdleTimeout(Number(e.target.value))}
                    disabled={!isEditingRadius}
                    className="h-10 text-xs font-bold bg-slate-50 border-slate-200 text-slate-700 focus:bg-white"
                  />
                  <span className="absolute right-2.5 top-2.5 text-[9px] font-bold text-slate-400">HRS</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="interim_interval" className="text-[9px] font-black uppercase text-slate-500 tracking-widest pl-1">Interim Upd</Label>
                <div className="relative">
                  <Input 
                    id="interim_interval"
                    type="number"
                    value={interimInterval}
                    onChange={(e) => setInterimInterval(Number(e.target.value))}
                    disabled={!isEditingRadius}
                    className="h-10 text-xs font-bold bg-slate-50 border-slate-200 text-slate-700 focus:bg-white"
                  />
                  <span className="absolute right-2.5 top-2.5 text-[9px] font-bold text-slate-400">SEC</span>
                </div>
              </div>
            </div>
            
            <div className="pt-2">
              <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 flex items-start gap-3">
                <Activity className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-indigo-900 uppercase tracking-tighter">Performance Insight</p>
                  <p className="text-[9px] text-indigo-700 font-medium leading-normal italic">
                    60s Interim updates ensure precise bandwidth tracking. 
                    Idle timeout (hours) prevents stale user sessions.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card: Isolir Setup */}
        <Card className="border-orange-100 bg-gradient-to-br from-white to-orange-50/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-1 opacity-[0.05] -mr-4 -mt-4">
               <Shield className="h-24 w-24 text-orange-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-semibold text-orange-900 uppercase tracking-wider">Isolir Gateway</CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4 relative">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-2 pl-1">Redirect IP Address</p>
              {(!isolirStatus?.firewall_installed || isUpdateMode) ? (
                <div className="relative group">
                  <Input
                    type="text"
                    placeholder="192.168.88.1"
                    value={hotspotIP || routerData?.host || ""}
                    onChange={(e) => setHotspotIP(e.target.value)}
                    className="h-10 bg-white border-orange-200 focus:border-orange-500 focus:ring-orange-500 font-mono text-xs pl-3"
                    disabled={installingFirewall || uninstallingFirewall}
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                     <span className="text-[8px] font-black text-orange-300 uppercase">Input IP</span>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wide">✓ Rules Active</p>
                    <p className="text-[9px] text-emerald-600 font-bold uppercase opacity-80">
                      IP: {isolirStatus.hotspot_ip}
                    </p>
                  </div>
                  <div className="h-8 w-8 bg-emerald-100 rounded-full flex items-center justify-center">
                      <Save className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {statusLoading ? (
                <div className="p-2 w-full flex justify-center"><LoadingSpinner size={20} /></div>
              ) : !isolirStatus?.firewall_installed ? (
                <Button 
                  className="w-full h-9 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase shadow-md shadow-orange-100"
                  disabled={installingFirewall}
                  onClick={async () => {
                    if (!routerData) return;
                    const ipToUse = hotspotIP || routerData.host;
                    if (!ipToUse) {
                      showToast({ title: "Missing IP", description: "Enter hotspot IP", variant: "error" });
                      return;
                    }
                    setInstallingFirewall(true);
                    try {
                      const newStatus = await networkService.installIsolirFirewall(routerData.id, ipToUse);
                      showToast({ title: "Rules Installed", description: "Successfully configured firewall", variant: "success" });
                      setIsolirStatus(newStatus);
                      setHotspotIP("");
                    } catch (err: any) {
                      showToast({ title: "Error", description: err?.message, variant: "error" });
                    } finally { setInstallingFirewall(false); }
                  }}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {installingFirewall ? "Working..." : "Install Script"}
                </Button>
              ) : isUpdateMode ? (
                <div className="flex w-full gap-2">
                  <Button className="flex-1 h-9 bg-orange-600 text-white text-xs font-bold uppercase" onClick={async () => {
                    if (!routerData || !hotspotIP) return;
                    setInstallingFirewall(true);
                    try {
                      const res = await networkService.installIsolirFirewall(routerData.id, hotspotIP);
                      showToast({ title: "Updated", variant: "success" });
                      setIsolirStatus(res); setHotspotIP(""); setIsUpdateMode(false);
                    } catch (err: any) { showToast({ title: "Failed", variant: "error" }); } finally { setInstallingFirewall(false); }
                  }}>Re-Apply</Button>
                  <Button variant="ghost" className="h-9 px-3 text-xs font-bold uppercase text-slate-400" onClick={() => { setIsUpdateMode(false); setHotspotIP(""); }}>Cancel</Button>
                </div>
              ) : (
                <div className="flex w-full gap-2 font-black">
                   <Button variant="outline" className="flex-1 h-9 border-slate-200 text-slate-600 text-[10px] uppercase font-bold" onClick={() => setIsUpdateMode(true)}>Edit IP</Button>
                   <Button variant="destructive" className="flex-1 h-9 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 text-[10px] uppercase font-bold" disabled={uninstallingFirewall} onClick={async () => {
                    if (!routerData) return; setUninstallingFirewall(true);
                    try {
                      await networkService.uninstallIsolirFirewall(routerData.id);
                      showToast({ title: "Cleaned", variant: "success" });
                      const status = await networkService.getIsolirStatus(routerData.id); setIsolirStatus(status);
                    } catch (err: any) { showToast({ title: "Failed", variant: "error" }); } finally { setUninstallingFirewall(false); }
                   }}>{uninstallingFirewall ? "..." : "Remove Script"}</Button>
                </div>
              )}
            </div>
          </CardContent>
          <div className="px-4 py-2 bg-orange-50/50 border-t border-orange-100/50">
             <p className="text-[9px] text-orange-700 font-bold uppercase italic opacity-70">
                {!isolirStatus?.firewall_installed ? "⚠ Ready to Install" : "✓ Protection Enabled"}
             </p>
          </div>
        </Card>

      </div>

      {/* Live Device Logs Section */}
      <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
        <Card className="border-slate-200 shadow-xl shadow-slate-100 overflow-hidden rounded-2xl">
          <CardHeader className="bg-slate-900 border-b border-slate-800 flex flex-row items-center justify-between py-5 px-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400 border border-indigo-500/30">
                <Terminal className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-black text-white uppercase tracking-widest">Diagnostic Console</CardTitle>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Live Traffic Stream • {logs.length} events</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
               {loadingLogs && (
                 <div className="flex items-center gap-2 bg-slate-800 px-2 py-1 rounded-md">
                    <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />
                    <span className="text-[9px] font-black text-slate-400 uppercase">Polling...</span>
                 </div>
               )}
               <button className="text-slate-500 hover:text-white transition-colors" title="Clear View" onClick={() => setLogs([])}>
                  <Trash2 className="h-4 w-4" />
               </button>
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-slate-950">
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {logs.length > 0 ? (
                <div className="divide-y divide-slate-900/50 font-mono">
                  {logs.map((log, idx) => (
                    <div key={idx} className="p-3 hover:bg-slate-900/50 transition-colors flex gap-4 text-[11px] group relative">
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="text-slate-600 shrink-0 select-none hidden md:block w-20 font-bold">
                        [{log.time || "sys"}]
                      </div>
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border",
                            log.topics?.includes("error") || log.topics?.includes("critical") ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            log.topics?.includes("warning") ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                            log.topics?.includes("hotspot") ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                            log.topics?.includes("pppoe") ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            log.topics?.includes("system") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            "bg-slate-800 text-slate-400 border-slate-700"
                          )}>
                            {log.topics || "info"}
                          </span>
                          <span className="text-slate-300 leading-relaxed break-all selection:bg-indigo-500 selection:text-white font-medium">
                            {log.message}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-slate-600 gap-6">
                  {routerData?.status === 'online' ? (
                    <>
                       <div className="relative">
                         <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
                         <Activity className="h-10 w-10 text-indigo-500 animate-pulse relative" />
                       </div>
                       <div className="text-center space-y-1">
                         <p className="text-sm font-black text-slate-300 uppercase tracking-widest">Listening for events...</p>
                         <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">MikroTik API handshaking in progress</p>
                       </div>
                    </>
                  ) : (
                    <>
                       <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800">
                         <Globe className="h-10 w-10 text-slate-700" />
                       </div>
                       <div className="text-center space-y-1">
                         <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Stream Disconnected</p>
                         <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">Power up the device to resume logging</p>
                       </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardContent>
          <div className="bg-slate-900 px-6 py-3 border-t border-slate-800 flex justify-between items-center">
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Buffer: Dynamic</span>
                </div>
                <div className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Encrypted Stream</span>
                </div>
             </div>
             <p className="text-[9px] font-black text-slate-600 uppercase italic">MikroTik RouterOS Diagnostic Data Interface v2.0</p>
          </div>
        </Card>
      </div>
    </div>

    {/* Delete Confirmation Modal */}
    <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => !isDeleting && setIsDeleteDialogOpen(open)}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.35)] rounded-[24px]">
        <div className="bg-gradient-to-b from-rose-600 to-rose-900 p-8 flex flex-col items-center text-center text-white space-y-4 relative">
          <div className="absolute top-0 inset-x-0 h-px bg-white/20"></div>
          <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
            <Trash2 className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white italic">Matrix Termination</DialogTitle>
            <DialogDescription className="text-[10px] font-bold text-rose-100/70 uppercase tracking-[0.2em] leading-relaxed">
              Permanent Infrastructure Purge
            </DialogDescription>
          </div>
        </div>
        
        <div className="p-8 space-y-6 bg-white max-h-[70vh] overflow-y-auto custom-scrollbar">
          {previewLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="h-10 w-10 animate-spin text-rose-500" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic animate-pulse">Scanning Grid Dependencies...</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    You are certifying the total removal of node <span className="font-black text-slate-900 leading-tight italic">"{routerData?.name}"</span>. 
                  </p>
                </div>

                {deletePreview && (deletePreview.preview.pppoe_count > 0 || deletePreview.preview.voucher_count > 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-amber-900 uppercase">Dependency Warning</p>
                        <p className="text-[10px] text-amber-700 font-medium">Clients connected to this node will lose access.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {deletePreview.preview.pppoe_count > 0 && (
                        <div className="space-y-1.5 pl-1 border-l-2 border-amber-100">
                          <p className="text-[10px] font-black text-amber-800 uppercase tracking-tight flex items-center gap-1.5">
                            PPPoE Secrets ({deletePreview.preview.pppoe_count})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {deletePreview.preview.pppoe_usernames.slice(0, 10).map(u => (
                              <span key={u} className="text-[9px] bg-white text-amber-700 px-2 py-0.5 rounded-lg font-bold border border-amber-200 shadow-sm transition-all hover:scale-105">@{u}</span>
                            ))}
                            {deletePreview.preview.pppoe_count > 10 && <span className="text-[9px] text-amber-400 font-bold italic ml-1">+{deletePreview.preview.pppoe_count - 10} others</span>}
                          </div>
                        </div>
                      )}

                      {deletePreview.preview.voucher_count > 0 && (
                        <div className="space-y-1.5 pl-1 border-l-2 border-amber-100">
                          <p className="text-[10px] font-black text-amber-800 uppercase tracking-tight flex items-center gap-1.5">
                            Hotspot Vouchers ({deletePreview.preview.voucher_count})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {deletePreview.preview.voucher_codes.slice(0, 10).map(v => (
                              <span key={v} className="text-[9px] bg-white text-amber-700 px-2 py-0.5 rounded-lg font-bold border border-amber-200 shadow-sm transition-all hover:scale-105">{v}</span>
                            ))}
                            {deletePreview.preview.voucher_count > 10 && <span className="text-[9px] text-amber-400 font-bold italic ml-1">+{deletePreview.preview.voucher_count - 10} others</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="cleanup-remote-detail" className="text-xs font-black text-slate-900 uppercase tracking-tight cursor-pointer">Wipe Configuration</Label>
                      <p className="text-[10px] text-slate-500 font-medium">Remove RR-NET rules from MikroTik</p>
                    </div>
                    <Switch 
                      id="cleanup-remote-detail" 
                      checked={cleanupRemote} 
                      onCheckedChange={setCleanupRemote}
                      disabled={isDeleting}
                    />
                  </div>

                  <div className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors ${
                    !cleanupRemote ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 
                    deletePreview?.status === 'online' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
                  }`}>
                    {!cleanupRemote ? (
                      <>
                        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <p className="text-[9px] font-bold leading-relaxed uppercase tracking-tight">
                          <span className="font-black">Soft Delete (Safe)</span>: We only wipe the ERP database. The MikroTik unit won't be touched. Ideal if the router is permanently dead or stolen.
                        </p>
                      </>
                    ) : deletePreview?.status === 'online' ? (
                      <>
                        <Activity className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <p className="text-[9px] font-bold leading-relaxed uppercase tracking-tight">
                          <span className="font-black">Full Purge (Recommended)</span>: Router is reachable. We will attempt a remote uninstall of all scripts and rules automatically.
                        </p>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <p className="text-[9px] font-bold leading-relaxed uppercase tracking-tight">
                          <span className="font-black italic">Unreachable Host</span>: You requested a full purge but the router is <span className="font-black">OFFLINE</span>. Elimination will proceed after a 3s timeout.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button 
                  variant="destructive" 
                  className="w-full h-14 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-rose-200 rounded-2xl transition-all active:scale-[0.98] border-b-4 border-rose-800"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Purging Matrix...</span>
                    </div>
                  ) : "Execute Termination"}
                </Button>
                <DialogClose asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full h-11 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] tracking-widest"
                    disabled={isDeleting}
                  >
                    Abort Action
                  </Button>
                </DialogClose>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Remote User Setup Modal */}
    <Dialog open={showRemoteUserDialog} onOpenChange={setShowRemoteUserDialog}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.35)] rounded-[24px]">
        <div className="bg-gradient-to-b from-indigo-600 to-indigo-800 p-8 flex flex-col items-center text-center text-white space-y-4 relative">
          <div className="absolute top-0 inset-x-0 h-px bg-white/20"></div>
          <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-white italic">Winbox Remote Setup</DialogTitle>
            <DialogDescription className="text-[10px] font-bold text-indigo-100/70 uppercase tracking-widest leading-relaxed">
              Create a dedicated admin user on your MikroTik<br/>specifically for secure remote management.
            </DialogDescription>
          </div>
        </div>

        <div className="p-8 space-y-6 bg-white">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Winbox Username</Label>
              <Input 
                value={remoteUsername} 
                onChange={(e) => setRemoteUsername(e.target.value)}
                className="h-10 text-xs font-bold border-slate-200 focus:border-indigo-500 rounded-xl"
              />
            </div>
            <div className="space-y-1.5 relative">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Access Password</Label>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"}
                  value={remotePassword} 
                  onChange={(e) => setRemotePassword(e.target.value)}
                  className="h-10 text-xs font-mono font-bold border-slate-200 focus:border-indigo-500 rounded-xl pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100/50">
            <div className="flex items-center gap-2 mb-2">
               <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
               <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Setup Configuration</p>
            </div>
            <p className="text-[10px] text-indigo-700 font-medium leading-normal italic">
              This will add a new user to the <code>full</code> group on your MikroTik router via API. 
              Use these credentials only in your Winbox application.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button 
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-100 rounded-xl transition-all active:scale-[0.98]"
              disabled={isSettingUpRemoteUser || !remoteUsername || !remotePassword}
              onClick={async () => {
                if (!routerData) return;
                setIsSettingUpRemoteUser(true);
                try {
                  await useNetworkStore.getState().setupRemoteUser(routerData.id, {
                    username: remoteUsername,
                    password: remotePassword
                  });
                  showToast({
                    title: "Provisioning Success",
                    description: `Admin user "${remoteUsername}" has been created on your MikroTik.`,
                    variant: "success"
                  });
                  setShowRemoteUserDialog(false);
                } catch (err: any) {
                  showToast({
                    title: "Setup Failed",
                    description: err?.message || "Verify your API connection and try again.",
                    variant: "error"
                  });
                } finally {
                  setIsSettingUpRemoteUser(false);
                }
              }}
            >
              {isSettingUpRemoteUser ? (
                <div className="flex items-center gap-2 italic">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Generating Identity...
                </div>
              ) : "Create Admin Identity"}
            </Button>
            <DialogClose asChild>
              <Button 
                variant="ghost" 
                className="w-full h-10 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] tracking-widest"
                disabled={isSettingUpRemoteUser}
              >
                Cancel
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
