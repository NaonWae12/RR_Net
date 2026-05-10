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
import { Slider } from "@/components/ui/slider";
import { 
  Users, 
  Store, 
  User, 
  Save, 
  Info,
  Scale,
  ArrowRightLeft,
  CircleDollarSign
} from "lucide-react";
import { toast } from "@/components/feedback";
import { cn } from "@/lib/utils";

interface FeeConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: any;
  onSave: (share: number) => Promise<void>;
  title?: string;
  description?: string;
}

export function FeeConfigurationModal({ 
  isOpen, 
  onClose, 
  config, 
  onSave,
  title = "Fee Sharing Configuration",
  description = "Decide how the transaction fee is shared."
}: FeeConfigurationModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [customerShare, setCustomerShare] = React.useState(0); // Default 0%

  React.useEffect(() => {
    if (isOpen && config) {
      setCustomerShare(config.customer_share_percent ?? 0);
    }
  }, [isOpen, config]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(customerShare);
      onClose();
    } catch (error: any) {
      console.error("Failed to save fee sharing config:", error);
    } finally {
      setLoading(false);
    }
  };

  const merchantShare = 100 - customerShare;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white border-slate-200 shadow-2xl p-0 overflow-hidden rounded-[2rem]">
        <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="relative z-10 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-indigo-300 mb-4 shadow-xl">
              <Scale size={32} />
            </div>
            <DialogTitle className="text-2xl font-black font-jakarta tracking-tight">{title}</DialogTitle>
            <DialogDescription className="text-indigo-200/70 font-medium">
              {description}
            </DialogDescription>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div className={cn(
              "flex-1 p-4 rounded-2xl border transition-all duration-300 text-center",
              merchantShare > 50 ? "bg-indigo-50 border-indigo-100 shadow-sm" : "bg-slate-50 border-slate-100"
            )}>
              <div className="mx-auto w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm mb-2">
                <Store size={20} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Merchant Pays</p>
              <p className={cn("text-2xl font-black tracking-tighter", merchantShare > 50 ? "text-indigo-600" : "text-slate-700")}>
                {merchantShare}%
              </p>
            </div>

            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
              <ArrowRightLeft size={16} />
            </div>

            <div className={cn(
              "flex-1 p-4 rounded-2xl border transition-all duration-300 text-center",
              customerShare > 50 ? "bg-purple-50 border-purple-100 shadow-sm" : "bg-slate-50 border-slate-100"
            )}>
              <div className="mx-auto w-10 h-10 rounded-full bg-white flex items-center justify-center text-purple-600 shadow-sm mb-2">
                <User size={20} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Pays</p>
              <p className={cn("text-2xl font-black tracking-tighter", customerShare > 50 ? "text-purple-600" : "text-slate-700")}>
                {customerShare}%
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <Label className="text-sm font-bold text-slate-900">Distribution Slider</Label>
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-wider">
                {customerShare === 100 ? "Full Customer" : customerShare === 0 ? "Full Merchant" : "Split Sharing"}
              </span>
            </div>
            <Slider
              value={[customerShare]}
              min={0}
              max={100}
              step={1}
              onValueChange={(vals) => setCustomerShare(vals[0])}
              className="py-4"
            />
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
              <span>0% Customer</span>
              <span>50/50</span>
              <span>100% Customer</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3 items-start">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-[11px] text-amber-900 leading-relaxed font-bold">
                Gross-up Logic Enabled
              </p>
              <p className="text-[10px] text-amber-800/80 leading-relaxed font-medium">
                The total amount will be automatically increased to ensure you receive the exact invoice value after Midtrans deductions.
              </p>
            </div>
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
                Apply Configuration
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
