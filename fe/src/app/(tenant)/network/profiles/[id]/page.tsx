"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useNetworkStore } from "@/stores/networkStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";
import { 
  ArrowLeft, Pencil, Trash2, Zap, ArrowDownCircle, ArrowUpCircle, 
  ShieldCheck, Activity, Users, Globe, Settings, Clock, Info, 
  CheckCircle2, Loader2 
} from "lucide-react";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle 
} from "@/components/ui/dialog";

function formatSpeed(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${kbps} Kbps`;
}

export default function NetworkProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, loading, error, fetchProfile, deleteProfile, clearProfile } = useNetworkStore();
  const { showToast } = useNotificationStore();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProfile(id);
    }
    return () => {
      clearProfile();
    };
  }, [id, fetchProfile, clearProfile]);

  const handleDelete = async () => {
    if (!profile) return;
    setIsDeleting(true);
    try {
      await deleteProfile(profile.id);
      showToast({
        title: "Profile Obliterated",
        description: `Configuration "${profile.name}" has been permanently purged.`,
        variant: "success",
      });
      setIsDeleteDialogOpen(false);
      router.push("/network");
    } catch (err: any) {
      showToast({
        title: "Purge Failed",
        description: err?.message || "An unexpected error occurred system-wide.",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 bg-white rounded-3xl border border-rose-100 shadow-2xl shadow-rose-50 text-center space-y-4">
        <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl w-fit mx-auto">
           <Trash2 className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black uppercase text-slate-900">Communication Error</h2>
        <p className="text-sm text-slate-500 font-medium leading-relaxed">{error}</p>
        <Button onClick={() => router.back()} variant="outline" className="rounded-xl border-slate-200 uppercase font-black text-[10px] tracking-widest px-8">
           Abort & Return
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 bg-white rounded-3xl border border-slate-100 shadow-2xl text-center space-y-4">
        <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl w-fit mx-auto">
           <Info className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black uppercase text-slate-900">Node Missing</h2>
        <p className="text-sm text-slate-500 font-medium leading-relaxed">The requested network profile does not exist in the current grid.</p>
        <Button onClick={() => router.back()} variant="outline" className="rounded-xl border-slate-200 uppercase font-black text-[10px] tracking-widest px-8">
           Return to Grid
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 min-h-screen bg-slate-50/30">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <button 
            onClick={() => router.push("/network")}
            className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-3 w-3 mr-2" />
            Back to Grid
          </button>
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-600 text-white rounded-3xl shadow-xl shadow-indigo-100">
                <Zap className="h-8 w-8" />
             </div>
             <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">{profile.name}</h1>
                <div className="flex items-center gap-2 mt-2">
                   <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-tighter border border-emerald-100">
                      <ShieldCheck className="h-3 w-3" />
                      Live Config
                   </div>
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">PROFILE-ID: {profile.id.slice(0, 8)}</span>
                </div>
             </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => router.push(`/network/profiles/${profile.id}/edit`)}
            className="h-12 px-6 rounded-2xl border-slate-200 bg-white shadow-sm hover:bg-slate-50 font-black uppercase text-[10px] tracking-widest text-slate-600"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Override Config
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setIsDeleteDialogOpen(true)}
            className="h-12 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100 font-black uppercase text-[10px] tracking-widest"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Purge Profile
          </Button>
        </div>
      </header>

      {/* Main Grid Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tier Info */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
           <div className="flex items-center justify-between border-b border-slate-50 pb-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Node Tier</h3>
              <Activity className="h-4 w-4 text-slate-400" />
           </div>
           <div className="space-y-6">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-xl text-slate-600 font-black text-xs">PRI</div>
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Priority Level</span>
                 </div>
                 <span className="text-2xl font-black text-slate-900">{profile.priority}</span>
              </div>
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
                       <Users className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-tight">Shared Context</span>
                 </div>
                 <span className="text-xl font-black text-slate-900">{profile.shared_users || "None"}</span>
              </div>
           </div>
        </div>

        {/* Throughput Info */}
        <div className="md:col-span-2 bg-slate-950 p-6 rounded-3xl shadow-2xl border border-slate-800 space-y-6 overflow-hidden relative">
           <div className="absolute top-0 right-0 p-8 opacity-5">
              <Zap className="h-48 w-48 text-white" />
           </div>
           <div className="flex items-center justify-between border-b border-white/10 pb-4 relative z-10">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Throughput Capacity</h3>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">
                 <CheckCircle2 className="h-2 w-2" /> 
                 Optimized
              </div>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-2">
                 <div className="flex items-center gap-2 text-emerald-400">
                    <ArrowDownCircle className="h-5 w-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Download Max</span>
                 </div>
                 <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-white tracking-tighter">{formatSpeed(profile.download_speed).split(' ')[0]}</span>
                    <span className="text-sm font-black text-white/50 uppercase">{formatSpeed(profile.download_speed).split(' ')[1]}</span>
                 </div>
                 {profile.burst_download && (
                    <div className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em]">Burst Limit: {formatSpeed(profile.burst_download)}</div>
                 )}
              </div>
              <div className="space-y-2">
                 <div className="flex items-center gap-2 text-amber-400">
                    <ArrowUpCircle className="h-5 w-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Upload Max</span>
                 </div>
                 <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-white tracking-tighter">{formatSpeed(profile.upload_speed).split(' ')[0]}</span>
                    <span className="text-sm font-black text-white/50 uppercase">{formatSpeed(profile.upload_speed).split(' ')[1]}</span>
                 </div>
                 {profile.burst_upload && (
                    <div className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em]">Burst Limit: {formatSpeed(profile.burst_upload)}</div>
                 )}
              </div>
           </div>
        </div>

        {/* Network Addressing Details */}
        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                 <Globe className="h-3 w-3" /> Address Schema
              </h3>
              <div className="space-y-4">
                 <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Pool Identity</p>
                    <p className="text-sm font-bold text-slate-900">{profile.address_pool || "Auto-assigned"}</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Local Interface</p>
                       <p className="text-xs font-mono font-bold text-slate-700">{profile.local_address || "Default"}</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Remote Peer</p>
                       <p className="text-xs font-mono font-bold text-slate-700">{profile.remote_address || "Dynamic"}</p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                 <Settings className="h-3 w-3" /> System Integration
              </h3>
              <div className="space-y-4">
                 <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">DNS Resolvers</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{profile.dns_servers || "Grid Defaults"}</p>
                 </div>
                 <div className="space-y-2 pt-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter leading-relaxed">System Description</p>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed italic">
                       {profile.description || "No supplemental documentation provided for this profile."}
                    </p>
                 </div>
              </div>
           </div>

           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                 <Clock className="h-3 w-3" /> Temporal Events
              </h3>
              <div className="space-y-4">
                 <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Deployed At</span>
                    <span className="text-[10px] font-bold text-slate-700">{format(new Date(profile.created_at), "PP p")}</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Last Modulation</span>
                    <span className="text-[10px] font-bold text-slate-700">{format(new Date(profile.updated_at), "PP p")}</span>
                 </div>
                 <div className="pt-2">
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-2xl w-full">
                       <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                       <span className="text-[9px] font-black uppercase tracking-widest">Configuration integrity verified</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => !isDeleting && setIsDeleteDialogOpen(open)}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <div className="bg-rose-600 p-8 flex flex-col items-center text-center text-white space-y-4">
            <div className="p-4 bg-white/20 rounded-3xl">
              <Trash2 className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white leading-none">System Extraction</DialogTitle>
              <p className="text-[10px] font-black text-rose-100/70 uppercase tracking-widest">Confirmed Profile Purge</p>
            </div>
          </div>
          <div className="p-10 space-y-8 bg-white">
            <div className="space-y-4">
               <p className="text-sm text-slate-500 font-medium text-center leading-relaxed">
                  Initiating permanent decommissioning procedure for <span className="font-black text-slate-900">"{profile.name}"</span>. 
                  This will revoke all associated network privileges.
               </p>
               <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 space-y-2">
                  <div className="flex items-center gap-2 text-rose-600">
                     <Info className="h-4 w-4" />
                     <span className="text-[10px] font-black uppercase">Critical Impact</span>
                  </div>
                  <p className="text-[10px] text-rose-500 font-bold leading-relaxed">
                     Hardware settings on linked nodes may revert to default states. Recovery is impossible post-purge.
                  </p>
               </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button 
                variant="destructive" 
                className="w-full h-14 bg-rose-600 hover:bg-rose-700 font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-rose-100 rounded-2xl transition-all"
                onClick={handleDelete} 
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    Executing Extraction...
                  </>
                ) : (
                  "Execute System Purge"
                )}
              </Button>
              <Button 
                variant="ghost" 
                className="w-full h-14 text-slate-400 hover:text-slate-600 font-black uppercase text-[10px] tracking-widest"
                onClick={() => setIsDeleteDialogOpen(false)} 
                disabled={isDeleting}
              >
                Abort & Return to Profile
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

