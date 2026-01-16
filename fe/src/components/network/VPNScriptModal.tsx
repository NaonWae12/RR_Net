"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Terminal, CheckCircle2 } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";

interface VPNScriptModalProps {
    isOpen: boolean;
    onClose: () => void;
    script: string;
    routerName: string;
}

export function VPNScriptModal({ isOpen, onClose, script, routerName }: VPNScriptModalProps) {
    const { showToast } = useNotificationStore();

    const copyToClipboard = () => {
        navigator.clipboard.writeText(script);
        showToast({
            title: "Copied!",
            description: "MikroTik script copied to clipboard.",
            variant: "success",
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] text-slate-900 bg-slate-200">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Terminal className="h-5 w-5 text-indigo-600" />
                        MikroTik Setup Script
                    </DialogTitle>
                    <DialogDescription>
                        Copy and paste this script into your MikroTik terminal to connect router <span className="font-bold text-indigo-700">{routerName}</span> to the VPN.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 relative bg-slate-950 rounded-lg p-4 font-mono text-xs text-emerald-400 overflow-auto max-h-[300px] border border-slate-800">
                    <pre className="whitespace-pre-wrap">{script}</pre>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-2 right-2 h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                        onClick={copyToClipboard}
                    >
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>

                <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                    <div className="flex gap-2">
                        <CheckCircle2 className="h-4 w-4 text-indigo-600 mt-0.5" />
                        <div className="text-xs text-indigo-800">
                            <p className="font-semibold">Setup Instructions:</p>
                            <ol className="list-decimal ml-4 mt-1 space-y-1">
                                <li>Open Winbox and connect to your MikroTik.</li>
                                <li>Open <b>New Terminal</b>.</li>
                                <li>Paste the script above and press Enter.</li>
                                <li>Verify connection in <b>PPP → Interface</b>.</li>
                            </ol>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700">
                        Done, Back to List
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
