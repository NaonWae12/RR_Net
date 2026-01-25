"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NetworkProfile } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useNetworkStore } from "@/stores/networkStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";

interface NetworkProfileTableProps {
  profiles: NetworkProfile[] | null | undefined;
  loading: boolean;
}

function formatSpeed(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${kbps} Kbps`;
}

export function NetworkProfileTable({ profiles, loading }: NetworkProfileTableProps) {
  const router = useRouter();
  const { deleteProfile } = useNetworkStore();
  const { showToast } = useNotificationStore();

  const handleView = (id: string) => {
    router.push(`/network/profiles/${id}`);
  };

  const handleEdit = (id: string) => {
    router.push(`/network/profiles/${id}/edit`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete profile "${name}"?`)) {
      return;
    }
    try {
      await deleteProfile(id);
      showToast({
        title: "Profile deleted",
        description: `Profile "${name}" has been successfully deleted.`,
        variant: "success",
      });
    } catch (error: any) {
      showToast({
        title: "Failed to delete profile",
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

  if (!profiles || profiles.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No network profiles found. Create your first profile to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-slate-700 font-semibold">Name</TableHead>
            <TableHead className="text-slate-700 font-semibold">Download</TableHead>
            <TableHead className="text-slate-700 font-semibold">Upload</TableHead>
            <TableHead className="text-slate-700 font-semibold">Priority</TableHead>
            <TableHead className="text-slate-700 font-semibold">Status</TableHead>
            <TableHead className="text-slate-700 font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => (
            <TableRow key={profile.id} className="border-slate-200">
              <TableCell className="font-medium text-slate-900">{profile.name}</TableCell>
              <TableCell className="text-slate-700">{formatSpeed(profile.download_speed)}</TableCell>
              <TableCell className="text-slate-700">{formatSpeed(profile.upload_speed)}</TableCell>
              <TableCell className="text-slate-700">{profile.priority}</TableCell>
              <TableCell>
                {profile.is_active ? (
                  <span className="text-xs font-medium px-2 py-1 rounded bg-green-100 text-green-700 border border-green-200">Active</span>
                ) : (
                  <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200">Inactive</span>
                )}
              </TableCell>
              <TableCell className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleView(profile.id)}>
                  View
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleEdit(profile.id)}>
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(profile.id, profile.name)}>
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

