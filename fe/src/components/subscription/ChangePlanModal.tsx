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
  }, [isOpen]);

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-500" />
            Empower Your Business
          </DialogTitle>
          <DialogDescription className="text-slate-500">
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
                    "relative flex flex-col p-6 rounded-2xl border transition-all cursor-pointer group hover:shadow-xl",
                    isCurrent
                      ? "border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500"
                      : isSelected
                      ? "border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500"
                      : "border-slate-200 hover:border-indigo-300"
                  )}
                  onClick={() => setSelectedPlanId(p.id)}
                >
                  {isCurrent && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 font-bold uppercase tracking-wider">
                      Current Plan
                    </Badge>
                  )}
                  
                  <div className="mb-6">
                    <h3 className="font-black text-xl text-slate-900 mb-1">{p.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">Business Scale Connectivity</p>
                  </div>

                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-indigo-600">
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: p.currency,
                          minimumFractionDigits: 0,
                        }).format(p.price_monthly)}
                      </span>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">/mo</span>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8 flex-grow">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                      <Zap className="h-3 w-3 text-amber-500" />
                      Key Features
                    </p>
                    <ul className="space-y-2.5">
                      {p.features.slice(0, 5).map((feat) => (
                        <li key={feat} className="flex items-start gap-2.5 text-sm">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-slate-600 leading-tight">
                            {feat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                        </li>
                      ))}
                      {p.features.length > 5 && (
                        <li className="text-[10px] font-bold text-slate-400 italic pl-6 text-center">
                          + {p.features.length - 5} more capabilities
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="mt-auto">
                    <div className="flex items-center gap-2 mb-4 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100">
                       <Shield className="h-4 w-4 text-indigo-400" />
                       <p className="text-[10px] font-medium text-slate-500">
                          {p.limits.max_routers || 0} Routers | {p.limits.max_clients || 0} Clients
                       </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="border-t pt-6 gap-2">
          <Button variant="ghost" onClick={onClose} className="font-bold">
            Cancel
          </Button>
          <Button
            onClick={handleChangePlan}
            disabled={!selectedPlanId || selectedPlanId === currentPlanId || submitting}
            className="bg-indigo-600 hover:bg-indigo-700 font-black px-8 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
          >
            {submitting ? "Processing..." : isCurrent ? "Current Plan" : "Upgrade Architecture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
