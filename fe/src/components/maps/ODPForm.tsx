"use client";

import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { ODP, CreateODPRequest, UpdateODPRequest, ODC } from "@/lib/api/types";

const odpFormSchema = z.object({
  odc_id: z.string().min(1, "ODC is required"),
  name: z.string().min(1, "Name is required"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  port_count: z.coerce.number().min(1).default(8),
  notes: z.string().optional(),
});

type ODPFormValues = z.infer<typeof odpFormSchema>;

interface ODPFormProps {
  initialData?: ODP;
  odcs: ODC[];
  onSubmit: (data: CreateODPRequest | UpdateODPRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function ODPForm({ initialData, odcs, onSubmit, onCancel, isLoading }: ODPFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ODPFormValues>({
    resolver: zodResolver(odpFormSchema),
    defaultValues: {
      odc_id: "",
      name: "",
      latitude: -6.2088,
      longitude: 106.8456,
      port_count: 8,
      notes: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        odc_id: initialData.odc_id,
        name: initialData.name,
        latitude: initialData.latitude,
        longitude: initialData.longitude,
        port_count: initialData.port_count,
        notes: initialData.notes || "",
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: ODPFormValues) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700">ODC</label>
        <SimpleSelect
          value={watch("odc_id")}
          onValueChange={(value) => setValue("odc_id", value)}
          className="w-full"
        >
          <option value="">Select ODC</option>
          {odcs.map((odc) => (
            <option key={odc.id} value={odc.id}>
              {odc.name}
            </option>
          ))}
        </SimpleSelect>
        {errors.odc_id && <p className="text-xs text-red-500 mt-1">{errors.odc_id.message}</p>}
      </div>
      <Input label="ODP Name" {...register("name")} error={errors.name?.message} />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Latitude"
          type="number"
          step="any"
          {...register("latitude")}
          error={errors.latitude?.message}
        />
        <Input
          label="Longitude"
          type="number"
          step="any"
          {...register("longitude")}
          error={errors.longitude?.message}
        />
      </div>
      <Input
        label="Port Count"
        type="number"
        {...register("port_count")}
        error={errors.port_count?.message}
      />
      <div>
        <label className="text-sm font-medium text-slate-700">Notes (optional)</label>
        <textarea
          {...register("notes")}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          rows={3}
        />
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : initialData ? "Update ODP" : "Create ODP"}
        </Button>
      </div>
    </form>
  );
}

