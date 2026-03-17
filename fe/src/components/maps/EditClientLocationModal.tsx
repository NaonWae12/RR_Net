"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ClientLocationForm } from "./ClientLocationForm";
import { ClientLocation, UpdateClientLocationRequest, ODC, ODP } from "@/lib/api/types";
import { useMapsStore } from "@/stores/mapsStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { clientService, type Client } from "@/lib/api/clientService";

interface EditClientLocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientLocation: ClientLocation | null;
    odcs: ODC[];
    odps: ODP[];
}

export function EditClientLocationModal({
    isOpen,
    onClose,
    clientLocation,
    odcs,
    odps,
}: EditClientLocationModalProps) {
    const { updateClientLocation, loading } = useMapsStore();
    const { showToast } = useNotificationStore();
    const [clients, setClients] = useState<Client[]>([]);
    const [loadingClients, setLoadingClients] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoadingClients(true);
            clientService
                .getClients({ page: 1, page_size: 500 })
                .then((res) => {
                    setClients(res.data ?? []);
                })
                .catch((err) => {
                    console.error("Failed to load clients", err);
                })
                .finally(() => {
                    setLoadingClients(false);
                });
        }
    }, [isOpen]);

    const handleSubmit = async (data: UpdateClientLocationRequest) => {
        if (!clientLocation) return;
        try {
            await updateClientLocation(clientLocation.id, data);
            showToast({
                title: "Location updated",
                description: "Client location has been updated successfully.",
                variant: "success",
            });
            onClose();
        } catch (err: any) {
            showToast({
                title: "Failed to update location",
                description: err?.message || "An unexpected error occurred.",
                variant: "error",
            });
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Edit Location: ${clientLocation?.client_name || 'Client'}`}
            className="bg-white max-w-2xl"
        >
            <div className="mt-2">
                <ClientLocationForm
                    clients={clients}
                    odps={odps}
                    odcs={odcs}
                    initialData={clientLocation || undefined}
                    onSubmit={handleSubmit}
                    onCancel={onClose}
                    isLoading={loading || loadingClients}
                />
            </div>
        </Modal>
    );
}
