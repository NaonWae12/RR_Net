"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";

import type { Client } from "@/lib/api/clientService";
import type { ConnectionType, CreateClientLocationRequest, ODC, ODP } from "@/lib/api/types";

const clientLocationSchema = z.object({
    client_id: z.string().min(1, "Client is required"),
    odp_id: z.string().min(1, "ODP is required"),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    connection_type: z.enum(["pppoe", "hotspot", "static"]),
    signal_info: z.string().optional(),
    notes: z.string().optional(),
});

type Values = z.infer<typeof clientLocationSchema>;

export function ClientLocationForm(props: {
    clients: Client[];
    odps: ODP[];
    odcs?: ODC[];
    onSubmit: (data: CreateClientLocationRequest) => Promise<void>;
    onCancel: () => void;
    isLoading: boolean;
}) {
    const router = useRouter();
    const { clients, odps, odcs = [], onSubmit, onCancel, isLoading } = props;
    const [odcShortcutEnabled, setOdcShortcutEnabled] = useState(false);
    const [selectedOdcId, setSelectedOdcId] = useState<string>("");

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<Values>({
        resolver: zodResolver(clientLocationSchema),
        defaultValues: {
            client_id: "",
            odp_id: "",
            latitude: -6.2088,
            longitude: 106.8456,
            connection_type: "pppoe",
            signal_info: "",
            notes: "",
        },
    });

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

    // QoL: if ODP chosen, default lat/lng to the ODP's location
    useEffect(() => {
        const odpId = watch("odp_id");
        if (!odpId) return;
        const odp = odps.find((o) => o.id === odpId);
        if (!odp) return;
        setValue("latitude", odp.latitude);
        setValue("longitude", odp.longitude);
    }, [odps, setValue, watch]);

    return (
        <form onSubmit={handleSubmit(async (v) => onSubmit(v))} className="space-y-4">
            <div>
                <label className="text-sm font-medium text-slate-700">Client</label>
                <SimpleSelect
                    value={watch("client_id")}
                    onValueChange={(value) => setValue("client_id", value)}
                    className="w-full"
                >
                    <option value="">Select Client</option>
                    {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.client_code} — {c.name}
                        </option>
                    ))}
                </SimpleSelect>
                {errors.client_id && <p className="text-xs text-red-500 mt-1">{errors.client_id.message}</p>}
            </div>

            <div>
                <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-slate-700">ODP</label>
                    <div className="flex items-center gap-2">
                        {odcs.length > 0 && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setOdcShortcutEnabled((v) => !v)}
                                disabled={isLoading}
                                title="Shortcut: filter ODP list by selecting an ODC first"
                            >
                                {odcShortcutEnabled ? "Hide ODC Shortcut" : "Shortcut to ODC"}
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => router.push("/maps/odcs")}
                            disabled={isLoading}
                            title="Open ODC list"
                        >
                            ODC List
                        </Button>
                    </div>
                </div>

                {odcShortcutEnabled && odcs.length > 0 && (
                    <div className="mt-2">
                        <label className="text-sm font-medium text-slate-700">ODC (shortcut)</label>
                        <SimpleSelect
                            value={selectedOdcId}
                            onValueChange={(value) => setSelectedOdcId(value)}
                            className="w-full"
                        >
                            <option value="">All ODCs</option>
                            {odcs.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.name}
                                </option>
                            ))}
                        </SimpleSelect>
                    </div>
                )}

                <SimpleSelect
                    value={watch("odp_id")}
                    onValueChange={(value) => setValue("odp_id", value)}
                    className="w-full mt-2"
                >
                    <option value="">Select ODP</option>
                    {filteredOdps.map((o) => (
                        <option key={o.id} value={o.id}>
                            {o.name}
                        </option>
                    ))}
                </SimpleSelect>
                {errors.odp_id && <p className="text-xs text-red-500 mt-1">{errors.odp_id.message}</p>}
            </div>

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

            <div>
                <label className="text-sm font-medium text-slate-700">Connection Type</label>
                <SimpleSelect
                    value={watch("connection_type")}
                    onValueChange={(value) => setValue("connection_type", value as ConnectionType)}
                    className="w-full"
                >
                    <option value="pppoe">PPPoE</option>
                    <option value="hotspot">Hotspot</option>
                    <option value="static">Static</option>
                </SimpleSelect>
                {errors.connection_type && <p className="text-xs text-red-500 mt-1">{errors.connection_type.message}</p>}
            </div>

            <Input label="Signal Info (optional)" {...register("signal_info")} error={errors.signal_info?.message} />

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
                    {isLoading ? "Saving..." : "Create Client Location"}
                </Button>
            </div>
        </form>
    );
}


