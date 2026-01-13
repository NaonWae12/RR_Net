"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { format } from "date-fns";

export default function AddonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addon, loading, error, fetchAddon, clearAddon } = useSuperAdminStore();

  useEffect(() => {
    if (id) {
      fetchAddon(id);
    }
    return () => {
      clearAddon();
    };
  }, [id, fetchAddon, clearAddon]);

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
        Error loading addon: {error}
      </div>
    );
  }

  if (!addon) {
    return (
      <div className="p-6 text-slate-500">
        Addon not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Addons
        </Button>
        <Button variant="outline" onClick={() => router.push(`/superadmin/addons/${addon.id}/edit`)}>
          <Pencil className="h-4 w-4 mr-2" /> Edit
        </Button>
      </div>

      <h1 className="text-3xl font-bold text-slate-900">{addon.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white shadow rounded-lg p-6">
        <div>
          <p className="text-sm font-medium text-slate-500">Code</p>
          <p className="text-lg font-semibold">{addon.code}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Type</p>
          <p className="text-lg font-semibold capitalize">{addon.addon_type.replace("_", " ")}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Price</p>
          <p className="text-lg font-semibold">
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: addon.currency || "IDR",
            }).format(addon.price)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Billing Cycle</p>
          <p className="text-lg font-semibold capitalize">{addon.billing_cycle.replace("_", " ")}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Status</p>
          <p className="text-lg font-semibold">
            {addon.is_active ? (
              <span className="text-green-600">Active</span>
            ) : (
              <span className="text-gray-600">Inactive</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Created At</p>
          <p className="text-lg">{format(new Date(addon.created_at), "PPp")}</p>
        </div>
      </div>

      {addon.description && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Description</h2>
          <p className="text-slate-700">{addon.description}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Value</h2>
        <pre className="bg-slate-50 p-4 rounded-md overflow-auto">
          {JSON.stringify(addon.value, null, 2)}
        </pre>
      </div>

      {addon.available_for_plans.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Available for Plans</h2>
          <ul className="list-disc list-inside space-y-1">
            {addon.available_for_plans.map((planCode, idx) => (
              <li key={idx} className="text-slate-700">
                {planCode}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

