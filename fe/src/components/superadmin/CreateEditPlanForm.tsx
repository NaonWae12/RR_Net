"use client";

import { useEffect } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plan, CreatePlanRequest, UpdatePlanRequest } from "@/lib/api/types";
import { FeatureSelector } from "./FeatureSelector";
import { Activity, CreditCard, Layers, ShieldCheck, Tag, Info, Gauge } from "lucide-react";

const planFormSchema = z.object({
    code: z.string().min(1, "Code is required"),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    price_monthly: z.coerce.number().min(0),
    price_yearly: z.coerce.number().optional(),
    currency: z.string().default("IDR"),
    limits: z.object({
        max_routers: z.coerce.number().optional(),
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
        control,
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
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Main Info, Pricing, Limits */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Basic Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center text-lg">
                                <Tag className="h-5 w-5 mr-2 text-slate-500" />
                                Basic Information
                            </CardTitle>
                            <CardDescription>
                                General details about the plan.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Code"
                                    {...register("code")}
                                    error={errors.code?.message}
                                    disabled={!!initialData}
                                    placeholder="e.g. BASIC_PLAN"
                                />
                                <Input
                                    label="Name"
                                    {...register("name")}
                                    error={errors.name?.message}
                                    placeholder="e.g. Basic Plan"
                                />
                            </div>
                            <Textarea
                                label="Description"
                                {...register("description")}
                                className="min-h-[100px]"
                                placeholder="Describe the plan features and target audience..."
                            />
                        </CardContent>
                    </Card>

                    {/* Pricing */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center text-lg">
                                <CreditCard className="h-5 w-5 mr-2 text-slate-500" />
                                Pricing
                            </CardTitle>
                            <CardDescription>
                                Set the monthly and yearly pricing for this plan.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input
                                    label="Price Monthly"
                                    type="number"
                                    step="0.01"
                                    {...register("price_monthly")}
                                    error={errors.price_monthly?.message}
                                    placeholder="0"
                                />
                                <Input
                                    label="Price Yearly (Optional)"
                                    type="number"
                                    step="0.01"
                                    {...register("price_yearly")}
                                    error={errors.price_yearly?.message}
                                    placeholder="Leave empty if not available"
                                />
                                <Input
                                    label="Currency"
                                    {...register("currency")}
                                    error={errors.currency?.message}
                                    placeholder="IDR"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Limits Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center text-lg">
                                <Gauge className="h-5 w-5 mr-2 text-slate-500" />
                                Plan Limits
                            </CardTitle>
                            <CardDescription>
                                Define usage constraints. Use -1 for unlimited.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Network & Router Limits */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-slate-900 border-b pb-2 flex items-center">
                                    <Activity className="h-4 w-4 mr-2 text-slate-500" />
                                    Network & Router Limits
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Max Routers"
                                        type="number"
                                        {...register("limits.max_routers", {
                                            setValueAs: (v) => (v === "" ? undefined : parseInt(v, 10)),
                                        })}
                                        defaultValue={initialData?.limits?.max_routers ?? 0}
                                        placeholder="0 or -1"
                                        error={errors.limits?.max_routers?.message}
                                    />
                                </div>
                            </div>

                            {/* Client & Voucher Limits */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-slate-900 border-b pb-2 flex items-center">
                                    <Activity className="h-4 w-4 mr-2 text-slate-500" />
                                    Client & Voucher Limits
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Max Clients"
                                        type="number"
                                        {...register("limits.max_clients", {
                                            setValueAs: (v) => (v === "" ? undefined : parseInt(v, 10)),
                                        })}
                                        defaultValue={initialData?.limits?.max_clients ?? 0}
                                        placeholder="0 or -1"
                                        error={errors.limits?.max_clients?.message}
                                    />
                                    <Input
                                        label="Voucher Limit"
                                        type="number"
                                        {...register("limits.max_vouchers", {
                                            setValueAs: (v) => (v === "" ? undefined : parseInt(v, 10)),
                                        })}
                                        defaultValue={initialData?.limits?.max_vouchers ?? 0}
                                        placeholder="0 or -1"
                                        error={errors.limits?.max_vouchers?.message}
                                    />
                                </div>
                            </div>

                            {/* Maps Limits */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-slate-900 border-b pb-2 flex items-center">
                                    <Layers className="h-4 w-4 mr-2 text-slate-500" />
                                    Maps & Infrastructure Limits
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <Input
                                        label="ODC Maps Limit"
                                        info="Optical Distribution Center"
                                        type="number"
                                        {...register("limits.max_odc", {
                                            setValueAs: (v) => (v === "" ? undefined : parseInt(v, 10)),
                                        })}
                                        defaultValue={initialData?.limits?.max_odc ?? 0}
                                        placeholder="0 or -1"
                                        error={errors.limits?.max_odc?.message}
                                    />
                                    <Input
                                        label="ODP Maps Limit"
                                        info="Optical Distribution Point"
                                        type="number"
                                        {...register("limits.max_odp", {
                                            setValueAs: (v) => (v === "" ? undefined : parseInt(v, 10)),
                                        })}
                                        defaultValue={initialData?.limits?.max_odp ?? 0}
                                        placeholder="0 or -1"
                                        error={errors.limits?.max_odp?.message}
                                    />
                                    <Input
                                        label="Client Maps Limit"
                                        info="Customer Locations"
                                        type="number"
                                        {...register("limits.max_client_maps", {
                                            setValueAs: (v) => (v === "" ? undefined : parseInt(v, 10)),
                                        })}
                                        defaultValue={initialData?.limits?.max_client_maps ?? initialData?.limits?.max_clients ?? 0}
                                        placeholder="0 or -1"
                                        error={errors.limits?.max_client_maps?.message}
                                    />
                                </div>
                            </div>

                            {/* Communication Limits */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-slate-900 border-b pb-2 flex items-center">
                                    <Info className="h-4 w-4 mr-2 text-slate-500" />
                                    Communication Limits
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="WA Quota Monthly"
                                        type="number"
                                        {...register("limits.wa_quota_monthly", {
                                            setValueAs: (v) => (v === "" ? undefined : parseInt(v, 10)),
                                        })}
                                        defaultValue={initialData?.limits?.wa_quota_monthly ?? 0}
                                        placeholder="0 or -1"
                                        error={errors.limits?.wa_quota_monthly?.message}
                                    />
                                </div>
                            </div>

                            {/* RBAC Limits */}
                            {(() => {
                                const selectedFeatures = watch("features") || [];
                                const hasRbacClientReseller = selectedFeatures.includes("rbac_client_reseller") || selectedFeatures.includes("*");
                                
                                if (!hasRbacClientReseller) return null;
                                
                                return (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <h4 className="text-sm font-semibold text-slate-900 border-b pb-2 flex items-center">
                                            <ShieldCheck className="h-4 w-4 mr-2 text-purple-500" />
                                            RBAC Limits
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label="RBAC Client / Reseller Limit"
                                                info="Max reseller accounts allowed"
                                                type="number"
                                                {...register("limits.rbac_client_reseller", {
                                                    setValueAs: (v) => (v === "" ? undefined : parseInt(v, 10)),
                                                })}
                                                defaultValue={initialData?.limits?.rbac_client_reseller ?? 0}
                                                placeholder="0 or -1"
                                                error={errors.limits?.rbac_client_reseller?.message}
                                            />
                                        </div>
                                    </div>
                                );
                            })()}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Features, Status, Actions */}
                <div className="space-y-8">
                    {/* Status & Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center text-lg">
                                <Activity className="h-5 w-5 mr-2 text-slate-500" />
                                Status & Settings
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-slate-900">Active Status</label>
                                    <p className="text-xs text-slate-500">Plan is available for use</p>
                                </div>
                                <Controller
                                    control={control}
                                    name="is_active"
                                    render={({ field }) => (
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    )}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium text-slate-900">Public Visibility</label>
                                    <p className="text-xs text-slate-500">Show on public pricing page</p>
                                </div>
                                <Controller
                                    control={control}
                                    name="is_public"
                                    render={({ field }) => (
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    )}
                                />
                            </div>
                            <div className="pt-4 border-t border-slate-100">
                                <Input
                                    label="Sort Order"
                                    type="number"
                                    {...register("sort_order")}
                                    error={errors.sort_order?.message}
                                    placeholder="0"
                                    info="Order in lists (lowest first)"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Features */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center text-lg">
                                <Layers className="h-5 w-5 mr-2 text-slate-500" />
                                Features
                            </CardTitle>
                            <CardDescription>
                                Select available modules.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FeatureSelector
                                value={watch("features") || []}
                                onChange={(codes) => {
                                    setValue("features", codes, { shouldValidate: true });
                                }}
                                error={errors.features?.message}
                            />
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 sticky top-6">
                        <Button type="submit" disabled={isLoading} className="w-full" size="lg">
                            {isLoading ? "Saving..." : initialData ? "Save Changes" : "Create Plan"}
                        </Button>
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="w-full">
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
}

// Helper for parsing int safely
const parseIntSafe = (v: string) => {
    const num = parseInt(v, 10);
    return isNaN(num) ? undefined : num;
};
