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
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600 font-medium">Error loading profile</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-slate-600">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-white min-h-screen">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <Button variant="outline" onClick={() => router.back()} className="border-slate-300 text-slate-700 hover:bg-slate-50">
          <ArrowLeftIcon className="h-4 w-4 mr-2 text-slate-700" /> Back to Profiles
        </Button>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.push(`/network/profiles/${profile.id}/edit`)} className="border-slate-300 text-slate-700 hover:bg-slate-50">
            <PencilIcon className="h-4 w-4 mr-2 text-slate-700" /> Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700">
            <TrashIcon className="h-4 w-4 mr-2 text-white" /> Delete
          </Button>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-slate-900">{profile.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-slate-200 shadow-sm rounded-lg p-6">
        <div className="border-b border-slate-100 pb-4">
          <p className="text-sm font-medium text-slate-500 mb-1">Status</p>
          <p className={`text-lg font-semibold ${profile.is_active ? 'text-green-700' : 'text-slate-500'}`}>
            {profile.is_active ? "Active" : "Inactive"}
          </p>
        </div>
        <div className="border-b border-slate-100 pb-4">
          <p className="text-sm font-medium text-slate-500 mb-1">Priority</p>
          <p className="text-lg font-semibold text-slate-900">{profile.priority}</p>
        </div>
        <div className="border-b border-slate-100 pb-4">
          <p className="text-sm font-medium text-slate-500 mb-1">Download Speed</p>
          <p className="text-lg font-semibold text-slate-900">{formatSpeed(profile.download_speed)}</p>
        </div>
        <div className="border-b border-slate-100 pb-4">
          <p className="text-sm font-medium text-slate-500 mb-1">Upload Speed</p>
          <p className="text-lg font-semibold text-slate-900">{formatSpeed(profile.upload_speed)}</p>
        </div>
        {profile.burst_download && (
          <div className="border-b border-slate-100 pb-4">
            <p className="text-sm font-medium text-slate-500 mb-1">Burst Download</p>
            <p className="text-lg text-slate-900">{formatSpeed(profile.burst_download)}</p>
          </div>
        )}
        {profile.burst_upload && (
          <div className="border-b border-slate-100 pb-4">
            <p className="text-sm font-medium text-slate-500 mb-1">Burst Upload</p>
            <p className="text-lg text-slate-900">{formatSpeed(profile.burst_upload)}</p>
          </div>
        )}
        {profile.shared_users && (
          <div className="border-b border-slate-100 pb-4">
            <p className="text-sm font-medium text-slate-500 mb-1">Shared Users</p>
            <p className="text-lg text-slate-900">{profile.shared_users}</p>
          </div>
        )}
        {profile.address_pool && (
          <div className="border-b border-slate-100 pb-4">
            <p className="text-sm font-medium text-slate-500 mb-1">Address Pool</p>
            <p className="text-lg text-slate-900">{profile.address_pool}</p>
          </div>
        )}
        {profile.local_address && (
          <div className="border-b border-slate-100 pb-4">
            <p className="text-sm font-medium text-slate-500 mb-1">Local Address</p>
            <p className="text-lg text-slate-900">{profile.local_address}</p>
          </div>
        )}
        {profile.remote_address && (
          <div className="border-b border-slate-100 pb-4">
            <p className="text-sm font-medium text-slate-500 mb-1">Remote Address</p>
            <p className="text-lg text-slate-900">{profile.remote_address}</p>
          </div>
        )}
        {profile.dns_servers && (
          <div className="border-b border-slate-100 pb-4">
            <p className="text-sm font-medium text-slate-500 mb-1">DNS Servers</p>
            <p className="text-lg text-slate-900">{profile.dns_servers}</p>
          </div>
        )}
        <div className="border-b border-slate-100 pb-4">
          <p className="text-sm font-medium text-slate-500 mb-1">Created At</p>
          <p className="text-lg text-slate-900">{format(new Date(profile.created_at), "PPp")}</p>
        </div>
        <div className="border-b border-slate-100 pb-4">
          <p className="text-sm font-medium text-slate-500 mb-1">Updated At</p>
          <p className="text-lg text-slate-900">{format(new Date(profile.updated_at), "PPp")}</p>
        </div>
        {profile.description && (
          <div className="md:col-span-2 border-b border-slate-100 pb-4">
            <p className="text-sm font-medium text-slate-500 mb-1">Description</p>
            <p className="text-lg text-slate-900">{profile.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

