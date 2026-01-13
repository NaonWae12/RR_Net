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
        <Button variant="outline" onClick={handleCancel}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Profile Details
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Edit Profile: {profile.name}</h1>
      <NetworkProfileForm initialData={profile} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

