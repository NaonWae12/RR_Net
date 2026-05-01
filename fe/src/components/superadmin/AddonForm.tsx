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
        // We use the data.value from the form which is now managed by fields
        await onSubmit(data);
    };

    const addonType = watch("addon_type");

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <Input 
                        label="Addon Code" 
                        {...register("code")} 
                        error={errors.code?.message} 
                        disabled={!!initialData}
                        placeholder="e.g. EXTRA_ROUTER_5"
                    />
                    <Input 
                        label="Display Name" 
                        {...register("name")} 
                        error={errors.name?.message} 
                        placeholder="e.g. Extra 5 Routers"
                    />
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Description</label>
                        <textarea
                            {...register("description")}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 min-h-[100px]"
                            placeholder="Describe what this addon provides..."
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Price"
                            type="number"
                            step="0.01"
                            {...register("price")}
                            error={errors.price?.message}
                        />
                        <Input label="Currency" {...register("currency")} error={errors.currency?.message} />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Billing Cycle</label>
                        <SimpleSelect
                            value={watch("billing_cycle")}
                            onValueChange={(value) => setValue("billing_cycle", value as "one_time" | "monthly" | "yearly")}
                            className="w-full"
                        >
                            <option value="one_time">One Time Payment</option>
                            <option value="monthly">Monthly Subscription</option>
                            <option value="yearly">Yearly Subscription</option>
                        </SimpleSelect>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Addon Type</label>
                        <SimpleSelect
                            value={watch("addon_type")}
                            onValueChange={(value) => {
                                setValue("addon_type", value as "limit_boost" | "feature");
                                if (value === "feature") {
                                    setValue("value", { feature: "" });
                                } else {
                                    setValue("value", { add_routers: 0, add_clients: 0, add_wa_quota: 0 });
                                }
                            }}
                            className="w-full"
                        >
                            <option value="limit_boost">Limit Boost (Extra Routers/Clients/WA)</option>
                            <option value="feature">Feature Unlock</option>
                        </SimpleSelect>
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Addon Configuration</h3>
                
                {addonType === "limit_boost" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-xl border border-slate-100">
                        <Input
                            label="Extra Routers"
                            type="number"
                            {...register("value.add_routers", { valueAsNumber: true })}
                            placeholder="0"
                            info="Number of extra routers"
                        />
                        <Input
                            label="Extra Clients"
                            type="number"
                            {...register("value.add_clients", { valueAsNumber: true })}
                            placeholder="0"
                            info="Number of extra clients"
                        />
                        <Input
                            label="Extra WA Quota"
                            type="number"
                            {...register("value.add_wa_quota", { valueAsNumber: true })}
                            placeholder="0"
                            info="Number of extra WA messages"
                        />
                    </div>
                ) : (
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                        <Input
                            label="Feature Code"
                            {...register("value.feature")}
                            placeholder="e.g. advance_analytics"
                            info="Enter the feature code to unlock"
                        />
                    </div>
                )}
            </div>

            <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Availability</h3>
                <p className="text-sm text-slate-500 mb-4">Specify which plans can use this addon. Leave empty for all plans.</p>
                <textarea
                    {...register("available_for_plans", {
                        setValueAs: (v) => (typeof v === 'string' ? v.split("\n").filter(p => p.trim()) : v)
                    })}
                    defaultValue={initialData ? initialData.available_for_plans.join("\n") : ""}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 min-h-[80px]"
                    placeholder="plan_code_1&#10;plan_code_2"
                />
            </div>

            <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-lg">
                <input type="checkbox" {...register("is_active")} className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-950" />
                <label className="text-sm font-medium text-slate-700">Enable this addon immediately</label>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="px-8">
                    {isLoading ? "Saving..." : initialData ? "Update Addon" : "Create Addon"}
                </Button>
            </div>
        </form>
    );
}

