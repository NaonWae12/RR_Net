"use client";

import { useEffect } from "react";
import { NetworkProfileForm } from "@/components/network/NetworkProfileForm";
import { useNetworkStore } from "@/stores/networkStore";
import { useParams, useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { UpdateNetworkProfileRequest } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";

export default function EditNetworkProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, loading, error, fetchProfile, updateProfile, clearProfile } = useNetworkStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchProfile(id);
    }
    return () => {
      clearProfile();
    };
  }, [id, fetchProfile, clearProfile]);

  const handleSubmit = async (data: UpdateNetworkProfileRequest) => {
    if (!id) return;
    try {
      await updateProfile(id, data);
      showToast({
        title: "Profile updated",
        description: "Network profile has been successfully updated.",
        variant: "success",
      });
      router.push(`/network/profiles/${id}`);
    } catch (err: any) {
      showToast({
        title: "Failed to update profile",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push(`/network/profiles/${id}`);
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
        <Button variant="outline" onClick={handleCancel} className="border-slate-300 text-slate-700 hover:bg-slate-50">
          <ArrowLeftIcon className="h-4 w-4 mr-2 text-slate-700" /> Back to Profile Details
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Edit Profile: {profile.name}</h1>
      <NetworkProfileForm initialData={profile} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

