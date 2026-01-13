"use client";

import { useEffect } from "react";
import { useNetworkStore } from "@/stores/networkStore";
import { RouterTable } from "@/components/network";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@heroicons/react/20/solid";

export default function RoutersPage() {
  const router = useRouter();
  const { routers, loading, error, fetchRouters } = useNetworkStore();

  useEffect(() => {
    fetchRouters();
  }, [fetchRouters]);

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading routers: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Routers</h1>
        <Button onClick={() => router.push("/network/routers/create")}>
          <PlusIcon className="h-5 w-5 mr-2" /> Add Router
        </Button>
      </div>

      <RouterTable routers={routers} loading={loading} />
    </div>
  );
}

