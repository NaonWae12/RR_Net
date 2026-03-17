"use client";

import { CreateEditPlanForm } from "@/components/superadmin/CreateEditPlanForm";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { CreatePlanRequest, UpdatePlanRequest } from "@/lib/api/types";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CreatePlanPage() {
  const router = useRouter();
  const { createPlan, loading } = useSuperAdminStore();
  const { showToast } = useNotificationStore();

  const handleSubmit = async (data: CreatePlanRequest | UpdatePlanRequest) => {
    try {
      await createPlan(data as CreatePlanRequest);
      showToast({
        title: "Plan created",
        description: "New plan has been successfully created.",
        variant: "success",
      });
      router.push("/superadmin/plans");
    } catch (err: any) {
      showToast({
        title: "Failed to create plan",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push("/superadmin/plans");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Plans
        </Button>
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create New Plan</h1>
        <p className="text-slate-500">Define a new subscription plan for tenants.</p>
      </div>
      <CreateEditPlanForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

