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
import { 
    MapPin, 
    ArrowLeft, 
    Info, 
    AlertCircle,
    UserPlus,
    ChevronRight,
    Home
} from "lucide-react";
import { cn } from "@/lib/utils/styles";

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
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Modern Breadcrumbs & Back Button */}
                <div className="flex flex-col gap-4">
                    <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-widest">
                        <Home className="h-3 w-3" />
                        <ChevronRight className="h-3 w-3" />
                        <span>Maps</span>
                        <ChevronRight className="h-3 w-3" />
                        <span className="text-indigo-600">Client Location</span>
                    </nav>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={handleCancel}
                                className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 transition-all text-slate-600 hover:text-indigo-600 group"
                                title="Back to Maps"
                            >
                                <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
                            </button>
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 rounded-lg">
                                        <UserPlus className="h-6 w-6 text-indigo-600" />
                                    </div>
                                    Create Client Location
                                </h1>
                                <p className="text-slate-500 text-sm mt-1">Assign a registered client to a physical map location & ODP</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Important Status / Warning */}
                {odps.length === 0 && !loading && (
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="text-sm">
                            <p className="font-bold">No ODPs available!</p>
                            <p className="opacity-80">You need to create at least one ODP first before you can assign a client location.</p>
                        </div>
                    </div>
                )}

                {/* Main Form Card */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50/50 border-b border-slate-100 p-6 flex items-center gap-2 text-slate-600 font-semibold text-sm">
                        <Info className="h-4 w-4 text-indigo-500" />
                        Location Details
                    </div>
                    <div className="p-8 md:p-10">
                        <ClientLocationForm
                            clients={clients}
                            odps={odps}
                            odcs={odcs}
                            onSubmit={handleSubmit}
                            onCancel={handleCancel}
                            isLoading={isBusy}
                        />
                    </div>
                </div>

                {/* Footer Info */}
                <div className="text-center text-slate-400 text-xs">
                    <p>© 2026 ERP Net Infrastructure System — Network Intelligence Module</p>
                </div>
            </div>
        </div>
    );
}
