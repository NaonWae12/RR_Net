"use client";

import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import type { SuperAdminTenant, UpdateTenantRequest } from "@/lib/api/types";

const tenantFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  domain: z.string().optional(),
  status: z.enum(["active", "suspended", "pending", "deleted"]).optional(),
});

type TenantFormValues = z.infer<typeof tenantFormSchema>;

interface TenantFormProps {
  initialData?: SuperAdminTenant;
  onSubmit: (data: UpdateTenantRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function TenantForm({ initialData, onSubmit, onCancel, isLoading }: TenantFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      domain: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        slug: initialData.slug,
        domain: initialData.domain || "",
        status: initialData.status,
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: TenantFormValues) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Input label="Name" {...register("name")} error={errors.name?.message} />
      <Input label="Slug" {...register("slug")} error={errors.slug?.message} />
      <Input label="Domain (optional)" {...register("domain")} error={errors.domain?.message} />

      <div>
        <label className="text-sm font-medium text-slate-700">Status</label>
        <SimpleSelect
          value={watch("status") || "active"}
          onValueChange={(value) => setValue("status", value as "active" | "suspended" | "pending" | "deleted")}
          className="w-full"
        >
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
          <option value="deleted">Deleted</option>
        </SimpleSelect>
        {errors.status && <p className="text-xs text-red-500 mt-1">{errors.status.message}</p>}
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Update Tenant"}
        </Button>
      </div>
    </form>
  );
}

