"use client";

import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plan, CreatePlanRequest, UpdatePlanRequest } from "@/lib/api/types";
import { FeatureSelector } from "./FeatureSelector";

const planFormSchema = z.object({
    code: z.string().min(1, "Code is required"),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    price_monthly: z.coerce.number().min(0),
    price_yearly: z.coerce.number().optional(),
    currency: z.string().default("IDR"),
    limits: z.object({
        max_routers: z.coerce.number().optional(),
        max_users: z.coerce.number().optional(),
        max_vouchers: z.coerce.number().optional(),
        max_clients: z.coerce.number().optional(),
        max_odc: z.coerce.number().optional(),
        max_odp: z.coerce.number().optional(),
        max_client_maps: z.coerce.number().optional(),
        wa_quota_monthly: z.coerce.number().optional(),
        rbac_client_reseller: z.coerce.number().optional(),
    }).passthrough(), // Allow additional limit fields
    features: z.array(z.string()).default([]),
    is_active: z.boolean().default(true),
    is_public: z.boolean().default(true),
    sort_order: z.coerce.number().default(0),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

interface CreateEditPlanFormProps {
    initialData?: Plan;
    onSubmit: (data: CreatePlanRequest | UpdatePlanRequest) => Promise<void>;
    onCancel: () => void;
    isLoading: boolean;
}

export function CreateEditPlanForm({ initialData, onSubmit, onCancel, isLoading }: CreateEditPlanFormProps) {
    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<PlanFormValues>({
        resolver: zodResolver(planFormSchema),
        defaultValues: {
            code: "",
            name: "",
            description: "",
            price_monthly: 0,
            price_yearly: undefined,
            currency: "IDR",
            limits: {
                max_routers: 0,
                max_users: 0,
                max_vouchers: 0,
                max_clients: 0,
                max_odc: 0,
                max_odp: 0,
                max_client_maps: 0,
                wa_quota_monthly: 0,
                rbac_client_reseller: 0,
            },
            features: [],
            is_active: true,
            is_public: true,
            sort_order: 0,
        },
    });

    useEffect(() => {
        if (initialData) {
            reset({
                code: initialData.code,
                name: initialData.name,
                description: initialData.description || "",
                price_monthly: initialData.price_monthly,
                price_yearly: initialData.price_yearly,
                currency: initialData.currency,
                limits: {
                    max_routers: initialData.limits?.max_routers ?? 0,
                    max_users: initialData.limits?.max_users ?? 0,
                    max_vouchers: initialData.limits?.max_vouchers ?? 0,
                    max_clients: initialData.limits?.max_clients ?? 0,
                    max_odc: initialData.limits?.max_odc ?? 0,
                    max_odp: initialData.limits?.max_odp ?? 0,
                    max_client_maps: initialData.limits?.max_client_maps ?? initialData.limits?.max_clients ?? 0,
                    wa_quota_monthly: initialData.limits?.wa_quota_monthly ?? 0,
                    rbac_client_reseller: initialData.limits?.rbac_client_reseller ?? 0,
                },
                features: initialData.features,
                is_active: initialData.is_active,
                is_public: initialData.is_public,
                sort_order: initialData.sort_order,
            });
        }
    }, [initialData, reset]);

    const handleFormSubmit = async (data: PlanFormValues) => {
        // Build limits object from form data
        const limits: Record<string, number> = {};

        // Map form limits to API limits format
        if (data.limits.max_routers !== undefined) limits.max_routers = data.limits.max_routers;
        if (data.limits.max_users !== undefined) limits.max_users = data.limits.max_users;
        if (data.limits.max_vouchers !== undefined) limits.max_vouchers = data.limits.max_vouchers;
        if (data.limits.max_clients !== undefined) limits.max_clients = data.limits.max_clients;
        if (data.limits.max_odc !== undefined) limits.max_odc = data.limits.max_odc;
        if (data.limits.max_odp !== undefined) limits.max_odp = data.limits.max_odp;
        if (data.limits.max_client_maps !== undefined) limits.max_client_maps = data.limits.max_client_maps;
        if (data.limits.wa_quota_monthly !== undefined) limits.wa_quota_monthly = data.limits.wa_quota_monthly;
        
        // Only include rbac_client_reseller limit if the feature is enabled
        const hasRbacClientReseller = data.features.includes("rbac_client_reseller") || data.features.includes("*");
        if (hasRbacClientReseller && data.limits.rbac_client_reseller !== undefined) {
            limits.rbac_client_reseller = data.limits.rbac_client_reseller;
        }
        // Note: If feature is not enabled, we intentionally don't include rbac_client_reseller in limits

        // Preserve any other limits from initial data that weren't in the form
        // But exclude rbac_client_reseller if the feature is not enabled
        if (initialData?.limits) {
            Object.keys(initialData.limits).forEach(key => {
                // Skip rbac_client_reseller if feature is not enabled
                if (key === "rbac_client_reseller" && !hasRbacClientReseller) {
                    return;
                }
                if (!limits.hasOwnProperty(key)) {
                    limits[key] = initialData.limits[key];
                }
            });
        }

        // Features are already in array format from FeatureSelector
        const features = data.features || [];

        await onSubmit({
            ...data,
            limits,
            features,
        });
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                    <Input {...register("code")} error={errors.code?.message} disabled={!!initialData} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <Input {...register("name")} error={errors.name?.message} />
                </div>
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
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Price Monthly</label>
                    <Input
                        type="number"
                        step="0.01"
                        {...register("price_monthly")}
                        error={errors.price_monthly?.message}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Price Yearly (optional)</label>
                    <Input
                        type="number"
                        step="0.01"
                        {...register("price_yearly")}
                        error={errors.price_yearly?.message}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                    <Input {...register("currency")} error={errors.currency?.message} />
                </div>
            </div>

            {/* Limits Section */}
            <div className="space-y-6 border-t pt-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">Plan Limits</h3>
                    <p className="text-sm text-slate-600">Set limits for this plan. Use -1 for unlimited.</p>
                </div>

                {/* Network & Router Limits */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-800 border-b pb-2">Network & Router Limits</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Max Routers</label>
                            <Input
                                type="number"
                                {...register("limits.max_routers", {
                                    setValueAs: (v) => {
                                        const num = parseInt(v, 10);
                                        return isNaN(num) ? undefined : num;
                                    },
                                })}
                                defaultValue={initialData?.limits?.max_routers ?? 0}
                                placeholder="0 or -1 for unlimited"
                                error={errors.limits?.max_routers?.message}
                            />
                        </div>
                    </div>
                </div>

                {/* User Limits */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-800 border-b pb-2">User Limits</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Max Users</label>
                            <Input
                                type="number"
                                {...register("limits.max_users", {
                                    setValueAs: (v) => {
                                        const num = parseInt(v, 10);
                                        return isNaN(num) ? undefined : num;
                                    },
                                })}
                                defaultValue={initialData?.limits?.max_users ?? 0}
                                placeholder="0 or -1 for unlimited"
                                error={errors.limits?.max_users?.message}
                            />
                        </div>
                    </div>
                </div>

                {/* Voucher Limits */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-800 border-b pb-2">Voucher Limits</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Voucher Limit</label>
                            <Input
                                type="number"
                                {...register("limits.max_vouchers", {
                                    setValueAs: (v) => {
                                        const num = parseInt(v, 10);
                                        return isNaN(num) ? undefined : num;
                                    },
                                })}
                                defaultValue={initialData?.limits?.max_vouchers ?? 0}
                                placeholder="0 or -1 for unlimited"
                                error={errors.limits?.max_vouchers?.message}
                            />
                        </div>
                    </div>
                </div>

                {/* Client Limits */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-800 border-b pb-2">Client Limits</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Max Clients</label>
                            <Input
                                type="number"
                                {...register("limits.max_clients", {
                                    setValueAs: (v) => {
                                        const num = parseInt(v, 10);
                                        return isNaN(num) ? undefined : num;
                                    },
                                })}
                                defaultValue={initialData?.limits?.max_clients ?? 0}
                                placeholder="0 or -1 for unlimited"
                                error={errors.limits?.max_clients?.message}
                            />
                        </div>
                    </div>
                </div>

                {/* Maps Limits */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-800 border-b pb-2">Maps Limits</h4>
                    <p className="text-xs text-slate-500 mb-3">Limit jumlah node yang bisa ditambahkan di peta topologi jaringan</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                ODC Maps Limit
                                <span className="ml-2 text-xs font-normal text-slate-500">(Optical Distribution Center)</span>
                            </label>
                            <Input
                                type="number"
                                {...register("limits.max_odc", {
                                    setValueAs: (v) => {
                                        const num = parseInt(v, 10);
                                        return isNaN(num) ? undefined : num;
                                    },
                                })}
                                defaultValue={initialData?.limits?.max_odc ?? 0}
                                placeholder="0 or -1 for unlimited"
                                error={errors.limits?.max_odc?.message}
                            />
                            <p className="text-xs text-slate-500 mt-1">Maksimal jumlah ODC yang bisa ditambahkan di peta</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                ODP Maps Limit
                                <span className="ml-2 text-xs font-normal text-slate-500">(Optical Distribution Point)</span>
                            </label>
                            <Input
                                type="number"
                                {...register("limits.max_odp", {
                                    setValueAs: (v) => {
                                        const num = parseInt(v, 10);
                                        return isNaN(num) ? undefined : num;
                                    },
                                })}
                                defaultValue={initialData?.limits?.max_odp ?? 0}
                                placeholder="0 or -1 for unlimited"
                                error={errors.limits?.max_odp?.message}
                            />
                            <p className="text-xs text-slate-500 mt-1">Maksimal jumlah ODP yang bisa ditambahkan di peta</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Client Maps Limit
                                <span className="ml-2 text-xs font-normal text-slate-500">(Lokasi Pelanggan)</span>
                            </label>
                            <Input
                                type="number"
                                {...register("limits.max_client_maps", {
                                    setValueAs: (v) => {
                                        const num = parseInt(v, 10);
                                        return isNaN(num) ? undefined : num;
                                    },
                                })}
                                defaultValue={initialData?.limits?.max_client_maps ?? initialData?.limits?.max_clients ?? 0}
                                placeholder="0 or -1 for unlimited"
                                error={errors.limits?.max_client_maps?.message}
                            />
                            <p className="text-xs text-slate-500 mt-1">Maksimal jumlah lokasi pelanggan yang bisa ditambahkan di peta</p>
                        </div>
                    </div>
                </div>

                {/* Communication Limits */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-800 border-b pb-2">Communication Limits</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">WA Quota Monthly</label>
                            <Input
                                type="number"
                                {...register("limits.wa_quota_monthly", {
                                    setValueAs: (v) => {
                                        const num = parseInt(v, 10);
                                        return isNaN(num) ? undefined : num;
                                    },
                                })}
                                defaultValue={initialData?.limits?.wa_quota_monthly ?? 0}
                                placeholder="0 or -1 for unlimited"
                                error={errors.limits?.wa_quota_monthly?.message}
                            />
                        </div>
                    </div>
                </div>

                {/* RBAC Limits - Only show if rbac_client_reseller feature is selected */}
                {(() => {
                    const selectedFeatures = watch("features") || [];
                    const hasRbacClientReseller = selectedFeatures.includes("rbac_client_reseller") || selectedFeatures.includes("*");
                    
                    if (!hasRbacClientReseller) return null;
                    
                    return (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-800 border-b pb-2">RBAC Limits</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        RBAC Client / Reseller Limit
                                    </label>
                                    <Input
                                        type="number"
                                        {...register("limits.rbac_client_reseller", {
                                            setValueAs: (v) => {
                                                const num = parseInt(v, 10);
                                                return isNaN(num) ? undefined : num;
                                            },
                                        })}
                                        defaultValue={initialData?.limits?.rbac_client_reseller ?? 0}
                                        placeholder="0 or -1 for unlimited"
                                        error={errors.limits?.rbac_client_reseller?.message}
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Maksimal jumlah client/reseller yang bisa dibuat dengan role reseller</p>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            <div>
                <FeatureSelector
                    value={watch("features") || []}
                    onChange={(codes) => {
                        setValue("features", codes, { shouldValidate: true });
                    }}
                    error={errors.features?.message}
                />
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                    <input type="checkbox" {...register("is_active")} className="rounded border-slate-300" />
                    <label className="text-sm font-medium text-slate-700">Is Active</label>
                </div>
                <div className="flex items-center space-x-2">
                    <input type="checkbox" {...register("is_public")} className="rounded border-slate-300" />
                    <label className="text-sm font-medium text-slate-700">Is Public</label>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                    <Input
                        type="number"
                        {...register("sort_order")}
                        error={errors.sort_order?.message}
                    />
                </div>
            </div>

            <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Saving..." : initialData ? "Update Plan" : "Create Plan"}
                </Button>
            </div>
        </form>
    );
}

