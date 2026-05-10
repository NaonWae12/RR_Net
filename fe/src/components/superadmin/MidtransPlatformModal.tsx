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
import { Key, Globe, Info, Save, ShieldAlert, Zap } from "lucide-react";
import { toast } from "sonner";
import { superAdminService } from "@/lib/api/superAdminService";

interface MidtransPlatformModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MidtransPlatformModal({ isOpen, onClose }: MidtransPlatformModalProps) {
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
          const config = await superAdminService.getMidtransConfig();
          setMerchantId(config.merchant_id || "");
          setClientKey(config.client_key || "");
          setServerKey(config.server_key || "");
          setIsProduction(config.is_production || false);
          setIsEnabled(config.enabled || false);
        } catch (error) {
          console.error("Failed to fetch Midtrans platform config:", error);
          toast.error("Failed to load Midtrans configuration");
        }
      };
      fetchConfig();
    }
  }, [isOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await superAdminService.updateMidtransConfig({
        merchant_id: merchantId,
        client_key: clientKey,
        server_key: serverKey,
        is_production: isProduction,
        enabled: isEnabled,
      });
      toast.success("Platform Midtrans configuration updated!");
      onClose();
    } catch (error) {
      console.error("Failed to save Midtrans platform config:", error);
      toast.error("Failed to save Midtrans configuration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white border-slate-200 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-600 text-white shadow-lg shadow-purple-200">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">Platform Payment Gateway</DialogTitle>
              <DialogDescription className="text-slate-500">
                Configure Midtrans for platform-to-tenant billing.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-purple-50/50 border border-purple-100">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold text-slate-900">Enable Automated Billing</Label>
              <p className="text-xs text-slate-500">Allow tenants to pay subscriptions online.</p>
            </div>
            <Switch 
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              className="data-[state=checked]:bg-purple-600"
            />
          </div>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-slate-700">Merchant ID</Label>
              <Input 
                placeholder="Merchant ID from Midtrans" 
                className="bg-white border-slate-200 focus:ring-purple-500"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-slate-700">Client Key</Label>
              <Input 
                placeholder="Mid-client-..." 
                className="bg-white border-slate-200 focus:ring-purple-500 font-mono text-xs"
                value={clientKey}
                onChange={(e) => setClientKey(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-slate-700">Server Key</Label>
              <Input 
                type="password"
                placeholder="Mid-server-..." 
                className="bg-white border-slate-200 focus:ring-purple-500 font-mono text-xs"
                value={serverKey}
                onChange={(e) => setServerKey(e.target.value)}
              />
            </div>
          </div>

          {/* Environment Switcher */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700">Environment Mode</Label>
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
                Sandbox
              </button>
              <button
                type="button"
                onClick={() => setIsProduction(true)}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  isProduction 
                  ? "bg-white text-purple-600 shadow-sm border border-slate-200" 
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
                <strong>Platform Warning:</strong> You are in Production mode. All tenant subscription payments will be processed through your real Midtrans account.
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
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 shadow-lg shadow-purple-200 font-bold"
          >
            {loading ? "Saving..." : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Update Configuration
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
