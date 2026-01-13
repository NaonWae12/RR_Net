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

export default function ODPDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { odp, loading, error, fetchODP, deleteODP, clearODP } = useMapsStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchODP(id);
    }
    return () => {
      clearODP();
    };
  }, [id, fetchODP, clearODP]);

  const handleDelete = async () => {
    if (!odp) return;
    if (!confirm(`Are you sure you want to delete ODP "${odp.name}"?`)) {
      return;
    }
    try {
      await deleteODP(odp.id);
      showToast({
        title: "ODP deleted",
        description: `ODP "${odp.name}" has been successfully deleted.`,
        variant: "success",
      });
      router.push("/maps/odps");
    } catch (err: any) {
      showToast({
        title: "Failed to delete ODP",
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

  const capacityPercent = ((odp.used_ports / odp.port_count) * 100).toFixed(1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to ODPs
        </Button>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.push(`/maps/odps/${odp.id}/edit`)}>
            <PencilIcon className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <TrashIcon className="h-4 w-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-slate-900">{odp.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white shadow rounded-lg p-6">
        <div>
          <p className="text-sm font-medium text-slate-500">Status</p>
          <NodeStatusBadge status={odp.status} className="text-lg mt-1" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">ODC ID</p>
          <p className="text-lg font-semibold">{odp.odc_id.slice(0, 8)}...</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Latitude</p>
          <p className="text-lg font-semibold">{odp.latitude}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Longitude</p>
          <p className="text-lg font-semibold">{odp.longitude}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Port Usage</p>
          <p className="text-lg font-semibold">
            {odp.used_ports}/{odp.port_count} ({capacityPercent}%)
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Created At</p>
          <p className="text-lg">{format(new Date(odp.created_at), "PPp")}</p>
        </div>
        {odp.notes && (
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-slate-500">Notes</p>
            <p className="text-lg">{odp.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

