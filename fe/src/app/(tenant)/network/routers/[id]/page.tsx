"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useNetworkStore } from "@/stores/networkStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { RouterStatusBadge } from "@/components/network";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";

export default function RouterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { router: routerData, loading, error, fetchRouter, deleteRouter, clearRouter } = useNetworkStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchRouter(id);
    }
    return () => {
      clearRouter();
    };
  }, [id, fetchRouter, clearRouter]);

  const handleDelete = async () => {
    if (!routerData) return;
    if (!confirm(`Are you sure you want to delete router "${routerData.name}"?`)) {
      return;
    }
    try {
      await deleteRouter(routerData.id);
      showToast({
        title: "Router deleted",
        description: `Router "${routerData.name}" has been successfully deleted.`,
        variant: "success",
      });
      router.push("/network/routers");
    } catch (err: any) {
      showToast({
        title: "Failed to delete router",
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
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Routers
        </Button>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.push(`/network/routers/${routerData.id}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-slate-900">{routerData.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white shadow rounded-lg p-6">
        <div>
          <p className="text-sm font-medium text-slate-500">Type</p>
          <p className="text-lg font-semibold uppercase text-slate-900">{routerData.type}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Status</p>
          <RouterStatusBadge status={routerData.status} className="text-lg" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Host</p>
          <p className="text-lg text-slate-900">{routerData.host}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Port</p>
          <p className="text-lg text-slate-900">{routerData.port}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">API Port</p>
          <p className="text-lg text-slate-900">{routerData.api_port || "N/A"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Username</p>
          <p className="text-lg text-slate-900">{routerData.username}</p>
        </div>
        {routerData.remote_access_enabled && routerData.remote_access_port && (
          <div>
            <p className="text-sm font-medium text-slate-500">Remote Winbox Port (External)</p>
            <p className="text-lg font-bold text-indigo-600">{routerData.remote_access_port}</p>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-slate-500">Default Router</p>
          <p className="text-lg text-slate-900">{routerData.is_default ? "Yes" : "No"}</p>
        </div>
        {routerData.last_seen && (
          <div>
            <p className="text-sm font-medium text-slate-500">Last Seen</p>
            <p className="text-lg text-slate-900">{format(new Date(routerData.last_seen), "PPp")}</p>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-slate-500">Created At</p>
          <p className="text-lg text-slate-900">{format(new Date(routerData.created_at), "PPp")}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Updated At</p>
          <p className="text-lg text-slate-900">{format(new Date(routerData.updated_at), "PPp")}</p>
        </div>
        {routerData.description && (
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-slate-500">Description</p>
            <p className="text-lg text-slate-900">{routerData.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

