"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Router } from "@/lib/api/types";
import { RouterStatusBadge } from "./RouterStatusBadge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useNetworkStore } from "@/stores/networkStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";

interface RouterTableProps {
  routers: Router[] | null | undefined;
  loading: boolean;
}

export function RouterTable({ routers, loading }: RouterTableProps) {
  const router = useRouter();
  const { deleteRouter } = useNetworkStore();
  const { showToast } = useNotificationStore();

  const handleView = (id: string) => {
    router.push(`/network/routers/${id}`);
  };

  const handleEdit = (id: string) => {
    router.push(`/network/routers/${id}/edit`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete router "${name}"?`)) {
      return;
    }
    try {
      await deleteRouter(id);
      showToast({
        title: "Router deleted",
        description: `Router "${name}" has been successfully deleted.`,
        variant: "success",
      });
    } catch (error: any) {
      showToast({
        title: "Failed to delete router",
        description: error.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (!routers || routers.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No routers found. Create your first router to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Host</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Default</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {routers.map((routerItem) => (
            <TableRow key={routerItem.id}>
              <TableCell className="font-medium">{routerItem.name}</TableCell>
              <TableCell className="uppercase">{routerItem.type}</TableCell>
              <TableCell>{routerItem.host}:{routerItem.port}</TableCell>
              <TableCell>
                <RouterStatusBadge status={routerItem.status} />
              </TableCell>
              <TableCell>
                {routerItem.is_default ? (
                  <span className="text-xs font-medium text-green-600">Yes</span>
                ) : (
                  <span className="text-xs text-slate-400">No</span>
                )}
              </TableCell>
              <TableCell className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleView(routerItem.id)}>
                  View
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleEdit(routerItem.id)}>
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(routerItem.id, routerItem.name)}>
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

