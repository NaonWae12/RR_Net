"use client";

import React, { useState, useEffect } from "react";
import { PlatformInvoice, subscriptionService } from "@/lib/api/subscriptionService";
import { paymentMethodService, PaymentMethod } from "@/lib/api/paymentMethodService";
import { platformDiscountService } from "@/lib/api/platformDiscountService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, CreditCard, Loader2, Wallet, DollarSign, Zap, Copy, Check, Ticket, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useNotificationStore } from "@/stores/notificationStore";
import { cn, formatCurrency } from "@/lib/utils";

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options: Record<string, any>) => void;
    };
  }
}

// Special sentinel ID for Midtrans payment method
const MIDTRANS_METHOD_ID = "__midtrans__";

interface SubscriptionPaymentModalProps {
  invoice?: PlatformInvoice; // For existing invoices (re-payment)
  planData?: {
    id: string;
    name: string;
    price: number;
    currency: string;
  }; // For new upgrades (delayed creation)
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isUpgradeMode?: boolean;
}

export default function SubscriptionPaymentModal({
  invoice: initialInvoice,
  planData,
  isOpen,
  onClose,
  onSuccess,
  isUpgradeMode = false,
}: SubscriptionPaymentModalProps) {
  const [currentInvoice, setCurrentInvoice] = useState<PlatformInvoice | null>(initialInvoice || null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [discountCode, setDiscountCode] = useState("");
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [midtransEnabled, setMidtransEnabled] = useState(false);
  const [isMidtransLoading, setIsMidtransLoading] = useState(false);
  const [paymentCategory, setPaymentCategory] = useState<'manual' | 'instant'>('instant');
  const [instantSubCategory, setInstantSubCategory] = useState<string | null>(null);

  // Local state for "Preview" discount when no invoice yet
  const [previewDiscount, setPreviewDiscount] = useState<{ amount: number; code: string } | null>(null);

  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (isOpen) {
      if (initialInvoice) {
        setCurrentInvoice(initialInvoice);
        setPreviewDiscount(null);
      } else {
        setCurrentInvoice(null);
        setPreviewDiscount(null);
      }

      const fetchMethods = async () => {
        setIsLoadingMethods(true);
        try {
          const methods = await paymentMethodService.listPublic();
          const activeMethods = methods.filter((m) => m.is_active);
          setPaymentMethods(activeMethods);
          
          // Fetch Midtrans config from platform
          const mtConfig = await subscriptionService.getPublicMidtransConfig();
          
          if (mtConfig.enabled && mtConfig.client_key) {
            setMidtransEnabled(true);
            
            // Inject Midtrans Script if not already there
            if (typeof window !== "undefined") {
              if (window.snap) {
                console.log("[Midtrans] SDK already available");
                setSelectedMethodId(MIDTRANS_METHOD_ID);
                setIsMidtransLoading(false);
                return;
              }

              setIsMidtransLoading(true);
              const scriptId = "midtrans-snap-script";
              
              // Remove old script if exists to force reload with new config
              const oldScript = document.getElementById(scriptId);
              if (oldScript) {
                console.log("[Midtrans] Removing old script tag to refresh config");
                oldScript.remove();
                if (typeof (window as any).snap !== "undefined") {
                  delete (window as any).snap;
                }
              }

              console.log("[Midtrans] Injecting fresh script tag with key:", mtConfig.client_key.substring(0, 5) + "...");
              const script = document.createElement("script");
              script.id = scriptId;
              script.setAttribute("data-client-key", mtConfig.client_key);
              script.async = true;
              
              const baseUrl = mtConfig.is_production 
                ? "https://app.midtrans.com/snap/snap.js" 
                : "https://app.sandbox.midtrans.com/snap/snap.js";
              
              console.log("[Midtrans] Loading SDK from:", baseUrl);
              script.src = baseUrl;

              script.onload = () => {
                console.log("[Midtrans] SDK Script loaded successfully");
                let attempts = 0;
                const checkSnap = setInterval(() => {
                  attempts++;
                  if (window.snap) {
                    console.log("[Midtrans] window.snap initialized after", attempts * 50, "ms");
                    clearInterval(checkSnap);
                    setIsMidtransLoading(false);
                    setSelectedMethodId(MIDTRANS_METHOD_ID);
                  } else if (attempts > 40) { 
                    console.warn("[Midtrans] window.snap not found after 2s");
                    clearInterval(checkSnap);
                    setIsMidtransLoading(false);
                  }
                }, 50);
              };

              script.onerror = (err) => {
                console.error("[Midtrans] Failed to load Snap SDK script:", err);
                setIsMidtransLoading(false);
              };

              document.body.appendChild(script);
            }
          } else {
            setMidtransEnabled(false);
            setIsMidtransLoading(false); // Make sure to stop loading if disabled
            if (activeMethods.length > 0) {
              setSelectedMethodId(activeMethods[0].id);
            }
          }
        } catch (error) {
          console.error("Failed to fetch payment methods or Midtrans config:", error);
          showToast({ title: "Error", description: "Failed to load payment options", variant: "error" });
          setIsMidtransLoading(false);
        } finally {
          setIsMidtransLoading(false); 
          setIsLoadingMethods(false);
        }
      };

      fetchMethods();
    }
  }, [isOpen, initialInvoice, showToast]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return;
    setIsApplyingDiscount(true);
    try {
      if (currentInvoice) {
        // Method A: Apply to existing Invoice
        const response = await platformDiscountService.apply(currentInvoice.id, discountCode.toUpperCase());
        const updatedInvoice = response.data || response;
        setCurrentInvoice(updatedInvoice);
      } else if (planData) {
        // Method B: Preview for Plan (Delayed creation)
        const result = await platformDiscountService.validate(discountCode.toUpperCase(), planData.price);
        setPreviewDiscount({ amount: result.discount_amount, code: discountCode.toUpperCase() });
      }
      showToast({ title: "Discount Applied", description: "Your total has been updated!", variant: "success" });
      setDiscountCode("");
    } catch (error: any) {
      const msg = error.response?.data?.error || "Invalid discount code";
      showToast({ title: "Failed", description: msg, variant: "error" });
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  const handleRemoveDiscount = async () => {
    setIsApplyingDiscount(true);
    try {
      if (currentInvoice) {
        const updated = await platformDiscountService.remove(currentInvoice.id);
        setCurrentInvoice(updated);
      } else {
        setPreviewDiscount(null);
      }
      showToast({ title: "Removed", description: "Discount removed", variant: "info" });
    } catch (e: any) {
      showToast({ title: "Error", description: "Failed to remove discount", variant: "error" });
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  if (!isOpen) return null;

  const selectedMethod = paymentMethods.find((m) => m.id === selectedMethodId);
  const isMidtransSelected = selectedMethodId === MIDTRANS_METHOD_ID;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMethodId) {
      showToast({ title: "Error", description: "Please select a payment method", variant: "warning" });
      return;
    }

    setIsSubmitting(true);

    try {
      // --- Midtrans Online Payment Flow ---
      if (isMidtransSelected) {
        let invoiceId = currentInvoice?.id;

        // If no invoice yet (new plan purchase), create it first
        if (!invoiceId && planData) {
          const result = await subscriptionService.purchasePlan({
            plan_id: planData.id,
            billing_cycle: "monthly",
            discount_code: previewDiscount?.code || "",
            method: "midtrans",
          });
          invoiceId = result?.invoice?.id || result?.id;
        }

        if (!invoiceId) {
          throw new Error("Could not determine invoice ID for payment");
        }

        const token = await subscriptionService.getSnapToken(invoiceId, instantSubCategory || "");
        console.log("[Midtrans] Snap token received successfully");

        if (!window.snap) {
          throw new Error("Midtrans Snap SDK not loaded. Please refresh the page or check your connection.");
        }

        window.snap.pay(token, {
          onSuccess: () => {
            showToast({ title: "Payment Successful", description: "Your subscription has been activated!", variant: "success" });
            onSuccess();
            onClose();
          },
          onPending: () => {
            showToast({ title: "Payment Pending", description: "Please complete your payment.", variant: "info" });
            onSuccess();
            onClose();
          },
          onError: () => {
            showToast({ title: "Payment Failed", description: "There was an error processing your payment.", variant: "error" });
          },
          onClose: () => {
            // User closed the popup without paying
            setIsSubmitting(false);
          },
        });
        return; 
      }

      // --- Manual Payment Flow (existing logic) ---
      if (currentInvoice) {
        await subscriptionService.submitPayment({
          invoice_id: currentInvoice.id,
          method: selectedMethod?.name || "manual",
          reference: "Manual Verification Required",
          proof_image_url: "",
        });
      } else if (planData) {
        await subscriptionService.purchasePlan({
          plan_id: planData.id,
          billing_cycle: "monthly",
          discount_code: previewDiscount?.code || "",
          method: selectedMethod?.name || "manual",
        });
      }

      showToast({
        title: "Submission Success",
        description: "Your request has been sent for verification.",
        variant: "success",
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Payment submission error:", error);
      let msg = error.response?.data?.error || error.message || "Failed to submit request";
      
      // Special hint for Midtrans 500 errors (common key mismatch)
      if (isMidtransSelected && error.response?.status === 500) {
        msg = "Midtrans Error: Please check your Client/Server Keys in Super Admin settings. Ensure they match the environment (Sandbox vs Production).";
      }

      showToast({ title: "Error", description: msg, variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMethodIcon = (category: string) => {
    switch (category) {
      case "bank": return <CreditCard className="h-4 w-4" />;
      case "e-wallet": return <Wallet className="h-4 w-4" />;
      case "cash": return <DollarSign className="h-4 w-4" />;
      case "pay later": return <Zap className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  const getInstantIcon = (type: string) => {
    switch (type) {
      case 'bank_transfer': return <CreditCard className="h-4 w-4" />;
      case 'ewallet': return <Wallet className="h-4 w-4" />;
      case 'qris': return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      );
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  // Determine totals based on mode
  const displayAmount = currentInvoice ? currentInvoice.amount : planData ? planData.price - (previewDiscount?.amount || 0) : 0;
  const displaySubtotal = currentInvoice ? currentInvoice.subtotal : planData?.price || 0;
  const hasDiscount = currentInvoice ? (currentInvoice.discount_id ? true : false) : previewDiscount ? true : false;
  const discountAmount = currentInvoice ? currentInvoice.discount_amount : previewDiscount?.amount || 0;
  const invoiceNumber = currentInvoice?.invoice_number || "NEW UPGRADE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-[400px] bg-white rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="bg-slate-900 px-6 py-5 text-white relative">
          <button onClick={onClose} className="absolute right-5 top-5 p-2 hover:bg-white/10 rounded-full transition-all">
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight leading-none mb-1">Payment</h2>
              <p className="text-slate-500 text-[9px] uppercase font-bold tracking-[0.2em]">{invoiceNumber}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total</p>
              <h3 className="text-xl font-black tracking-tighter text-slate-900">{formatCurrency(displayAmount)}</h3>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Summary</p>
              <p className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">
                {currentInvoice ? (currentInvoice.addon_name ? `Add-on: ${currentInvoice.addon_name}` : currentInvoice.plan_name || "Reference Due") : planData?.name}
              </p>
            </div>
          </div>

          {!hasDiscount ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="COUPON?"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  className="h-9 pl-9 rounded-xl border-slate-100 bg-slate-50/50 font-black text-[10px] tracking-widest transition-all uppercase"
                />
              </div>
              <Button
                type="button"
                onClick={handleApplyDiscount}
                disabled={isApplyingDiscount || !discountCode}
                className="h-9 rounded-xl bg-slate-900 hover:bg-black text-[9px] font-black uppercase tracking-widest px-4"
              >
                {isApplyingDiscount ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
              </Button>
            </div>
          ) : (
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 flex items-center justify-between border-dashed">
              <div className="flex items-center gap-2">
                <Ticket className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] font-bold text-emerald-700">Promo: -{formatCurrency(discountAmount)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveDiscount}
                disabled={isApplyingDiscount}
                className="h-6 text-[8px] font-black text-slate-400 hover:text-red-500 hover:bg-red-50 px-2 uppercase transition-colors"
              >
                {isApplyingDiscount ? "..." : "Cancel"}
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-1">Pilih Kategori Pembayaran</label>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                 <button 
                   type="button"
                   disabled={!midtransEnabled}
                   onClick={() => { setPaymentCategory('instant'); setInstantSubCategory(null); setSelectedMethodId(MIDTRANS_METHOD_ID); }}
                   className={cn(
                     "p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center",
                     !midtransEnabled ? "opacity-50 grayscale" : 
                     paymentCategory === 'instant' ? "border-indigo-600 bg-indigo-50" : "border-slate-50 bg-white hover:border-slate-100"
                   )}
                 >
                    <div className={cn("p-2 rounded-xl", paymentCategory === 'instant' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500")}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-[10px] text-slate-900">Instant</div>
                 </button>
                 <button 
                   type="button"
                   onClick={() => { setPaymentCategory('manual'); setInstantSubCategory(null); setSelectedMethodId(""); }}
                   className={cn(
                     "p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center",
                     paymentCategory === 'manual' ? "border-indigo-600 bg-indigo-50" : "border-slate-50 bg-white hover:border-slate-100"
                   )}
                 >
                    <div className={cn("p-2 rounded-xl", paymentCategory === 'manual' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500")}>
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="font-bold text-[10px] text-slate-900">Transfer</div>
                 </button>
              </div>

              {isLoadingMethods ? (
                <div className="py-4 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-200" />
                </div>
              ) : (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  {paymentCategory === 'instant' && (
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Metode Instant</label>
                       <div className="grid grid-cols-3 gap-2">
                         {['bank_transfer', 'ewallet', 'qris'].map((type) => (
                           <button
                             key={type}
                             type="button"
                             onClick={() => setInstantSubCategory(type)}
                             className={cn(
                               "p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5",
                               instantSubCategory === type ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm" : "border-slate-50 bg-white text-slate-400"
                             )}
                           >
                             <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", instantSubCategory === type ? "bg-indigo-600 text-white" : "bg-slate-50")}>
                               {getInstantIcon(type)}
                             </div>
                             <p className="text-[9px] font-bold uppercase">{type.replace('_', ' ')}</p>
                           </button>
                         ))}
                       </div>
                    </div>
                  )}

                  {paymentCategory === 'manual' && (
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Rekening Tujuan</label>
                       <div className="grid grid-cols-1 gap-2">
                         {paymentMethods.map((m) => (
                           <button
                             key={m.id}
                             type="button"
                             onClick={() => setSelectedMethodId(m.id)}
                             className={cn(
                               "flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all relative",
                               selectedMethodId === m.id ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm" : "border-slate-50 bg-white text-slate-400 hover:border-slate-100"
                             )}
                           >
                             <div className="flex items-center gap-3">
                               <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", selectedMethodId === m.id ? "bg-indigo-600 text-white" : "bg-slate-100")}>{getMethodIcon(m.category)}</div>
                               <div>
                                 <span className="text-[10px] font-black uppercase tracking-tight block text-slate-900">{m.name}</span>
                                 <span className="text-[9px] font-medium text-slate-500">{m.provider}</span>
                               </div>
                             </div>
                             {selectedMethodId === m.id && <Check className="h-4 w-4 text-indigo-600" />}
                           </button>
                         ))}
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Show manual transfer details only for non-Midtrans methods */}
            {selectedMethod && !isMidtransSelected && (
              <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-3 shadow-lg">
                <div>
                  <h4 className="text-[8px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Transfer To</h4>
                  <p className="text-sm font-black tracking-tight">{selectedMethod.provider}</p>
                  <p className="text-[9px] font-bold text-white/50 uppercase">{selectedMethod.account_name}</p>
                </div>
                {selectedMethod.account_number && (
                  <div className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5 group hover:bg-white/10 transition-all">
                    <span className="text-[11px] font-mono font-bold">{selectedMethod.account_number}</span>
                    <button type="button" onClick={() => copyToClipboard(selectedMethod.account_number!, "acc")} className="p-1.5 hover:bg-white/10 rounded-lg text-indigo-300 flex items-center gap-1">
                      {copiedId === "acc" ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                      <span className="text-[8px] font-black uppercase">{copiedId === "acc" ? "COPIED" : "COPY"}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Midtrans info box */}
            {isMidtransSelected && (
              <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 space-y-1">
                <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Secure Online Payment</p>
                <p className="text-[9px] text-indigo-500 font-semibold">You will be redirected to the Midtrans payment page. Supports credit card, GoPay, OVO, bank transfer, and more.</p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <div className="flex gap-2 w-full">
                <Button type="button" variant="ghost" onClick={onClose} className="flex-1 h-10 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-400">
                  Cancel
                </Button>
                <Button disabled={isSubmitting || !selectedMethodId || isMidtransLoading} className="flex-[2] h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-100 disabled:opacity-50">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isMidtransSelected ? "Pay Now →" : "Confirm Pay"}
                </Button>
              </div>

              {isUpgradeMode && currentInvoice && (
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm("Are you sure you want to cancel this upgrade?")) {
                      setIsSubmitting(true);
                      try {
                        await subscriptionService.cancelPlanChange(currentInvoice.id);
                        showToast({ title: "Cancelled", description: "Request cancelled.", variant: "info" });
                        onClose();
                        onSuccess();
                      } catch (e) {
                        showToast({ title: "Error", description: "Failed to cancel", variant: "error" });
                      } finally {
                        setIsSubmitting(false);
                      }
                    }
                  }}
                  className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest mt-2 py-2 transition-colors border-t border-slate-50 border-dashed"
                >
                  Cancel Upgrade Request
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
