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
  const { createRouter, loading } = useNetworkStore();
  const { showToast } = useNotificationStore();

  const handleSubmit = async (data: CreateRouterRequest | UpdateRouterRequest) => {
    try {
      await createRouter(data as CreateRouterRequest);
      showToast({
        title: "Router created",
        description: "New router has been successfully added.",
        variant: "success",
      });
      router.push("/network/routers");
    } catch (err: any) {
      showToast({
        title: "Failed to create router",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
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

