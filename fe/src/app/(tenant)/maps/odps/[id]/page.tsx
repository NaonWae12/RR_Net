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
  Zap,
  Activity,
  User,
  Info,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils/styles";
import { format } from "date-fns";
import Link from "next/link";
import { useNotificationStore } from "@/stores/notificationStore";
import { Button } from "@/components/ui/button";


export default function ODPDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { 
    odp, 
    odcs,
    loading, 
    error, 
    fetchODP, 
    fetchODCs,
    deleteODP, 
    clearODP 
  } = useMapsStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    fetchODCs();
  }, [fetchODCs]);

  useEffect(() => {
    if (id) {
      fetchODP(id);
    }
    return () => {
      clearODP();
    };
  }, [id, fetchODP, clearODP]);

  const handleDelete = async () => {
    if (!odp) return;
    if (!confirm(`Are you sure you want to delete ODP "${odp.name}"?`)) {
      return;
    }
    try {
      await deleteODP(odp.id);
      showToast({
        title: "ODP deleted",
        description: `ODP "${odp.name}" has been successfully deleted.`,
        variant: "success",
      });
      router.push("/maps/odps");
    } catch (err: any) {
      showToast({
        title: "Failed to delete ODP",
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
        Error loading ODP: {error}
      </div>
    );
  }

  if (!odp) {
    return (
      <div className="p-6 text-slate-500">
        ODP not found.
      </div>
    );
  }

  const capacityPercent = Number(((odp.used_ports / odp.port_count) * 100).toFixed(1));
  const isHighUsage = capacityPercent > 80;

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
              <Link href="/maps/odps" className="hover:text-indigo-600 transition-colors">ODPs</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-indigo-600">ODP Detail</span>
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
                  {odp.name}
                  <NodeStatusBadge status={odp.status} className="h-6 text-[10px]" />
                </h1>
                <p className="text-slate-500 text-sm mt-1 flex items-center gap-2 font-medium">
                  <Database className="h-3.5 w-3.5 text-indigo-400" />
                  Optical Distribution Point Node
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => router.push(`/maps/odps/${odp.id}/edit`)}
              className="h-11 px-5 rounded-xl border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 font-bold transition-all shadow-sm"
            >
              <Pencil className="h-4 w-4 mr-2" /> 
              Edit Node
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
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Node Health</span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 uppercase">
                {odp.status === 'ok' ? 'Healthy' : odp.status.toUpperCase()}
              </div>
              <p className="text-slate-400 text-[10px] font-medium mt-1">Status verified in real-time</p>
            </div>
          </div>

          <div className="bg-rose-900 p-6 rounded-3xl border border-rose-800 shadow-xl shadow-rose-100 flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-rose-800/50 text-rose-200 rounded-xl">
                <Zap className="h-5 w-5 fill-current" />
              </div>
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-tighter">Port Capacity</span>
            </div>
            <div>
              <div className="text-3xl font-black text-white">
                {odp.used_ports} / {odp.port_count}
              </div>
              <div className="w-full bg-rose-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    isHighUsage ? "bg-amber-400" : "bg-emerald-400"
                  )}
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                <Info className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Efficiency</span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{capacityPercent}%</div>
              <p className="text-slate-400 text-[10px] font-medium mt-1">Utilization of physical ports</p>
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-3xl border border-indigo-500 shadow-xl shadow-indigo-100 flex flex-col justify-between group">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-indigo-500/50 text-indigo-100 rounded-xl">
                <MapPin className="h-5 w-5" />
              </div>
              <button 
                onClick={() => router.push('/maps')}
                className="text-[10px] font-bold text-indigo-200 uppercase tracking-tighter flex items-center gap-1 hover:text-white transition-colors"
              >
                View Map <ExternalLink className="h-2 w-2" />
              </button>
            </div>
            <div className="text-white space-y-1">
              <div className="text-[11px] font-mono opacity-80 truncate">{odp.latitude}</div>
              <div className="text-[11px] font-mono opacity-80 truncate">{odp.longitude}</div>
              <p className="text-[10px] font-bold tracking-widest uppercase mt-2">Geospatial Loc</p>
            </div>
          </div>
        </div>

        {/* Main Details Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Detailed Info Card */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden divide-y divide-slate-100">
             <div className="p-6 bg-slate-50/50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-indigo-500" />
                  Infrastructure Context
                </span>
                <span className="text-[10px] font-mono text-slate-400">ID: {odp.id}</span>
             </div>

             <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parent ODC</label>
                  <p className="text-slate-900 font-bold flex items-center gap-2 group cursor-pointer hover:text-indigo-600 transition-colors">
                    <Box className="h-4 w-4 text-indigo-400" />
                    {odp.odc_id ? (
                      <>
                        Source ODC Node ({odcs.find(o => o.id === odp.odc_id)?.name || `#${odp.odc_id.slice(0, 4)}`})
                      </>
                    ) : 'N/A'}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registered At</label>
                  <p className="text-slate-900 font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    {format(new Date(odp.created_at), "PPP")}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Update</label>
                  <p className="text-slate-900 font-bold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    {format(new Date(odp.updated_at), "PPP")}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Network Area</label>
                  <p className="text-slate-900 font-bold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-rose-400" />
                    Zone Core Infrastructure
                  </p>
                </div>
             </div>

             {odp.notes && (
               <div className="p-8 bg-slate-50/30">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Field Technician Notes</label>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 text-slate-600 text-sm leading-relaxed italic shadow-sm">
                    "{odp.notes}"
                  </div>
               </div>
             )}
          </div>

          {/* Connected Clients / Secondary Info */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-500" />
                Connection Summary
              </h3>
              <div className="space-y-4">
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-xs font-medium text-slate-500">Active Clients</span>
                    <span className="text-lg font-black text-slate-900">{odp.used_ports}</span>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-xs font-medium text-slate-500">Free Port Assets</span>
                    <span className="text-lg font-black text-emerald-600">{odp.port_count - odp.used_ports}</span>
                 </div>
              </div>
              <Button 
                className="w-full mt-6 h-12 rounded-xl bg-slate-900 font-bold"
                onClick={() => router.push(`/maps/clients/create`)}
              >
                Provision New Client
              </Button>
            </div>

            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-start gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Info className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1">Live Telemetry</h4>
                <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                  Topology lines and signal levels are calculated based on registered client locations relative to this ODP.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-slate-400 text-[10px] uppercase font-bold tracking-[0.2em] pt-8 border-t border-slate-100">
          ODP ID: {odp.id} — Network Intelligence Unit — ERP NET INFRA
        </div>
      </div>
    </div>
  );
}
