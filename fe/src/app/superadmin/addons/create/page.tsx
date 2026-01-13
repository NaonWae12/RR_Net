"use client";

import { AddonForm } from "@/components/superadmin/AddonForm";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { CreateAddonRequest, UpdateAddonRequest } from "@/lib/api/types";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CreateAddonPage() {
  const router = useRouter();
  const { createAddon, loading } = useSuperAdminStore();
  const { showToast } = useNotificationStore();

  const handleSubmit = async (data: CreateAddonRequest | UpdateAddonRequest) => {
    try {
      await createAddon(data as CreateAddonRequest);
      showToast({
        title: "Addon created",
        description: "New addon has been successfully created.",
        variant: "success",
      });
      router.push("/superadmin/addons");
    } catch (err: any) {
      showToast({
        title: "Failed to create addon",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push("/superadmin/addons");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Addons
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Create New Addon</h1>
      <AddonForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

