"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMapsStore } from "@/stores/mapsStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { NodeStatusBadge } from "@/components/maps";
import { 
  ArrowLeft, 
  Pencil, 
  Trash2, 
  Calendar, 
  MapPin, 
  Database, 
  Box,
  ChevronRight,
  Home,
  Activity,
  Info,
  ExternalLink,
  Layers,
  Clock,
  Layout,
  User
} from "lucide-react";
import { cn } from "@/lib/utils/styles";
import { format } from "date-fns";
import Link from "next/link";
import { useNotificationStore } from "@/stores/notificationStore";
import { Button } from "@/components/ui/button";

export default function ODCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { 
    odc, 
    odps,
    clientLocations,
    loading, 
    error, 
    fetchODC, 
    fetchODPs,
    fetchClientLocations,
    deleteODC, 
    clearODC 
  } = useMapsStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchODC(id);
      fetchODPs(id);
      fetchClientLocations(id);
    }
    return () => {
      clearODC();
    };
  }, [id, fetchODC, fetchODPs, fetchClientLocations, clearODC]);

  const totalODPs = odps.length;
  const directClients = clientLocations.length;
  const totalDirectNodes = totalODPs + directClients;
  
  // For ODC, capacity info is often a string like "48 Core", so we use that for efficiency if possible
  // or just show total direct children vs some dummy limit if not specified.
  const avgEfficiency = totalDirectNodes > 0 ? Math.min(Math.round((totalDirectNodes / 10) * 100), 100) : 0;

  const handleDelete = async () => {
    if (!odc) return;
    if (!confirm(`Are you sure you want to delete ODC "${odc.name}"?`)) {
      return;
    }
    try {
      await deleteODC(odc.id);
      showToast({
        title: "ODC deleted",
        description: `ODC "${odc.name}" has been successfully deleted.`,
        variant: "success",
      });
      router.push("/maps/odcs");
    } catch (err: any) {
      showToast({
        title: "Failed to delete ODC",
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
        Error loading ODC: {error}
      </div>
    );
  }

  if (!odc) {
    return (
      <div className="p-6 text-slate-500">
        ODC not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Navigation & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-widest">
              <Home className="h-3 w-3" />
              <ChevronRight className="h-3 w-3" />
              <Link href="/maps" className="hover:text-indigo-600 transition-colors">Maps</Link>
              <ChevronRight className="h-3 w-3" />
              <Link href="/maps/odcs" className="hover:text-indigo-600 transition-colors">ODCs</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-indigo-600">ODC Detail</span>
            </nav>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.back()}
                className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 transition-all text-slate-600 hover:text-indigo-600 group"
              >
                <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                  {odc.name}
                  <NodeStatusBadge status={odc.status} className="h-6 text-[10px]" />
                </h1>
                <p className="text-slate-500 text-sm mt-1 flex items-center gap-2 font-medium">
                  <Database className="h-3.5 w-3.5 text-indigo-400" />
                  Optical Distribution Cabinet Core Node
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => router.push(`/maps/odcs/${odc.id}/edit`)}
              className="h-11 px-5 rounded-xl border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 font-bold transition-all shadow-sm"
            >
              <Pencil className="h-4 w-4 mr-2" /> 
              Edit Cabinet
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDelete}
              className="h-11 px-5 rounded-xl border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-200 font-bold transition-all shadow-sm"
            >
              <Trash2 className="h-4 w-4 mr-2" /> 
              Delete
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                <Activity className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">System Health</span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 uppercase">
                {odc.status === 'ok' ? 'Operational' : odc.status.toUpperCase()}
              </div>
              <p className="text-slate-400 text-[10px] font-medium mt-1">Cabinet heartbeat is normal</p>
            </div>
          </div>

          <div className="bg-indigo-900 p-6 rounded-3xl border border-indigo-800 shadow-xl shadow-indigo-100 flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-indigo-700/50 text-indigo-200 rounded-xl">
                <Layers className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Hierarchy</span>
            </div>
            <div>
              <div className="text-3xl font-black text-white uppercase italic tracking-tighter">
                Root Node
              </div>
              <p className="text-indigo-400 text-[10px] font-medium mt-1 uppercase tracking-widest">Main Distribution Type</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
                <Box className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Capacity</span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 truncate">
                {odc.capacity_info || 'Unspecified'}
              </div>
              <p className="text-slate-400 text-[10px] font-medium mt-1 uppercase tracking-widest">Physical Fiber Limit</p>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl shadow-slate-100 flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-slate-800 text-slate-400 rounded-xl">
                <MapPin className="h-5 w-5" />
              </div>
              <button 
                onClick={() => router.push('/maps')}
                className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter flex items-center gap-1 hover:text-white transition-colors"
              >
                View on Map <ExternalLink className="h-2 w-2" />
              </button>
            </div>
            <div className="text-white space-y-1">
              <div className="text-[11px] font-mono opacity-80 truncate">{odc.latitude} / {odc.longitude}</div>
              <p className="text-[10px] font-bold tracking-widest uppercase mt-2 text-indigo-400">Core Coordinates</p>
            </div>
          </div>
        </div>

        {/* Main Details Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Detailed Info Card */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden divide-y divide-slate-100">
             <div className="p-6 bg-slate-50/50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <Layout className="h-3.5 w-3.5 text-indigo-500" />
                  Cabinet Specifications
                </span>
                <span className="text-[10px] font-mono text-slate-400">UUID: {odc.id}</span>
             </div>

             <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Node Name</label>
                  <p className="text-slate-900 font-bold flex items-center gap-2">
                    <Database className="h-4 w-4 text-indigo-400" />
                    {odc.name}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created At</label>
                  <p className="text-slate-900 font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    {format(new Date(odc.created_at), "PPP")}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Modified</label>
                  <p className="text-slate-900 font-bold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    {format(new Date(odc.updated_at), "PPP")}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deployment Zone</label>
                  <p className="text-slate-900 font-bold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-rose-400" />
                    Master Backbone Area
                  </p>
                </div>
             </div>

             {odc.notes && (
               <div className="p-8 bg-slate-50/30">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3 font-semibold">Technical Documentation</label>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 text-slate-600 text-sm leading-relaxed italic shadow-sm relative">
                    <span className="absolute -top-3 left-6 px-2 bg-white text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">Internal Note</span>
                    "{odc.notes}"
                  </div>
               </div>
             )}
          </div>

          {/* ODP Summary / Actions */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-500" />
                Connectivity Tree
              </h3>
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-sm transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                        <Box className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-600">Sub-nodes (ODP)</span>
                    </div>
                    <span className="text-xl font-black text-slate-900">{totalODPs}</span>
                 </div>

                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-sm transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                        <User className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-600">Direct Subscribers</span>
                    </div>
                    <span className="text-xl font-black text-slate-900">{directClients}</span>
                 </div>

                 <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase">Port Utilization</span>
                      <span className="text-[10px] font-bold text-indigo-700">{avgEfficiency}%</span>
                    </div>
                    <div className="w-full bg-indigo-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-1000" 
                        style={{ width: `${avgEfficiency}%` }}
                      />
                    </div>
                 </div>

                 <p className="text-[10px] text-slate-400 text-center font-medium italic mt-2">
                   Managing {totalODPs} ODP points and {directClients} direct fiber drops.
                 </p>
              </div>
              <Button 
                className="w-full mt-6 h-12 rounded-xl bg-slate-900 font-bold transition-all hover:bg-black active:scale-95 shadow-lg shadow-slate-200"
                onClick={() => router.push(`/maps/odps/create`)}
              >
                Attach New ODP
              </Button>
            </div>

            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-start gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Info className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">Architecture Warning</h4>
                <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                  Deleting this ODC core node might affect topology visualization of all child ODPs and clients. Handle with care.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-slate-400 text-[10px] uppercase font-bold tracking-[0.2em] pt-8 border-t border-slate-100">
          ODC MASTER NODE: {odc.id} — ERP NET NETWORK OPS — 2026
        </div>
      </div>
    </div>
  );
}

