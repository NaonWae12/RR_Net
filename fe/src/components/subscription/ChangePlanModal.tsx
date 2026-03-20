"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { subscriptionService } from "@/lib/api/subscriptionService";
import { LoadingSpinner } from "@/components/utilities";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Shield, Sparkles } from "lucide-react";
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
}

export default function ChangePlanModal({ isOpen, onClose, currentPlanId, onSuccess }: ChangePlanModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen, currentPlanId]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await subscriptionService.getPublicPlans();
      setPlans(data);
      if (currentPlanId) {
        setSelectedPlanId(currentPlanId);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
      toast.error("Failed to load available plans");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!selectedPlanId || selectedPlanId === currentPlanId) return;

    setSubmitting(true);
    try {
      await subscriptionService.changeMyPlan(selectedPlanId);
      toast.success("Plan updated successfully!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to change plan:", error);
      toast.error("Failed to update plan. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black flex items-center gap-2 text-white">
            <Sparkles className="h-6 w-6 text-indigo-400" />
            Empower Your Business
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Choose the architecture that best fits your growing network infrastructure.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-20 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-6">
            {plans.map((p) => {
              const isCurrent = p.id === currentPlanId;
              const isSelected = p.id === selectedPlanId;

              return (
                <div
                  key={p.id}
                  className={cn(
                    "relative flex flex-col p-6 rounded-2xl border transition-all cursor-pointer group hover:shadow-2xl",
                    isCurrent
                      ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                      : isSelected
                      ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900"
                  )}
                  onClick={() => setSelectedPlanId(p.id)}
                >
                  {isCurrent && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 hover:bg-emerald-600 font-bold uppercase tracking-widest text-[10px] py-1 shadow-lg shadow-emerald-500/20">
                      CURRENT PLAN
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

                  <div className="mt-auto">
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-black/30 border border-slate-800 group-hover:border-slate-700 transition-colors">
                       <Shield className="h-4 w-4 text-indigo-400" />
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {p.limits.max_routers || 0} Routers | {p.limits.max_clients || 0} Clients
                       </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="border-t border-slate-800 pt-6 gap-2">
          <Button variant="ghost" onClick={onClose} className="font-bold text-slate-400 hover:text-white hover:bg-slate-900">
            Cancel
          </Button>
          <Button
            onClick={handleChangePlan}
            disabled={!selectedPlanId || selectedPlanId === currentPlanId || submitting}
            className={cn(
              "font-black px-8 shadow-xl transition-all disabled:opacity-50",
              selectedPlanId === currentPlanId 
                ? "bg-slate-800 text-slate-500" 
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
            )}
          >
            {submitting ? "Processing..." : selectedPlanId === currentPlanId ? "CURRENT PLAN" : "UPGRADE ARCHITECTURE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
