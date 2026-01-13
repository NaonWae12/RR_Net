"use client";

import { useEffect } from "react";
import { ODPForm } from "@/components/maps/ODPForm";
import { useMapsStore } from "@/stores/mapsStore";
import { useParams, useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { UpdateODPRequest } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";

export default function EditODPPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { odp, odcs, loading, error, fetchODP, fetchODCs, updateODP, clearODP } = useMapsStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    fetchODCs();
    if (id) {
      fetchODP(id);
    }
    return () => {
      clearODP();
    };
  }, [id, fetchODP, fetchODCs, clearODP]);

  const handleSubmit = async (data: UpdateODPRequest) => {
    if (!id) return;
    try {
      await updateODP(id, data);
      showToast({
        title: "ODP updated",
        description: "ODP information has been successfully updated.",
        variant: "success",
      });
      router.push(`/maps/odps/${id}`);
    } catch (err: any) {
      showToast({
        title: "Failed to update ODP",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push(`/maps/odps/${id}`);
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
        Error loading ODP: {error}
      </div>
    );
  }

  if (!odp) {
    return (
      <div className="p-6 text-slate-500">
        ODP not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to ODP Details
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Edit ODP: {odp.name}</h1>
      <ODPForm initialData={odp} odcs={odcs} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

