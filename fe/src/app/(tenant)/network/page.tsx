"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNetworkStore } from "@/stores/networkStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { RouterTable, NetworkProfileTable } from "@/components/network";
import { Plus, RefreshCw, ChevronRight } from "lucide-react";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { useAuth } from "@/lib/hooks/useAuth";

export default function NetworkPage() {
  const router = useRouter();
  const { routers, profiles, routersLoading, profilesLoading, fetchRouters, fetchProfiles } = useNetworkStore();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Only fetch if authenticated
    if (!isAuthenticated) return;
    
    fetchRouters();
    fetchProfiles();
  }, [fetchRouters, fetchProfiles, isAuthenticated]);

  const handleRefresh = () => {
    fetchRouters();
    fetchProfiles();
  };

  return (
    <RoleGuard allowedRoles={["owner", "admin", "technician"]} redirectTo="/dashboard">
      <div className="p-8 max-w-7xl mx-auto space-y-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Network Grid</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em]">Infrastructure Control Center</p>
          </div>
          <div className="flex items-center gap-3">
             <Button 
                variant="outline" 
                size="lg" 
                onClick={handleRefresh} 
                className="h-12 px-6 rounded-2xl border-slate-200 bg-white shadow-sm hover:bg-slate-50 font-black uppercase text-[10px] tracking-widest text-slate-500"
                disabled={routersLoading || profilesLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${(routersLoading || profilesLoading) ? 'animate-spin' : ''}`} />
                Check Pulse
              </Button>
          </div>
        </header>

        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
             <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-slate-900 rounded-full" />
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Active Nodes</h2>
                {routers && (
                   <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg text-[10px] font-black">{routers.length}</span>
                )}
             </div>
             <div className="flex items-center gap-2">
                <Button 
                   variant="ghost"
                   onClick={() => router.push("/network/routers")}
                   className="h-10 px-4 text-slate-400 hover:text-slate-600 font-black uppercase text-[10px] tracking-widest hidden sm:flex"
                >
                   All Nodes <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
                <Button 
                   onClick={() => router.push("/network/routers/create")}
                   className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-slate-200"
                >
                   <Plus className="h-4 w-4 mr-2" />
                   Deploy Node
                </Button>
             </div>
          </div>
          
          {routersLoading ? (
            <div className="flex justify-center items-center h-64 bg-slate-50/50 rounded-3xl border border-slate-100">
              <LoadingSpinner size={32} />
            </div>
          ) : (
            <div className="space-y-6">
              <RouterTable routers={routers} loading={false} />
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
             <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight text-indigo-900">Config Profiles</h2>
                {profiles && (
                   <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg text-[10px] font-black">{profiles.length}</span>
                )}
             </div>
             <div className="flex items-center gap-2">
                <Button 
                   variant="ghost"
                   onClick={() => router.push("/network/profiles")}
                   className="h-10 px-4 text-indigo-400 hover:text-indigo-600 font-black uppercase text-[10px] tracking-widest hidden sm:flex"
                >
                   All Configs <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
                <Button 
                   onClick={() => router.push("/network/profiles/create")}
                   variant="outline"
                   className="h-10 px-5 rounded-xl border-indigo-100 bg-indigo-50/30 text-indigo-600 hover:bg-indigo-100 font-black uppercase text-[10px] tracking-widest"
                >
                   <Plus className="h-4 w-4 mr-2" />
                   Create Config
                </Button>
             </div>
          </div>

          {profilesLoading ? (
            <div className="flex justify-center items-center h-64 bg-slate-50/50 rounded-3xl border border-slate-100">
              <LoadingSpinner size={32} />
            </div>
          ) : (
            <NetworkProfileTable profiles={profiles} loading={false} />
          )}
        </section>
      </div>
    </RoleGuard>
  );
}

