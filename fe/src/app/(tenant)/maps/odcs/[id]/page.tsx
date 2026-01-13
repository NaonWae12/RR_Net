"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMapsStore } from "@/stores/mapsStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { NodeStatusBadge } from "@/components/maps";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, PencilIcon, TrashIcon } from "@heroicons/react/20/solid";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";

export default function ODCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { odc, loading, error, fetchODC, deleteODC, clearODC } = useMapsStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchODC(id);
    }
    return () => {
      clearODC();
    };
  }, [id, fetchODC, clearODC]);

  const handleDelete = async () => {
    if (!odc) return;
    if (!confirm(`Are you sure you want to delete ODC "${odc.name}"?`)) {
      return;
    }
    try {
      await deleteODC(odc.id);
      showToast({
        title: "ODC deleted",
        description: `ODC "${odc.name}" has been successfully deleted.`,
        variant: "success",
      });
      router.push("/maps/odcs");
    } catch (err: any) {
      showToast({
        title: "Failed to delete ODC",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
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
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to ODCs
        </Button>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.push(`/maps/odcs/${odc.id}/edit`)}>
            <PencilIcon className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <TrashIcon className="h-4 w-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-slate-900">{odc.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white shadow rounded-lg p-6">
        <div>
          <p className="text-sm font-medium text-slate-500">Status</p>
          <NodeStatusBadge status={odc.status} className="text-lg mt-1" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Latitude</p>
          <p className="text-lg font-semibold">{odc.latitude}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Longitude</p>
          <p className="text-lg font-semibold">{odc.longitude}</p>
        </div>
        {odc.capacity_info && (
          <div>
            <p className="text-sm font-medium text-slate-500">Capacity Info</p>
            <p className="text-lg">{odc.capacity_info}</p>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-slate-500">Created At</p>
          <p className="text-lg">{format(new Date(odc.created_at), "PPp")}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Updated At</p>
          <p className="text-lg">{format(new Date(odc.updated_at), "PPp")}</p>
        </div>
        {odc.notes && (
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-slate-500">Notes</p>
            <p className="text-lg">{odc.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

