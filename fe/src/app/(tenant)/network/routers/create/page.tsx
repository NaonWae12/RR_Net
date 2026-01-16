"use client";

import { RouterForm } from "@/components/network/RouterForm";
import { useNetworkStore } from "@/stores/networkStore";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { CreateRouterRequest, UpdateRouterRequest } from "@/lib/api/types";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";

import { VPNScriptModal } from "@/components/network/VPNScriptModal";
import { useState } from "react";

export default function CreateRouterPage() {
  const router = useRouter();
  const { createRouter, loading } = useNetworkStore();
  const { showToast } = useNotificationStore();
  const [createdRouterInfo, setCreatedRouterInfo] = useState<{ name: string; script: string } | null>(null);

  const handleSubmit = async (data: CreateRouterRequest | UpdateRouterRequest) => {
    try {
      const result = await createRouter(data as CreateRouterRequest);

      if (result.vpn_script) {
        setCreatedRouterInfo({
          name: result.name,
          script: result.vpn_script
        });
        showToast({
          title: "Router created",
          description: "VPN account generated. Please apply the setup script.",
          variant: "success",
        });
      } else {
        showToast({
          title: "Router created",
          description: "New router has been successfully added.",
          variant: "success",
        });
        router.push("/network/routers");
      }
    } catch (err: any) {
      showToast({
        title: "Failed to create router",
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

      {createdRouterInfo && (
        <VPNScriptModal
          isOpen={!!createdRouterInfo}
          onClose={handleModalClose}
          script={createdRouterInfo.script}
          routerName={createdRouterInfo.name}
        />
      )}
    </div>
  );
}

