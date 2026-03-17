"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils/styles";
import { 
    User, 
    Box, 
    Zap, 
    MapPin, 
    MessageSquare, 
    Settings2, 
    Database,
    ZapOff,
    Radar
} from "lucide-react";

import type { Client } from "@/lib/api/clientService";
import type { ConnectionType, CreateClientLocationRequest, UpdateClientLocationRequest, ODC, ODP, ClientLocation } from "@/lib/api/types";

const clientLocationSchema = z.object({
    client_id: z.string().min(1, "Client is required"),
    odp_id: z.string().min(1, "ODP is required"),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    connection_type: z.enum(["pppoe", "hotspot", "static"]),
    signal_info: z.string().optional(),
    notes: z.string().optional(),
    reseller_radius: z.coerce.number().min(0).default(0),
});

type Values = z.infer<typeof clientLocationSchema>;

export function ClientLocationForm(props: {
    clients: Client[];
    odps: ODP[];
    odcs?: ODC[];
    initialData?: ClientLocation;
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
    isLoading: boolean;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const presetLat = parseFloat(searchParams.get("lat") || "") || -6.2088;
    const presetLng = parseFloat(searchParams.get("lng") || "") || 106.8456;

    const { clients, odps, odcs = [], initialData, onSubmit, onCancel, isLoading } = props;
    const isEdit = !!initialData;
    const [odcShortcutEnabled, setOdcShortcutEnabled] = useState(false);
    const [selectedOdcId, setSelectedOdcId] = useState<string>("");

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<Values>({
        resolver: zodResolver(clientLocationSchema),
        defaultValues: {
            client_id: initialData?.client_id || "",
            odp_id: initialData?.odp_id || "",
            latitude: initialData?.latitude || presetLat,
            longitude: initialData?.longitude || presetLng,
            connection_type: initialData?.connection_type || "pppoe",
            signal_info: initialData?.signal_info || "",
            notes: initialData?.notes || "",
            reseller_radius: initialData?.reseller_radius || 0,
        },
    });

    useEffect(() => {
        if (initialData) {
            reset({
                client_id: initialData.client_id,
                odp_id: initialData.odp_id,
                latitude: initialData.latitude,
                longitude: initialData.longitude,
                connection_type: initialData.connection_type,
                signal_info: initialData.signal_info || "",
                notes: initialData.notes || "",
                reseller_radius: initialData.reseller_radius || 0,
            });
        }
    }, [initialData, reset]);

    // Auto-set Connection Type when client is selected from CRM data
    const clientId = watch("client_id");
    useEffect(() => {
        if (!clientId) return;
        const client = clients.find((c) => c.id === clientId);
        if (client && client.connection_type) {
            // If client is already registered as PPPoE or Hotspot in CRM, auto-select it
            setValue("connection_type", client.connection_type as any);
        }
    }, [clientId, clients, setValue]);
    
    const selectedClient = useMemo(() => clients.find(c => c.id === clientId), [clientId, clients]);
    const isReseller = selectedClient?.is_reseller || initialData?.is_reseller;

    const filteredOdps = useMemo(() => {
        if (!odcShortcutEnabled || !selectedOdcId) return odps;
        return odps.filter((o) => o.odc_id === selectedOdcId);
    }, [odps, odcShortcutEnabled, selectedOdcId]);

    // If ODC filter changes and current ODP doesn't match, clear it.
    useEffect(() => {
        if (!odcShortcutEnabled) return;
        const currentOdpId = watch("odp_id");
        if (!currentOdpId) return;
        const stillValid = filteredOdps.some((o) => o.id === currentOdpId);
        if (!stillValid) {
            setValue("odp_id", "");
        }
    }, [filteredOdps, odcShortcutEnabled, setValue, watch]);

    // QoL: if ODP chosen, default lat/lng to the ODP's location (only for new creations)
    useEffect(() => {
        if (isEdit) return;
        const odpId = watch("odp_id");
        if (!odpId) return;
        const odp = odps.find((o) => o.id === odpId);
        if (!odp) return;
        setValue("latitude", odp.latitude);
        setValue("longitude", odp.longitude);
    }, [odps, setValue, watch, isEdit]);

    return (
        <form onSubmit={handleSubmit(async (v) => onSubmit(v))} className="space-y-8">
            {/* Step 1: Client Selection */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-tight text-sm">
                    <User className="h-4 w-4 text-indigo-500" />
                    Subscriber Info
                </div>
                <div>
                    <SimpleSelect
                        value={watch("client_id")}
                        onValueChange={(value) => setValue("client_id", value)}
                        className="w-full h-12 bg-white border-slate-200 text-slate-700"
                    >
                        <option value="">Select Registered Client</option>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.client_code} — {c.name}
                            </option>
                        ))}
                    </SimpleSelect>
                    {errors.client_id && <p className="text-xs text-red-500 mt-1">{errors.client_id.message}</p>}
                </div>
            </div>

            {/* Step 2: Infrastructure Selection */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-tight text-sm">
                        <Database className="h-4 w-4 text-emerald-500" />
                        Network Termination
                    </div>
                    <div className="flex items-center gap-2">
                        {odcs.length > 0 && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setOdcShortcutEnabled((v) => !v)}
                                disabled={isLoading}
                                className={cn(
                                    "h-8 rounded-full transition-all",
                                    odcShortcutEnabled ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "text-slate-500"
                                )}
                            >
                                <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                                {odcShortcutEnabled ? "Hide ODC Filter" : "Filter by ODC"}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {odcShortcutEnabled && odcs.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-left-2 duration-200">
                            <SimpleSelect
                                value={selectedOdcId}
                                onValueChange={(value) => setSelectedOdcId(value)}
                                className="w-full h-11 bg-indigo-50/30 border-indigo-100"
                            >
                                <option value="">Filter: All ODCs</option>
                                {odcs.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        ODC: {o.name}
                                    </option>
                                ))}
                            </SimpleSelect>
                        </div>
                    )}

                    <div className={cn(!odcShortcutEnabled && "md:col-span-2")}>
                        <SimpleSelect
                            value={watch("odp_id")}
                            onValueChange={(value) => setValue("odp_id", value)}
                            className="w-full h-11 bg-white border-slate-200"
                        >
                            <option value="">Select Target ODP</option>
                            {filteredOdps.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.name}
                                </option>
                            ))}
                        </SimpleSelect>
                        {errors.odp_id && <p className="text-xs text-red-500 mt-1">{errors.odp_id.message}</p>}
                    </div>
                </div>
            </div>

            {/* Step 3: Location & Technicals */}
            <div className="space-y-6 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-tight text-sm">
                    <MapPin className="h-4 w-4 text-rose-500" />
                    Geospatial & Technicals
                </div>

                <div className="grid grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                    <Input
                        label="Latitude"
                        type="number"
                        step="any"
                        {...register("latitude")}
                        error={errors.latitude?.message}
                        className="bg-white"
                    />
                    <Input
                        label="Longitude"
                        type="number"
                        step="any"
                        {...register("longitude")}
                        error={errors.longitude?.message}
                        className="bg-white"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-1">Connection Type</label>
                        <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100 transition-all hover:ring-indigo-200 group">
                            <span className="flex items-center gap-3">
                                {watch("connection_type") ? (
                                    <>
                                        <div className={cn(
                                            "p-1.5 rounded-lg shadow-sm group-hover:scale-110 transition-transform",
                                            watch("connection_type") === "pppoe" ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                                        )}>
                                            <Zap className="h-4 w-4 fill-current" />
                                        </div>
                                        <span className="font-bold text-slate-700 tracking-tight">
                                            {watch("connection_type").toUpperCase()}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-slate-400 text-xs italic flex items-center gap-2 italic">
                                        <ZapOff className="h-3.5 w-3.5" /> Wait for Selection
                                    </span>
                                )}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                CRM PROFILE
                            </span>
                        </div>
                        {errors.connection_type && <p className="text-xs text-red-500 mt-1">{errors.connection_type.message}</p>}
                    </div>

                    <Input 
                        label="Signal Info" 
                        placeholder="e.g. -19dBm, 20km fiber"
                        {...register("signal_info")} 
                        error={errors.signal_info?.message} 
                        className="h-12"
                    />
                </div>

                {isReseller && (
                    <div className="space-y-4 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 text-indigo-900 font-bold uppercase tracking-tight text-xs mb-2">
                            <Radar className="h-4 w-4 text-indigo-600 animate-pulse" />
                            Reseller Jangkauan (Radius)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div className="space-y-2">
                                <Input
                                    label="Jangkauan Radius (Meter)"
                                    type="number"
                                    {...register("reseller_radius")}
                                    error={errors.reseller_radius?.message}
                                    placeholder="e.g. 500"
                                    className="bg-white h-12"
                                />
                                <p className="text-[10px] text-indigo-500 font-medium ml-1">
                                    Visual radius akan ditampilkan di peta untuk area jangkauan reseller ini.
                                </p>
                            </div>
                            <div className="pb-2">
                                <div className="p-3 bg-white rounded-xl border border-indigo-100 flex items-center gap-3">
                                    <div className="text-xl font-bold text-indigo-700">
                                        {watch("reseller_radius") || 0}m
                                    </div>
                                    <div className="h-4 w-[1px] bg-indigo-100" />
                                    <div className="text-[10px] text-slate-500 leading-tight">
                                        Coverage area: <br/>
                                        <span className="font-bold">~{(Math.PI * Math.pow(Number(watch("reseller_radius") || 0), 2) / 1000000).toFixed(2)} km²</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-2 pt-2">
                    <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                        Notes (Internal Only)
                    </label>
                    <textarea
                        {...register("notes")}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500/50 transition-all bg-white"
                        rows={3}
                        placeholder="Add some context about this deployment..."
                    />
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={onCancel} 
                    disabled={isLoading}
                    className="px-6 h-12 text-slate-500 hover:text-slate-900 font-bold"
                >
                    Discard
                </Button>
                <Button 
                    type="submit" 
                    disabled={isLoading} 
                    className={cn(
                        "px-10 h-12 rounded-xl font-bold tracking-wide shadow-lg shadow-indigo-100 transition-all active:scale-95",
                        isEdit ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200" : "bg-slate-900 hover:bg-black shadow-slate-300"
                    )}
                >
                    {isLoading ? (
                        <span className="flex items-center gap-2 italic opacity-80">
                            <span className="animate-pulse">Processing...</span>
                        </span>
                    ) : (
                        isEdit ? "Save Changes" : "Confirm & Deploy"
                    )}
                </Button>
            </div>
        </form>
    );
}


