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

        {/* Config Profiles Banner */}
        <section className="p-6 rounded-3xl bg-indigo-50/50 border border-indigo-100/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-black text-indigo-950 uppercase text-xs tracking-wider">Managing Bandwidth & Speed Profiles?</h3>
            <p className="text-xs text-indigo-700 font-medium leading-relaxed">
              Config Profiles are now unified under the <strong>PPPoE Management</strong> workspace alongside client secrets and IP automation.
            </p>
          </div>
          <Button 
            onClick={() => router.push("/pppoe?tab=profiles")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest px-5 h-11 rounded-xl shrink-0 shadow-md shadow-indigo-200"
          >
            Go to PPPoE Profiles <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </section>
      </div>
    </RoleGuard>
  );
}

