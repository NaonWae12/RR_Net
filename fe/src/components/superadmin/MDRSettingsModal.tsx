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
import { 
  Percent, 
  DollarSign, 
  Save, 
  ShieldCheck, 
  Zap, 
  Info,
  QrCode,
  CreditCard,
  Smartphone,
  Building2
} from "lucide-react";
import { toast } from "@/components/feedback";
import { superAdminService } from "@/lib/api/superAdminService";
import { cn } from "@/lib/utils";

interface MDRSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: any;
  onUpdate: () => void;
}

export function MDRSettingsModal({ isOpen, onClose, config, onUpdate }: MDRSettingsModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [mdr, setMDR] = React.useState({
    qris: 0.7,
    bank_transfer: 4000,
    e_wallet: 1.5,
    credit_card: 2.9,
  });

  React.useEffect(() => {
    if (isOpen && config?.mdr) {
      setMDR({
        qris: config.mdr.qris || 0.7,
        bank_transfer: config.mdr.bank_transfer || 4000,
        e_wallet: config.mdr.e_wallet || 1.5,
        credit_card: config.mdr.credit_card || 2.9,
      });
    }
  }, [isOpen, config]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const updatedConfig = {
        ...config,
        mdr: {
          qris: Number(mdr.qris),
          bank_transfer: Number(mdr.bank_transfer),
          e_wallet: Number(mdr.e_wallet),
          credit_card: Number(mdr.credit_card),
        }
      };
      await superAdminService.updateMidtransConfig(updatedConfig);
      toast({
        type: "success",
        title: "MDR Updated",
        message: "Global Midtrans MDR settings have been updated successfully."
      });
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error("Failed to save MDR config:", error);
      toast({
        type: "error",
        title: "Save Failed",
        message: error.message || "Failed to update MDR configuration."
      });
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { key: "qris", name: "QRIS", icon: QrCode, type: "percent", desc: "Commonly 0.7% for regular merchants" },
    { key: "bank_transfer", name: "Bank Transfer", icon: Building2, type: "fixed", desc: "Fixed fee, usually IDR 4,000" },
    { key: "e_wallet", name: "E-Wallet", icon: Smartphone, type: "percent", desc: "GoPay, ShopeePay, etc. (1.5% - 2%)" },
    { key: "credit_card", name: "Credit Card", icon: CreditCard, type: "percent", desc: "Visa/Mastercard (approx. 2.9%)" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white border-slate-200 shadow-2xl p-0 overflow-hidden rounded-[2rem]">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-purple-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black font-jakarta tracking-tight">MDR Configuration</DialogTitle>
                <DialogDescription className="text-slate-400 font-medium">
                  Set global Midtrans Merchant Discount Rates.
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid gap-5">
            {categories.map((cat) => (
              <div key={cat.key} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-purple-100 hover:bg-purple-50/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-purple-600 transition-colors">
                    <cat.icon size={20} />
                  </div>
                  <div>
                    <Label className="text-sm font-bold text-slate-900">{cat.name}</Label>
                    <p className="text-[10px] text-slate-400 font-medium">{cat.desc}</p>
                  </div>
                </div>
                <div className="relative w-32">
                  <Input 
                    type="number"
                    step={cat.type === "percent" ? "0.1" : "1"}
                    className="pl-8 pr-4 py-2 font-black text-slate-900 rounded-xl border-slate-200 focus:ring-purple-500"
                    value={mdr[cat.key as keyof typeof mdr]}
                    onChange={(e) => setMDR({ ...mdr, [cat.key]: e.target.value })}
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {cat.type === "percent" ? <Percent size={14} /> : <span className="text-[10px] font-bold">Rp</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex gap-3 items-start">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
              These rates represent the <strong>actual cost</strong> charged by Midtrans. The system uses these values to calculate the Gross-up total for customers.
            </p>
          </div>
        </div>

        <DialogFooter className="p-8 pt-0 flex gap-3">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="flex-1 rounded-2xl font-bold text-slate-500 hover:bg-slate-100">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="flex-[2] rounded-2xl bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-200 font-bold transition-all hover:scale-[1.02] active:scale-95"
          >
            {loading ? "Saving..." : (
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save MDR Settings
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
