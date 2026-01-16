"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Copy, Globe, Power } from "lucide-react";
import { useNetworkStore } from "@/stores/networkStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { Router } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { cn } from "@/lib/utils";

interface RemoteAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    router: Router;
}

export function RemoteAccessModal({ isOpen, onClose, router }: RemoteAccessModalProps) {
    const { toggleRemoteAccess } = useNetworkStore();
    const { showToast } = useNotificationStore();
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(false);

    // Sync state with router prop when modal opens
    useEffect(() => {
        if (isOpen) {
            setEnabled(!!router.remote_access_enabled);
        }
    }, [isOpen, router]);

    const handleSave = async () => {
        // Only proceed if state changed
        if (enabled === !!router.remote_access_enabled) {
            onClose();
            return;
        }

        setLoading(true);
        try {
            await toggleRemoteAccess(router.id, enabled);
            showToast({
                title: enabled ? "Remote Access Enabled" : "Remote Access Disabled",
                description: enabled
                    ? "Port forwarding rules have been applied."
                    : "Remote access has been revoked.",
                variant: "success",
            });
            onClose();
        } catch (error: any) {
            showToast({
                title: "Failed to update settings",
                description: error.message || "An unexpected error occurred.",
                variant: "error",
            });
            // Revert state on error
            setEnabled(!!router.remote_access_enabled);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast({
            title: "Copied!",
            description: "Address copied to clipboard.",
            variant: "success",
        });
    };

    const publicIP = "72.60.74.209"; // Ideally this comes from config or backend
    const port = router.remote_access_port || "Pending..."; // Pending until backend assigns it
    const fullAddress = typeof port === 'number' ? `${publicIP}:${port}` : "Waiting for assignment...";

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
            <DialogContent className="sm:max-w-md text-slate-900 bg-slate-200">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-indigo-600" />
                        Configure Remote Access
                    </DialogTitle>
                    <DialogDescription>
                        Enable access to this router from outside the VPN network.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    {/* Toggle Section */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium text-slate-900">Enable Remote Access</label>
                            <div className="text-xs text-slate-500">
                                {enabled ? "Status: Active" : "Status: Inactive"}
                            </div>
                        </div>
                        <Switch
                            checked={enabled}
                            onCheckedChange={setEnabled}
                            disabled={loading}
                            className="data-[state=checked]:bg-indigo-600"
                        />
                    </div>

                    {/* Details Section - Only show if enabled (or enabling) */}
                    {enabled && (
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 space-y-3">
                            <h4 className="text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-2">
                                Access Details
                            </h4>

                            <div className="grid grid-cols-3 gap-2 text-sm">
                                <div className="text-slate-500">Public IP:</div>
                                <div className="col-span-2 font-mono text-slate-700">{publicIP}</div>

                                <div className="text-slate-500">Port:</div>
                                <div className="col-span-2 font-mono text-slate-700">
                                    {router.remote_access_port ? (
                                        <span className="text-emerald-600 font-bold">{router.remote_access_port}</span>
                                    ) : (
                                        <span className="flex items-center text-amber-600">
                                            <LoadingSpinner size={12} className="mr-2" /> Assigning...
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-indigo-100">
                                <div className="flex items-center justify-between bg-white border border-indigo-200 rounded p-2">
                                    <code className="text-xs font-mono text-indigo-900 truncate flex-1">
                                        {fullAddress}
                                    </code>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 ml-2 text-slate-400 hover:text-indigo-600"
                                        onClick={() => typeof port === 'number' && copyToClipboard(`${publicIP}:${port}`)}
                                        disabled={typeof port !== 'number'}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <p className="text-xs text-indigo-600/80 mt-2">
                                <span className="font-semibold">Note:</span> Use this address to connect via Winbox or WebFig directly from the internet.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-between">
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                        {loading && <LoadingSpinner size={16} className="mr-2" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
