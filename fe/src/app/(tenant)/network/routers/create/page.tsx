"use client";

import { RouterForm } from "@/components/network/RouterForm";
import { useNetworkStore } from "@/stores/networkStore";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { CreateRouterRequest, UpdateRouterRequest } from "@/lib/api/types";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";

export default function CreateRouterPage() {
  const router = useRouter();
  const { createRouter, updateRouter, loading } = useNetworkStore();
  const { showToast } = useNotificationStore();

  const handleSubmit = async (data: CreateRouterRequest | UpdateRouterRequest & { id?: string }) => {
    try {
      // If data has an id, the router was already created during provisioning (Step 1)
      // We should UPDATE it with the final credentials, not CREATE a new one
      if ('id' in data && data.id) {
        const { id, ...updateData } = data as any;
        await updateRouter(id, updateData as UpdateRouterRequest);
        showToast({
          title: "Router setup complete!",
          description: "Router configuration has been saved successfully.",
          variant: "success",
        });
        router.push("/network/routers");
      } else {
        await createRouter(data as CreateRouterRequest);
        showToast({
          title: "Router created",
          description: "New router has been successfully added.",
          variant: "success",
        });
        router.push("/network/routers");
      }
    } catch (err: any) {
      showToast({
        title: "Failed to save router",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleModalClose = () => {
    setCreatedRouterInfo(null);
    router.push("/network/routers");
  };

  const handleCancel = () => {
    router.push("/network/routers");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Routers
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Create New Router</h1>
      <RouterForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />

    </div>
  );
}

