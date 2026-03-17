"use client";

import { useEffect } from "react";
import { CreateEditPlanForm } from "@/components/superadmin/CreateEditPlanForm";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { useParams, useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { UpdatePlanRequest } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EditPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { plan, loading, error, fetchPlan, updatePlan, clearPlan } = useSuperAdminStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchPlan(id);
    }
    return () => {
      clearPlan();
    };
  }, [id, fetchPlan, clearPlan]);

  const handleSubmit = async (data: UpdatePlanRequest) => {
    if (!id) return;
    try {
      await updatePlan(id, data);
      showToast({
        title: "Plan updated",
        description: "Plan information has been successfully updated.",
        variant: "success",
      });
      router.push(`/superadmin/plans/${id}`);
    } catch (err: any) {
      showToast({
        title: "Failed to update plan",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push(`/superadmin/plans/${id}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        Error loading plan: {error}
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 text-slate-500">
        Plan not found.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Plan Details
        </Button>
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit Plan: {plan.name}</h1>
        <p className="text-slate-500">Update plan details, pricing, and limits.</p>
      </div>
      <CreateEditPlanForm initialData={plan} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

