"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useNetworkStore } from "@/stores/networkStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, PencilIcon, TrashIcon } from "@heroicons/react/20/solid";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";

function formatSpeed(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${kbps} Kbps`;
}

export default function NetworkProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, loading, error, fetchProfile, deleteProfile, clearProfile } = useNetworkStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchProfile(id);
    }
    return () => {
      clearProfile();
    };
  }, [id, fetchProfile, clearProfile]);

  const handleDelete = async () => {
    if (!profile) return;
    if (!confirm(`Are you sure you want to delete profile "${profile.name}"?`)) {
      return;
    }
    try {
      await deleteProfile(profile.id);
      showToast({
        title: "Profile deleted",
        description: `Profile "${profile.name}" has been successfully deleted.`,
        variant: "success",
      });
      router.push("/network/profiles");
    } catch (err: any) {
      showToast({
        title: "Failed to delete profile",
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
        Error loading profile: {error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-slate-500">
        Profile not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Profiles
        </Button>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.push(`/network/profiles/${profile.id}/edit`)}>
            <PencilIcon className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <TrashIcon className="h-4 w-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-slate-900">{profile.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white shadow rounded-lg p-6">
        <div>
          <p className="text-sm font-medium text-slate-500">Status</p>
          <p className="text-lg font-semibold">{profile.is_active ? "Active" : "Inactive"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Priority</p>
          <p className="text-lg font-semibold">{profile.priority}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Download Speed</p>
          <p className="text-lg font-semibold">{formatSpeed(profile.download_speed)}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Upload Speed</p>
          <p className="text-lg font-semibold">{formatSpeed(profile.upload_speed)}</p>
        </div>
        {profile.burst_download && (
          <div>
            <p className="text-sm font-medium text-slate-500">Burst Download</p>
            <p className="text-lg">{formatSpeed(profile.burst_download)}</p>
          </div>
        )}
        {profile.burst_upload && (
          <div>
            <p className="text-sm font-medium text-slate-500">Burst Upload</p>
            <p className="text-lg">{formatSpeed(profile.burst_upload)}</p>
          </div>
        )}
        {profile.shared_users && (
          <div>
            <p className="text-sm font-medium text-slate-500">Shared Users</p>
            <p className="text-lg">{profile.shared_users}</p>
          </div>
        )}
        {profile.address_pool && (
          <div>
            <p className="text-sm font-medium text-slate-500">Address Pool</p>
            <p className="text-lg">{profile.address_pool}</p>
          </div>
        )}
        {profile.local_address && (
          <div>
            <p className="text-sm font-medium text-slate-500">Local Address</p>
            <p className="text-lg">{profile.local_address}</p>
          </div>
        )}
        {profile.remote_address && (
          <div>
            <p className="text-sm font-medium text-slate-500">Remote Address</p>
            <p className="text-lg">{profile.remote_address}</p>
          </div>
        )}
        {profile.dns_servers && (
          <div>
            <p className="text-sm font-medium text-slate-500">DNS Servers</p>
            <p className="text-lg">{profile.dns_servers}</p>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-slate-500">Created At</p>
          <p className="text-lg">{format(new Date(profile.created_at), "PPp")}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Updated At</p>
          <p className="text-lg">{format(new Date(profile.updated_at), "PPp")}</p>
        </div>
        {profile.description && (
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-slate-500">Description</p>
            <p className="text-lg">{profile.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

