"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Router } from "@/lib/api/types";
import { Eye, Edit, Activity, PowerOff, Trash2, Loader2, ArrowRight, Globe, Settings, AlertTriangle, AlertCircle, Info, Server, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RouterStatusBadge } from "./RouterStatusBadge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useNetworkStore } from "@/stores/networkStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useState } from "react";

interface RouterTableProps {
  routers: Router[] | null | undefined;
  loading: boolean;
}

export function RouterTable({ routers, loading }: RouterTableProps) {
  const router = useRouter();
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; router: { id: string; name: string } | null }>({
    open: false,
    router: null,
  });
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
  const { deleteRouter, testRouterConnection, disconnectRouter, getDeletePreview } = useNetworkStore();
  const { showToast } = useNotificationStore();
  
  const [deleting, setDeleting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const handleView = (id: string) => {
    router.push(`/network/routers/${id}`);
  };

  const handleEdit = (id: string) => {
    router.push(`/network/routers/${id}/edit`);
  };

  const openDeleteDialog = async (id: string, name: string) => {
    setDeleteDialog({ open: true, router: { id, name } });
    setPreviewLoading(true);
    setDeletePreview(null);
    setCleanupRemote(false);
    try {
      const data = await getDeletePreview(id);
      setDeletePreview(data);
      // Default to cleanup if router is online
      if (data.status === 'online') {
        setCleanupRemote(true);
      }
    } catch (err) {
      console.error("Failed to fetch delete preview", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.router) return;
    setDeleting(true);
    try {
      await deleteRouter(deleteDialog.router.id, cleanupRemote);
      showToast({
        title: "Router deleted",
        description: `Router "${deleteDialog.router.name}" has been successfully deleted.`,
        variant: "success",
      });
      setDeleteDialog({ open: false, router: null });
    } catch (error: any) {
      showToast({
        title: "Failed to delete router",
        description: error.message || "An unexpected error occurred.",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleTestConnection = async (id: string, name: string) => {
    setTestingId(id);
    try {
      const result = await testRouterConnection(id);
      if (result.ok) {
        showToast({
          title: "Connection Successful",
          description: result.identity
            ? `Successfully connected to ${result.identity}${result.latency_ms ? ` (${result.latency_ms}ms)` : ""}`
            : `Successfully connected to router "${name}".`,
          variant: "success",
        });
      } else {
        showToast({
          title: "Connection Failed",
          description: result.error || `Could not establish connection to "${name}".`,
          variant: "error",
        });
      }
    } catch (error: any) {
      showToast({
        title: "Test Connection Error",
        description: error.message || "An unexpected error occurred during testing.",
        variant: "error",
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDisconnect = async (id: string, name: string) => {
    setDisconnectingId(id);
    try {
      await disconnectRouter(id);
      showToast({
        title: "Router Disconnected",
        description: `Router "${name}" has been marked offline.`,
        variant: "success",
      });
    } catch (error: any) {
      showToast({
        title: "Disconnect Failed",
        description: error.message || "An unexpected error occurred while disconnecting.",
        variant: "error",
      });
    } finally {
      setDisconnectingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (!routers || routers.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No routers found. Create your first router to get started.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50/50">
          <TableRow className="border-slate-100 hover:bg-transparent">
            <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Identity</TableHead>
            <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Node Type</TableHead>
            <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Access Point</TableHead>
            <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Network State</TableHead>
            <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tier</TableHead>
            <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Operations</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {routers.map((routerItem) => (
            <TableRow 
              key={routerItem.id} 
              className="group border-slate-100 hover:bg-slate-50/50 transition-all duration-300"
            >
              <TableCell className="py-5 px-6">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 tracking-tight">{routerItem.name}</span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-tighter mt-0.5">ID: {routerItem.id.slice(0, 8)}</span>
                </div>
              </TableCell>
              <TableCell className="py-5 px-6">
                <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <Settings className="h-3 w-3" />
                   </div>
                   <span className="text-xs font-black uppercase tracking-widest text-slate-600">{routerItem.type}</span>
                </div>
              </TableCell>
              <TableCell className="py-5 px-6">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center text-xs font-mono font-bold text-slate-700 bg-slate-100/50 w-fit px-2 py-0.5 rounded-md border border-slate-200/50">
                    <Globe className="h-3 w-3 mr-1.5 text-slate-400" />
                    {routerItem.host}:{routerItem.port}
                  </div>
                  {routerItem.remote_access_enabled && routerItem.remote_access_port ? (
                    <span className="text-[9px] text-indigo-600 font-black uppercase tracking-widest flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                      Ext Port: {routerItem.remote_access_port}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="py-5 px-6">
                <RouterStatusBadge status={routerItem.status} className="font-black tracking-widest text-[9px] uppercase px-2.5 py-1 rounded-full" />
              </TableCell>
              <TableCell className="py-5 px-6">
                {routerItem.is_default ? (
                  <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md w-fit border border-emerald-100">
                    <div className="w-1 h-1 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Primary</span>
                  </div>
                ) : (
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter ml-2">Secondary</span>
                )}
              </TableCell>
              <TableCell className="py-5 px-6 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/50 rounded-xl"
                    onClick={() => handleView(routerItem.id)}
                    title="View Matrix"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  {routerItem.status === "provisioning" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(routerItem.id)}
                      className="h-9 w-9 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100"
                      title="Resume Deployment"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTestConnection(routerItem.id, routerItem.name)}
                        className="h-9 w-9 bg-white border border-slate-200 shadow-sm text-emerald-600 hover:border-emerald-100 hover:bg-emerald-50/50 rounded-xl"
                        title="Pulse Sync"
                        disabled={testingId === routerItem.id}
                      >
                        {testingId === routerItem.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Activity className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDisconnect(routerItem.id, routerItem.name)}
                        className="h-9 w-9 bg-white border border-slate-200 shadow-sm text-orange-600 hover:border-orange-100 hover:bg-orange-50/50 rounded-xl"
                        title="Go Offline"
                        disabled={disconnectingId === routerItem.id}
                      >
                        {disconnectingId === routerItem.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PowerOff className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  )}

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 bg-white border border-slate-200 shadow-sm text-rose-500 hover:border-rose-100 hover:bg-rose-50/50 rounded-xl"
                    onClick={() => openDeleteDialog(routerItem.id, routerItem.name)}
                    title="Terminate Node"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !deleting && setDeleteDialog({ open, router: deleteDialog.router })}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <div className="bg-rose-600 p-6 flex flex-col items-center text-center text-white space-y-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <Trash2 className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Node Termination</DialogTitle>
              <p className="text-[10px] font-black text-rose-100/70 uppercase tracking-widest italic">Authorizing Matrix Purge</p>
            </div>
          </div>
          
          <div className="p-8 space-y-6 bg-white max-h-[70vh] overflow-y-auto custom-scrollbar">
            {previewLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <RefreshCw className="h-8 w-8 animate-spin text-rose-500" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning Dependencies...</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      You are about to terminate <span className="font-black text-slate-900 italic">"{deleteDialog.router?.name}"</span>. 
                    </p>
                  </div>

                  {deletePreview && (deletePreview.preview.pppoe_count > 0 || deletePreview.preview.voucher_count > 0) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-amber-900 uppercase">Dependencies Found</p>
                          <p className="text-[10px] text-amber-700 font-medium">Reassign these users to avoid downtime.</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {deletePreview.preview.pppoe_count > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-black text-amber-800 uppercase tracking-tight flex items-center gap-1.5">
                              <div className="w-1 h-1 rounded-full bg-amber-500" />
                              PPPoE Secrets ({deletePreview.preview.pppoe_count})
                            </p>
                            <div className="flex flex-wrap gap-1.5 opacity-80">
                              {deletePreview.preview.pppoe_usernames.slice(0, 5).map(u => (
                                <span key={u} className="text-[9px] bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-lg font-bold">@{u}</span>
                              ))}
                              {deletePreview.preview.pppoe_count > 5 && <span className="text-[9px] text-amber-500 font-bold italic">+{deletePreview.preview.pppoe_count - 5} more</span>}
                            </div>
                          </div>
                        )}

                        {deletePreview.preview.voucher_count > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-black text-amber-800 uppercase tracking-tight flex items-center gap-1.5">
                              <div className="w-1 h-1 rounded-full bg-amber-500" />
                              Active Vouchers ({deletePreview.preview.voucher_count})
                            </p>
                            <div className="flex flex-wrap gap-1.5 opacity-80">
                              {deletePreview.preview.voucher_codes.slice(0, 5).map(v => (
                                <span key={v} className="text-[9px] bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-lg font-bold">{v}</span>
                              ))}
                              {deletePreview.preview.voucher_count > 5 && <span className="text-[9px] text-amber-500 font-bold italic">+{deletePreview.preview.voucher_count - 5} more</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="cleanup-remote" className="text-xs font-black text-slate-900 uppercase tracking-tight cursor-pointer">Clean up MikroTik</Label>
                        <p className="text-[10px] text-slate-500 font-medium">Remove RR-NET config from hardware</p>
                      </div>
                      <Switch 
                        id="cleanup-remote" 
                        checked={cleanupRemote} 
                        onCheckedChange={setCleanupRemote}
                        disabled={deleting}
                      />
                    </div>

                    {cleanupRemote && (
                      <div className={`flex items-start gap-3 p-3 rounded-xl border ${deletePreview?.status === 'online' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                        {deletePreview?.status === 'online' ? (
                          <>
                            <Activity className="h-4 w-4 mt-0.5" />
                            <p className="text-[9px] font-bold leading-relaxed uppercase tracking-tight">
                              Router is <span className="font-black">ONLINE</span>. Remote cleanup will be attempted (Best Effort).
                            </p>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 mt-0.5" />
                            <p className="text-[9px] font-bold leading-relaxed uppercase tracking-tight">
                              Router is <span className="font-black">OFFLINE</span>. Remote cleanup will likely time out after 3s.
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {!cleanupRemote && (
                      <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl">
                        <Info className="h-4 w-4 mt-0.5" />
                        <p className="text-[9px] font-bold leading-relaxed uppercase tracking-tight">
                          <span className="font-black">FAST DELETE</span>: Only record in ERP will be removed. MikroTik config will remain intact.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button 
                    variant="destructive" 
                    className="w-full h-12 bg-rose-600 hover:bg-rose-700 font-black uppercase text-xs tracking-widest shadow-lg shadow-rose-100 rounded-xl active:scale-[0.98] transition-all"
                    onClick={handleConfirmDelete} 
                    disabled={deleting}
                  >
                    {deleting ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Purging Matrix...</span>
                      </div>
                    ) : (
                      "Execute Termination"
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full h-11 text-slate-400 hover:text-slate-600 font-black uppercase text-[10px] tracking-widest"
                    onClick={() => setDeleteDialog({ open: false, router: null })} 
                    disabled={deleting}
                  >
                    Abort Action
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

