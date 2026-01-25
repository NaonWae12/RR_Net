"use client";

import { NetworkProfileForm } from "@/components/network/NetworkProfileForm";
import { useNetworkStore } from "@/stores/networkStore";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { CreateNetworkProfileRequest, UpdateNetworkProfileRequest } from "@/lib/api/types";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/ui/button";

export default function CreateNetworkProfilePage() {
  const router = useRouter();
  const { createProfile, loading } = useNetworkStore();
  const { showToast } = useNotificationStore();

  const handleSubmit = async (data: CreateNetworkProfileRequest | UpdateNetworkProfileRequest) => {
    try {
      await createProfile(data as CreateNetworkProfileRequest);
      showToast({
        title: "Profile created",
        description: "New network profile has been successfully added.",
        variant: "success",
      });
      router.push("/network/profiles");
    } catch (err: any) {
      showToast({
        title: "Failed to create profile",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push("/network/profiles");
  };

  return (
    <div className="p-6 space-y-6 bg-white min-h-screen">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <Button variant="outline" onClick={handleCancel} className="border-slate-300 text-slate-700 hover:bg-slate-50">
          <ArrowLeftIcon className="h-4 w-4 mr-2 text-slate-700" /> Back to Profiles
        </Button>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Create New Network Profile</h1>
      <NetworkProfileForm onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
    </div>
  );
}

