"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NetworkProfile, CreateNetworkProfileRequest, UpdateNetworkProfileRequest, Router } from "@/lib/api/types";
import { useEffect, useState } from "react";
import { networkService } from "@/lib/api/networkService";

const profileFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  router_id: z.string().optional().nullable(),
  description: z.string().optional(),
  download_speed: z.coerce.number().min(1, "Download speed is required"),
  upload_speed: z.coerce.number().min(1, "Upload speed is required"),
  burst_download: z.coerce.number().optional(),
  burst_upload: z.coerce.number().optional(),
  priority: z.coerce.number().min(1).max(8).default(1),
  shared_users: z.coerce.number().optional(),
  address_pool: z.string().optional(),
  dns_servers: z.string().optional(),
  is_active: z.boolean().default(true),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface NetworkProfileFormProps {
  initialData?: NetworkProfile;
  onSubmit: (data: CreateNetworkProfileRequest | UpdateNetworkProfileRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function NetworkProfileForm({ initialData, onSubmit, onCancel, isLoading }: NetworkProfileFormProps) {
  const [routers, setRouters] = useState<Router[]>([]);
  const [routersLoading, setRoutersLoading] = useState(false);

  useEffect(() => {
    const fetchRouters = async () => {
      setRoutersLoading(true);
      try {
        const data = await networkService.getRouters();
        setRouters(data);
      } catch (err) {
        console.error("Failed to fetch routers", err);
      } finally {
        setRoutersLoading(false);
      }
    };
    fetchRouters();
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      router_id: "",
      description: "",
      download_speed: 10000, // 10 Mbps
      upload_speed: 5000, // 5 Mbps
      priority: 1,
      is_active: true,
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        router_id: initialData.router_id || "",
        description: initialData.description || "",
        download_speed: initialData.download_speed,
        upload_speed: initialData.upload_speed,
        burst_download: initialData.burst_download,
        burst_upload: initialData.burst_upload,
        priority: initialData.priority,
        shared_users: initialData.shared_users,
        address_pool: initialData.address_pool || "",
        dns_servers: initialData.dns_servers || "",
        is_active: initialData.is_active,
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: ProfileFormValues) => {
    const payload = {
      ...data,
      router_id: data.router_id === "" ? null : data.router_id,
    };
    await onSubmit(payload as any);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          {initialData ? "Edit Network Profile" : "Create New Network Profile"}
        </h2>
        <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
          <input
            type="checkbox"
            id="is_active"
            {...register("is_active")}
            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 cursor-pointer"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
            Active Status
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <div className="space-y-1.5">
          <Input
            label="Profile Name"
            {...register("name")}
            error={errors.name?.message}
            placeholder="e.g. Profile 10Mbps"
          />
        </div>

        <div className="flex flex-col space-y-1.5">
          <label className="text-sm font-medium text-slate-700 block">Target Router</label>
          <select
            {...register("router_id")}
            disabled={routersLoading}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:bg-slate-50 disabled:text-slate-500 h-10 transition-colors"
          >
            <option value="">Sync to All Routers</option>
            {routers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.host})
              </option>
            ))}
          </select>
          {errors.router_id && <p className="text-xs text-red-500 mt-1">{errors.router_id.message}</p>}
        </div>

        <Input
          label="Download Speed (Kbps)"
          type="number"
          {...register("download_speed")}
          error={errors.download_speed?.message}
        />
        <Input
          label="Upload Speed (Kbps)"
          type="number"
          {...register("upload_speed")}
          error={errors.upload_speed?.message}
        />

        <Input
          label="Burst Download (Kbps)"
          type="number"
          {...register("burst_download")}
          error={errors.burst_download?.message}
          placeholder="Optional"
        />
        <Input
          label="Burst Upload (Kbps)"
          type="number"
          {...register("burst_upload")}
          error={errors.burst_upload?.message}
          placeholder="Optional"
        />

        <Input
          label="Priority (1-8)"
          type="number"
          {...register("priority")}
          error={errors.priority?.message}
        />
        <Input
          label="Shared Users"
          type="number"
          {...register("shared_users")}
          error={errors.shared_users?.message}
          placeholder="Default: 1"
        />

        <Input
          label="Address Pool"
          {...register("address_pool")}
          error={errors.address_pool?.message}
          placeholder="e.g. vpn-pool (Optional)"
        />
        <Input
          label="DNS Servers"
          {...register("dns_servers")}
          error={errors.dns_servers?.message}
          placeholder="e.g. 8.8.8.8, 1.1.1.1 (Optional)"
        />

        <div className="md:col-span-2 space-y-1.5">
          <label className="text-sm font-medium text-slate-700 block">Description</label>
          <textarea
            {...register("description")}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:border-slate-500 transition-all"
            rows={3}
            placeholder="Tell us more about this profile..."
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="border-slate-300 text-slate-700 hover:bg-slate-50">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-slate-900 text-white hover:bg-slate-800">
          {isLoading ? "Saving..." : initialData ? "Update Profile" : "Create Profile"}
        </Button>
      </div>
    </form>
  );
}

