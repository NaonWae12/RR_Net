"use client";

import { useEffect } from "react";
import { ODPForm } from "@/components/maps/ODPForm";
import { useMapsStore } from "@/stores/mapsStore";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { CreateODPRequest, UpdateODPRequest } from "@/lib/api/types";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";

export default function CreateODPPage() {
  const router = useRouter();
  const { createODP, loading, fetchODCs, odcs } = useMapsStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    fetchODCs();
  }, [fetchODCs]);

  const handleSubmit = async (data: CreateODPRequest | UpdateODPRequest) => {
    try {
      await createODP(data as CreateODPRequest);
      showToast({
        title: "ODP created",
        description: "New ODP has been successfully added.",
        variant: "success",
      });
      router.push("/maps/odps");
    } catch (err: any) {
      showToast({
        title: "Failed to create ODP",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push("/maps/odps");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to ODPs
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Create New ODP</h1>
      <ODPForm odcs={odcs} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

