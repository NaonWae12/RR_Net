"use client";

import { ODCForm } from "@/components/maps/ODCForm";
import { useMapsStore } from "@/stores/mapsStore";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { CreateODCRequest, UpdateODCRequest } from "@/lib/api/types";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";

export default function CreateODCPage() {
  const router = useRouter();
  const { createODC, loading } = useMapsStore();
  const { showToast } = useNotificationStore();

  const handleSubmit = async (data: CreateODCRequest | UpdateODCRequest) => {
    try {
      await createODC(data as CreateODCRequest);
      showToast({
        title: "ODC created",
        description: "New ODC has been successfully added.",
        variant: "success",
      });
      router.push("/maps/odcs");
    } catch (err: any) {
      showToast({
        title: "Failed to create ODC",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push("/maps/odcs");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to ODCs
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Create New ODC</h1>
      <ODCForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

