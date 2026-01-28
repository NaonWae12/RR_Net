"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Router, RouterStatus } from "@/lib/api/types";
import { Loader2, Trash2 } from "lucide-react";
import { RouterStatusBadge } from "./RouterStatusBadge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useNetworkStore } from "@/stores/networkStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useState } from "react";

interface RouterTableProps {
  routers: Router[] | null | undefined;
  loading: boolean;
}

export function RouterTable({ routers, loading }: RouterTableProps) {
  const router = useRouter();
  const { deleteRouter, testRouterConnection, disconnectRouter } = useNetworkStore();
  const { showToast } = useNotificationStore();
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; router: { id: string; name: string } | null }>({
    open: false,
    router: null,
  });
  const [deleting, setDeleting] = useState(false);

  const handleView = (id: string) => {
    router.push(`/network/routers/${id}`);
  };

  const handleEdit = (id: string) => {
    router.push(`/network/routers/${id}/edit`);
  };

  const openDeleteDialog = (id: string, name: string) => {
    setDeleteDialog({ open: true, router: { id, name } });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.router) return;
    setDeleting(true);
    try {
      await deleteRouter(deleteDialog.router.id);
      showToast({
        title: "Router deleted",
        description: `Router "${deleteDialog.router.name}" has been successfully deleted.`,
        variant: "success",
      });
      setDeleteDialog({ open: false, router: null });
    } catch (error: any) {
      showToast({
        title: "Failed to delete router",
        description: error.message || "An unexpected error occurred.",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleTestConnection = async (id: string, name: string) => {
    try {
      const result = await testRouterConnection(id);
      if (result.ok) {
        showToast({
          title: "Connection successful",
          description: result.identity
            ? `Connected to ${result.identity}${result.latency_ms ? ` (${result.latency_ms}ms)` : ""}`
            : "Router is reachable.",
          variant: "success",
        });
      } else {
        showToast({
          title: "Connection failed",
          description: result.error || "Could not connect to router.",
          variant: "error",
        });
      }
    } catch (error: any) {
      showToast({
        title: "Connection test failed",
        description: error.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleDisconnect = async (id: string, name: string) => {
    try {
      await disconnectRouter(id);
      showToast({
        title: "Router disconnected",
        description: `Router "${name}" has been marked offline.`,
        variant: "success",
      });
    } catch (error: any) {
      showToast({
        title: "Failed to disconnect router",
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
    <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-slate-700 font-semibold">Name</TableHead>
            <TableHead className="text-slate-700 font-semibold">Type</TableHead>
            <TableHead className="text-slate-700 font-semibold">Host</TableHead>
            <TableHead className="text-slate-700 font-semibold">Status</TableHead>
            <TableHead className="text-slate-700 font-semibold">Default</TableHead>
            <TableHead className="text-slate-700 font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {routers.map((routerItem) => (
            <TableRow key={routerItem.id} className="border-slate-200">
              <TableCell className="font-medium text-slate-900">{routerItem.name}</TableCell>
              <TableCell className="uppercase text-slate-500">{routerItem.type}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-mono text-xs">{routerItem.host}:{routerItem.port}</span>
                  {routerItem.remote_access_enabled && routerItem.remote_access_port ? (
                    <span className="text-[10px] text-indigo-600 font-bold mt-1">
                      EXT: :{routerItem.remote_access_port}
                    </span>
                  ) : null}
                </div>
              </TableCell>
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
                {routerItem.status === "provisioning" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(routerItem.id)}
                    className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                  >
                    Continue Setup →
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(routerItem.id, routerItem.name)}
                      className="text-green-600 hover:text-green-700"
                    >
                      Connect/Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(routerItem.id, routerItem.name)}
                      className="text-orange-600 hover:text-orange-700"
                    >
                      Disconnect
                    </Button>
                  </>
                )}
                <Button variant="destructive" size="sm" onClick={() => openDeleteDialog(routerItem.id, routerItem.name)}>
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !deleting && setDeleteDialog({ open, router: deleteDialog.router })}>
        <DialogContent className="sm:max-w-[400px] bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Router
            </DialogTitle>
            <DialogDescription className="py-3 text-slate-600 block">
              Are you sure you want to delete router <span className="font-semibold text-slate-900">&quot;{deleteDialog.router?.name}&quot;</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, router: null })} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

