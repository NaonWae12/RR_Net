"use client";

import { useEffect } from "react";
import { useMapsStore } from "@/stores/mapsStore";
import { NodeStatusBadge } from "@/components/maps";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@heroicons/react/20/solid";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useNotificationStore } from "@/stores/notificationStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ODPsPage() {
  const router = useRouter();
  const { odps, loading, error, fetchODPs, deleteODP } = useMapsStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    fetchODPs();
  }, [fetchODPs]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ODP "${name}"?`)) {
      return;
    }
    try {
      await deleteODP(id);
      showToast({
        title: "ODP deleted",
        description: `ODP "${name}" has been successfully deleted.`,
        variant: "success",
      });
    } catch (error: any) {
      showToast({
        title: "Failed to delete ODP",
        description: error.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading ODPs: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">ODPs</h1>
        <Button onClick={() => router.push("/maps/odps/create")}>
          <PlusIcon className="h-5 w-5 mr-2" /> Add ODP
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      ) : odps.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No ODPs found. Create your first ODP to get started.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>ODC ID</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Ports</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {odps.map((odp) => (
                <TableRow key={odp.id}>
                  <TableCell className="font-medium">{odp.name}</TableCell>
                  <TableCell className="text-sm text-slate-500">{odp.odc_id.slice(0, 8)}...</TableCell>
                  <TableCell>
                    {odp.latitude.toFixed(6)}, {odp.longitude.toFixed(6)}
                  </TableCell>
                  <TableCell>
                    {odp.used_ports}/{odp.port_count}
                  </TableCell>
                  <TableCell>
                    <NodeStatusBadge status={odp.status} />
                  </TableCell>
                  <TableCell className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => router.push(`/maps/odps/${odp.id}`)}>
                      View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/maps/odps/${odp.id}/edit`)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(odp.id, odp.name)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

