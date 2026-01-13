"use client";

import { useEffect } from "react";
import { ODCForm } from "@/components/maps/ODCForm";
import { useMapsStore } from "@/stores/mapsStore";
import { useParams, useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { UpdateODCRequest } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";

export default function EditODCPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { odc, loading, error, fetchODC, updateODC, clearODC } = useMapsStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchODC(id);
    }
    return () => {
      clearODC();
    };
  }, [id, fetchODC, clearODC]);

  const handleSubmit = async (data: UpdateODCRequest) => {
    if (!id) return;
    try {
      await updateODC(id, data);
      showToast({
        title: "ODC updated",
        description: "ODC information has been successfully updated.",
        variant: "success",
      });
      router.push(`/maps/odcs/${id}`);
    } catch (err: any) {
      showToast({
        title: "Failed to update ODC",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push(`/maps/odcs/${id}`);
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
        Error loading ODC: {error}
      </div>
    );
  }

  if (!odc) {
    return (
      <div className="p-6 text-slate-500">
        ODC not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to ODC Details
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Edit ODC: {odc.name}</h1>
      <ODCForm initialData={odc} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

