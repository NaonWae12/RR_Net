"use client";

import { useEffect } from "react";
import { RouterForm } from "@/components/network/RouterForm";
import { useNetworkStore } from "@/stores/networkStore";
import { useParams, useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { UpdateRouterRequest } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";

export default function EditRouterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { router: routerData, loading, error, fetchRouter, updateRouter, clearRouter } = useNetworkStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchRouter(id);
    }
    return () => {
      clearRouter();
    };
  }, [id, fetchRouter, clearRouter]);

  const handleSubmit = async (data: UpdateRouterRequest) => {
    if (!id) return;
    try {
      await updateRouter(id, data);
      showToast({
        title: "Router updated",
        description: "Router information has been successfully updated.",
        variant: "success",
      });
      router.push(`/network/routers/${id}`);
    } catch (err: any) {
      showToast({
        title: "Failed to update router",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push(`/network/routers/${id}`);
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
      <div className="p-6 text-red-500">
        Error loading router: {error}
      </div>
    );
  }

  if (!routerData) {
    return (
      <div className="p-6 text-slate-500">
        Router not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Router Details
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Edit Router: {routerData.name}</h1>
      <RouterForm initialData={routerData} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

