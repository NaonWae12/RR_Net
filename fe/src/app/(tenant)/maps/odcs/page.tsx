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

export default function ODCsPage() {
  const router = useRouter();
  const { odcs, loading, error, fetchODCs, deleteODC } = useMapsStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    fetchODCs();
  }, [fetchODCs]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ODC "${name}"?`)) {
      return;
    }
    try {
      await deleteODC(id);
      showToast({
        title: "ODC deleted",
        description: `ODC "${name}" has been successfully deleted.`,
        variant: "success",
      });
    } catch (error: any) {
      showToast({
        title: "Failed to delete ODC",
        description: error.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading ODCs: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">ODCs</h1>
        <Button onClick={() => router.push("/maps/odcs/create")}>
          <PlusIcon className="h-5 w-5 mr-2" /> Add ODC
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      ) : odcs.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No ODCs found. Create your first ODC to get started.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {odcs.map((odc) => (
                <TableRow key={odc.id}>
                  <TableCell className="font-medium">{odc.name}</TableCell>
                  <TableCell>
                    {odc.latitude.toFixed(6)}, {odc.longitude.toFixed(6)}
                  </TableCell>
                  <TableCell>
                    <NodeStatusBadge status={odc.status} />
                  </TableCell>
                  <TableCell className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => router.push(`/maps/odcs/${odc.id}`)}>
                      View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/maps/odcs/${odc.id}/edit`)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(odc.id, odc.name)}>
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

