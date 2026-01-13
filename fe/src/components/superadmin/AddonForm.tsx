"use client";

import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { Addon, CreateAddonRequest, UpdateAddonRequest } from "@/lib/api/types";

const addonFormSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  billing_cycle: z.enum(["one_time", "monthly", "yearly"]),
  currency: z.string().default("IDR"),
  addon_type: z.enum(["limit_boost", "feature"]),
  value: z.record(z.string(), z.any()).default({}),
  is_active: z.boolean().default(true),
  available_for_plans: z.array(z.string()).default([]),
});

type AddonFormValues = z.infer<typeof addonFormSchema>;

interface AddonFormProps {
  initialData?: Addon;
  onSubmit: (data: CreateAddonRequest | UpdateAddonRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function AddonForm({ initialData, onSubmit, onCancel, isLoading }: AddonFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddonFormValues>({
    resolver: zodResolver(addonFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      price: 0,
      billing_cycle: "monthly",
      currency: "IDR",
      addon_type: "limit_boost",
      value: {},
      is_active: true,
      available_for_plans: [],
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code,
        name: initialData.name,
        description: initialData.description || "",
        price: initialData.price,
        billing_cycle: initialData.billing_cycle,
        currency: initialData.currency,
        addon_type: initialData.addon_type,
        value: initialData.value,
        is_active: initialData.is_active,
        available_for_plans: initialData.available_for_plans,
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: AddonFormValues) => {
    // Parse JSON and array fields
    let value = {};
    try {
      const valueText = (document.querySelector('textarea[name="value"]') as HTMLTextAreaElement)?.value || "{}";
      value = JSON.parse(valueText);
    } catch {
      value = data.value || {};
    }

    let availableForPlans: string[] = [];
    try {
      const plansText = (document.querySelector('textarea[name="available_for_plans"]') as HTMLTextAreaElement)?.value || "";
      availableForPlans = plansText.split("\n").filter((p) => p.trim());
    } catch {
      availableForPlans = data.available_for_plans || [];
    }

    await onSubmit({
      ...data,
      value,
      available_for_plans: availableForPlans,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Code" {...register("code")} error={errors.code?.message} disabled={!!initialData} />
        <Input label="Name" {...register("name")} error={errors.name?.message} />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Description</label>
        <textarea
          {...register("description")}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Price"
          type="number"
          step="0.01"
          {...register("price")}
          error={errors.price?.message}
        />
        <div>
          <label className="text-sm font-medium text-slate-700">Billing Cycle</label>
          <SimpleSelect
            value={watch("billing_cycle")}
            onValueChange={(value) => setValue("billing_cycle", value as "one_time" | "monthly" | "yearly")}
            className="w-full"
          >
            <option value="one_time">One Time</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </SimpleSelect>
        </div>
        <Input label="Currency" {...register("currency")} error={errors.currency?.message} />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Addon Type</label>
        <SimpleSelect
          value={watch("addon_type")}
          onValueChange={(value) => setValue("addon_type", value as "limit_boost" | "feature")}
          className="w-full"
        >
          <option value="limit_boost">Limit Boost</option>
          <option value="feature">Feature</option>
        </SimpleSelect>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Value (JSON format)</label>
        <textarea
          {...register("value")}
          defaultValue={initialData ? JSON.stringify(initialData.value, null, 2) : "{}"}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          rows={4}
          placeholder='{"add_routers": 5, "add_users": 100}'
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700">Available for Plans (one per line)</label>
        <textarea
          {...register("available_for_plans")}
          defaultValue={initialData ? initialData.available_for_plans.join("\n") : ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
          rows={3}
          placeholder="plan_code_1&#10;plan_code_2"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input type="checkbox" {...register("is_active")} className="rounded border-slate-300" />
        <label className="text-sm font-medium text-slate-700">Is Active</label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : initialData ? "Update Addon" : "Create Addon"}
        </Button>
      </div>
    </form>
  );
}

