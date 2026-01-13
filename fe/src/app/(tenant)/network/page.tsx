"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNetworkStore } from "@/stores/networkStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { RouterTable, NetworkProfileTable } from "@/components/network";
import { Plus } from "lucide-react";

export default function NetworkPage() {
  const router = useRouter();
  const { routers, profiles, loading, fetchRouters, fetchProfiles } = useNetworkStore();

  useEffect(() => {
    fetchRouters();
    fetchProfiles();
  }, [fetchRouters, fetchProfiles]);

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Network Management</h1>

      {/* Routers Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800">Routers</h2>
          <Button onClick={() => router.push("/network/routers/create")}>
            <Plus className="h-5 w-5 mr-2" /> Add Router
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        ) : (
          <>
            <RouterTable routers={routers} loading={false} />
            {routers && routers.length > 0 && (
              <Button variant="outline" onClick={() => router.push("/network/routers")}>
                View All Routers →
              </Button>
            )}
          </>
        )}
      </div>

      {/* Profiles Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800">Network Profiles</h2>
          <Button onClick={() => router.push("/network/profiles/create")}>
            <Plus className="h-5 w-5 mr-2" /> Add Profile
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        ) : (
          <>
            <NetworkProfileTable profiles={profiles} loading={false} />
            {profiles && profiles.length > 0 && (
              <Button variant="outline" onClick={() => router.push("/network/profiles")}>
                View All Profiles →
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

