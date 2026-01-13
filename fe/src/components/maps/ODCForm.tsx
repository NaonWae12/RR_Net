"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ODC, CreateODCRequest, UpdateODCRequest } from "@/lib/api/types";
import { useEffect } from "react";

const odcFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  capacity_info: z.string().optional(),
  notes: z.string().optional(),
});

type ODCFormValues = z.infer<typeof odcFormSchema>;

interface ODCFormProps {
  initialData?: ODC;
  onSubmit: (data: CreateODCRequest | UpdateODCRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function ODCForm({ initialData, onSubmit, onCancel, isLoading }: ODCFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ODCFormValues>({
    resolver: zodResolver(odcFormSchema),
    defaultValues: {
      name: "",
      latitude: -6.2088,
      longitude: 106.8456,
      capacity_info: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        latitude: initialData.latitude,
        longitude: initialData.longitude,
        capacity_info: initialData.capacity_info || "",
        notes: initialData.notes || "",
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: ODCFormValues) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Input label="ODC Name" {...register("name")} error={errors.name?.message} />
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
        label="Capacity Info (optional)"
        {...register("capacity_info")}
        error={errors.capacity_info?.message}
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
          {isLoading ? "Saving..." : initialData ? "Update ODC" : "Create ODC"}
        </Button>
      </div>
    </form>
  );
}

