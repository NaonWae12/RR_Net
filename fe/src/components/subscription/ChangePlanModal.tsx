"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { subscriptionService, PlatformInvoice } from "@/lib/api/subscriptionService";
import { LoadingSpinner } from "@/components/utilities";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Shield, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  price_monthly: number;
  currency: string;
  features: string[];
  limits: Record<string, number>;
}

interface ChangePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanId?: string;
  onSuccess: () => void;
  onWaitPayment?: (invoice: PlatformInvoice) => void;
}

export default function ChangePlanModal({ isOpen, onClose, currentPlanId, onSuccess, onWaitPayment }: ChangePlanModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [pendingInvoice, setPendingInvoice] = useState<PlatformInvoice | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlansAndPending();
    }
  }, [isOpen, currentPlanId]);

  const fetchPlansAndPending = async () => {
    setLoading(true);
    try {
      const [plansData, pendingInv] = await Promise.all([
        subscriptionService.getPublicPlans(),
        subscriptionService.getPendingPlanChange()
      ]);
      setPlans(plansData);
      setPendingInvoice(pendingInv);
      
      if (pendingInv) {
        setSelectedPlanId(pendingInv.plan_id);
      } else if (currentPlanId) {
        setSelectedPlanId(currentPlanId);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
      toast.error("Failed to load available plans");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChange = async () => {
    if (!selectedPlanId || selectedPlanId === currentPlanId) return;

    // If we have a pending invoice for THIS plan, just resume
    if (pendingInvoice && pendingInvoice.plan_id === selectedPlanId) {
      if (onWaitPayment) onWaitPayment(pendingInvoice);
      return;
    }

    // New logic: Instead of creating invoice here, just pass the plan info to the next modal
    const plan = plans.find(p => p.id === selectedPlanId);
    if (plan && onWaitPayment) {
      onWaitPayment(plan as any); // Any because we handle both types in the callback
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800 text-white shadow-2xl">
        <DialogHeader>
          <div className="flex justify-between items-start pr-8">
            <div>
              <DialogTitle className="text-2xl font-black flex items-center gap-2 text-white">
                <Sparkles className="h-6 w-6 text-indigo-400" />
                Empower Your Business
              </DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                Choose the architecture that best fits your growing network infrastructure.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {pendingInvoice && (
          <div className="mt-4 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-black text-indigo-100 uppercase tracking-wide">Pending Upgrade Active</p>
                <p className="text-[11px] text-slate-400">You have an outstanding payment for <span className="text-indigo-300 font-bold">{pendingInvoice.plan_name}</span>. Pay now to activate.</p>
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={() => onWaitPayment?.(pendingInvoice)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest px-6"
            >
              Resume Payment
            </Button>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-6">
            {plans.map((p) => {
              const isCurrent = p.id === currentPlanId;
              const isSelected = p.id === selectedPlanId;
              const isPendingForThis = pendingInvoice?.plan_id === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (!isCurrent) {
                      setSelectedPlanId(p.id);
                    }
                  }}
                  className={cn(
                    "relative flex flex-col p-6 rounded-2xl border transition-all cursor-pointer group active:scale-[0.98] select-none",
                    isCurrent
                      ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30 cursor-default"
                      : isSelected
                      ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500 shadow-xl shadow-indigo-500/10"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900"
                  )}
                >
                  {isCurrent && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 hover:bg-emerald-600 font-bold uppercase tracking-widest text-[10px] py-1 shadow-lg shadow-emerald-500/20">
                      CURRENT PLAN
                    </Badge>
                  )}

                  {isPendingForThis && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 hover:bg-indigo-600 font-bold uppercase tracking-widest text-[10px] py-1 shadow-lg shadow-indigo-500/20">
                      WAITING PAYMENT
                    </Badge>
                  )}
                  
                  <div className="mb-6">
                    <h3 className={cn(
                      "font-black text-xl mb-1",
                      isCurrent ? "text-emerald-400" : isSelected ? "text-indigo-400" : "text-white"
                    )}>{p.name}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Business Connectivity</p>
                  </div>

                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: p.currency,
                          minimumFractionDigits: 0,
                        }).format(p.price_monthly)}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">/mo</span>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8 flex-grow">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800 pb-2 flex items-center gap-2">
                      <Zap className="h-3 w-3 text-amber-500" />
                      Key Features
                    </p>
                    <ul className="space-y-3">
                      {p.features.slice(0, 6).map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5 text-xs">
                          <Check className={cn("h-4 w-4 shrink-0 mt-0.5", isCurrent ? "text-emerald-500" : "text-indigo-400")} />
                          <span className="text-slate-300 leading-tight font-medium">
                            {feat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                        </li>
                      ))}
                      {p.features.length > 6 && (
                        <li className="text-[10px] font-bold text-slate-500 italic pl-6 pt-1">
                          + {p.features.length - 6} more capabilities
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="mt-auto space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-black/30 border border-slate-800 transition-colors">
                      <Shield className="h-4 w-4 text-indigo-400" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {p.limits.max_routers || 0} Routers | {p.limits.max_clients || 0} Clients
                      </p>
                    </div>
                    
                    <Button 
                      variant="ghost"
                      className={cn(
                        "w-full font-bold text-xs uppercase tracking-widest h-10 transition-all border",
                        isCurrent 
                          ? "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed" 
                          : isPendingForThis
                          ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/50"
                          : isSelected
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-lg shadow-indigo-500/20"
                          : "bg-transparent text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
                      )}
                    >
                      {isCurrent ? "Active" : isPendingForThis ? "Resume Pay" : isSelected ? "Selected" : "Select Architecture"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="border-t border-slate-800 pt-6 gap-2">
          <Button variant="ghost" onClick={onClose} className="font-bold text-slate-400 hover:text-white hover:bg-slate-900 border-none transition-colors">
            Cancel
          </Button>
          <Button
            onClick={handleRequestChange}
            disabled={!selectedPlanId || selectedPlanId === currentPlanId || submitting}
            className={cn(
              "font-black px-8 shadow-xl transition-all disabled:opacity-50",
              selectedPlanId === currentPlanId 
                ? "bg-slate-800 text-slate-500" 
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
            )}
          >
            {submitting ? "Processing..." : selectedPlanId === currentPlanId ? "CURRENT PLAN" : pendingInvoice && pendingInvoice.plan_id === selectedPlanId ? "RESUME UPGRADE" : "UPGRADE ARCHITECTURE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
