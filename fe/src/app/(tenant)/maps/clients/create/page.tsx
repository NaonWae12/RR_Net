"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";

import { Button } from "@/components/ui/button";
import { ClientLocationForm } from "@/components/maps/ClientLocationForm";
import { useMapsStore } from "@/stores/mapsStore";
import { useNotificationStore } from "@/stores/notificationStore";

import { clientService, type Client } from "@/lib/api/clientService";
import type { CreateClientLocationRequest } from "@/lib/api/types";

export default function CreateClientLocationPage() {
    const router = useRouter();
    const { showToast } = useNotificationStore();

    const { createClientLocation, fetchODPs, fetchODCs, odps, odcs, loading } = useMapsStore();
    const [clients, setClients] = useState<Client[]>([]);
    const [loadingClients, setLoadingClients] = useState(false);

    useEffect(() => {
        fetchODPs();
        fetchODCs();
    }, [fetchODPs, fetchODCs]);

    useEffect(() => {
        let cancelled = false;
        setLoadingClients(true);

        clientService
            .getClients({ page: 1, page_size: 200 })
            .then((res) => {
                if (cancelled) return;
                setClients(res.data ?? []);
            })
            .catch((err: any) => {
                if (cancelled) return;
                showToast({
                    title: "Failed to load clients",
                    description: err?.message || "An unexpected error occurred.",
                    variant: "error",
                });
            })
            .finally(() => {
                if (cancelled) return;
                setLoadingClients(false);
            });

        return () => {
            cancelled = true;
        };
    }, [showToast]);

    const handleSubmit = async (data: CreateClientLocationRequest) => {
        try {
            await createClientLocation(data);
            showToast({
                title: "Client location created",
                description: "Client location has been added to the map.",
                variant: "success",
            });
            router.push("/maps");
        } catch (err: any) {
            showToast({
                title: "Failed to create client location",
                description: err?.message || "An unexpected error occurred.",
                variant: "error",
            });
        }
    };

    const handleCancel = () => router.push("/maps");

    const isBusy = loading || loadingClients;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="outline" onClick={handleCancel}>
                    <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Maps
                </Button>
            </div>

            <h1 className="text-2xl font-bold text-slate-900">Create Client Location</h1>

            {odps.length === 0 && !loading && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    You have no ODPs yet. Create an ODP first, then you can assign a client to it.
                </div>
            )}

            <ClientLocationForm
                clients={clients}
                odps={odps}
                odcs={odcs}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isLoading={isBusy}
            />
        </div>
    );
}


