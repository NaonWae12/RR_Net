"use client";

import { useEffect } from "react";
import { useNetworkStore } from "@/stores/networkStore";
import { NetworkProfileTable } from "@/components/network";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@heroicons/react/20/solid";

export default function NetworkProfilesPage() {
  const router = useRouter();
  const { profiles, loading, error, fetchProfiles } = useNetworkStore();

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading profiles: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Network Profiles</h1>
        <Button onClick={() => router.push("/network/profiles/create")}>
          <PlusIcon className="h-5 w-5 mr-2" /> Add Profile
        </Button>
      </div>

      <NetworkProfileTable profiles={profiles} loading={loading} />
    </div>
  );
}

