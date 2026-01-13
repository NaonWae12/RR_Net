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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Plans
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Create New Plan</h1>
      <CreateEditPlanForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

