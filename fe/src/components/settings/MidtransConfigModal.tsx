"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Key, Globe, Info, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { integrationService } from "@/lib/api/integrationService";

interface MidtransConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MidtransConfigModal({ isOpen, onClose }: MidtransConfigModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [isProduction, setIsProduction] = React.useState(false);
  const [isEnabled, setIsEnabled] = React.useState(false);
  const [merchantId, setMerchantId] = React.useState("");
  const [clientKey, setClientKey] = React.useState("");
  const [serverKey, setServerKey] = React.useState("");

  React.useEffect(() => {
    if (isOpen) {
      const fetchConfig = async () => {
        try {
          const config = await integrationService.getMidtransConfig();
          setMerchantId(config.merchant_id || "");
          setClientKey(config.client_key || "");
          setServerKey(config.server_key || "");
          setIsProduction(config.is_production || false);
          setIsEnabled(config.enabled || false);
        } catch (error) {
          console.error("Failed to fetch Midtrans config:", error);
          toast.error("Failed to load Midtrans configuration");
        }
      };
      fetchConfig();
    }
  }, [isOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await integrationService.updateMidtransConfig({
        merchant_id: merchantId,
        client_key: clientKey,
        server_key: serverKey,
        is_production: isProduction,
        enabled: isEnabled,
      });
      toast.success("Midtrans configuration saved successfully!");
      onClose();
    } catch (error) {
      console.error("Failed to save Midtrans config:", error);
      toast.error("Failed to save Midtrans configuration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">Midtrans Configuration</DialogTitle>
              <DialogDescription className="text-slate-500">
                Set up your payment gateway credentials.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold text-slate-900">Enable Online Payment</Label>
              <p className="text-xs text-slate-500">Activate Midtrans for client invoices.</p>
            </div>
            <Switch 
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              className="data-[state=checked]:bg-indigo-600"
            />
          </div>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                Merchant ID
                <Info className="w-3 h-3 text-slate-400" />
              </Label>
              <Input 
                placeholder="e.g. G123456789" 
                className="bg-white border-slate-200 focus:ring-indigo-500"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-slate-700">Client Key</Label>
              <Input 
                placeholder="SB-Mid-client-..." 
                className="bg-white border-slate-200 focus:ring-indigo-500 font-mono text-xs"
                value={clientKey}
                onChange={(e) => setClientKey(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-slate-700">Server Key</Label>
              <Input 
                type="password"
                placeholder="SB-Mid-server-..." 
                className="bg-white border-slate-200 focus:ring-indigo-500 font-mono text-xs"
                value={serverKey}
                onChange={(e) => setServerKey(e.target.value)}
              />
            </div>
          </div>

          {/* Environment Switcher */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              Environment Mode
            </Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setIsProduction(false)}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  !isProduction 
                  ? "bg-white text-amber-600 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <ShieldAlert className="w-3 h-3" />
                Sandbox (Test)
              </button>
              <button
                type="button"
                onClick={() => setIsProduction(true)}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isProduction 
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Globe className="w-3 h-3" />
                Production
              </button>
            </div>
          </div>

          {isProduction && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex gap-3 items-start">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-800 leading-relaxed">
                <strong>Important:</strong> In production mode, real financial transactions will occur. Ensure your keys are from the Midtrans Production Dashboard.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between border-t border-slate-100 pt-4 mt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="text-slate-500 hover:bg-slate-50">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 shadow-lg shadow-indigo-200"
          >
            {loading ? "Saving..." : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
