'use client';

import React, { useState, useEffect } from 'react';
import { PlatformInvoice, subscriptionService } from '@/lib/api/subscriptionService';
import { paymentMethodService, PaymentMethod } from '@/lib/api/paymentMethodService';
import { platformDiscountService } from '@/lib/api/platformDiscountService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, CreditCard, Loader2, Wallet, DollarSign, Zap, Copy, Check, Ticket } from 'lucide-react';
import { format } from 'date-fns';
import { useNotificationStore } from '@/stores/notificationStore';
import { cn, formatCurrency } from '@/lib/utils';

interface SubscriptionPaymentModalProps {
  invoice: PlatformInvoice;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubscriptionPaymentModal({ 
  invoice: initialInvoice, 
  isOpen, 
  onClose, 
  onSuccess 
}: SubscriptionPaymentModalProps) {
  const [currentInvoice, setCurrentInvoice] = useState<PlatformInvoice>(initialInvoice);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [discountCode, setDiscountCode] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (isOpen) {
      setCurrentInvoice(initialInvoice);
      const fetchMethods = async () => {
        setIsLoadingMethods(true);
        try {
          const methods = await paymentMethodService.listPublic();
          const activeMethods = methods.filter(m => m.is_active);
          setPaymentMethods(activeMethods);
          if (activeMethods.length > 0) {
            setSelectedMethodId(activeMethods[0].id);
          }
        } catch (error) {
          console.error("Failed to fetch payment methods:", error);
          showToast({ title: "Error", description: "Failed to load payment methods", variant: "error" });
        } finally {
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
      const response = await platformDiscountService.apply(currentInvoice.id, discountCode.toUpperCase());
      const updatedInvoice = response.data || response;
      setCurrentInvoice(updatedInvoice);
      showToast({ title: "Discount Applied", description: "Your total has been updated!", variant: "success" });
      setDiscountCode('');
    } catch (error: unknown) {
      const msg = (error as any).response?.data?.error || "Invalid discount code";
      showToast({ title: "Failed", description: msg, variant: "error" });
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  if (!isOpen) return null;

  const selectedMethod = paymentMethods.find(m => m.id === selectedMethodId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMethodId) {
      showToast({ title: "Error", description: "Please select a payment method", variant: "warning" });
      return;
    }

    setIsSubmitting(true);

    try {
      await subscriptionService.submitPayment({
        invoice_id: currentInvoice.id,
        method: selectedMethod?.name || "manual",
        reference: "Manual Verification Required", // Default placeholder since it's removed from UI
        proof_image_url: "" 
      });
      
      showToast({ 
        title: "Payment Submitted", 
        description: "Your payment info has been sent for verification.", 
        variant: "success" 
      });
      
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const msg = (error as any).response?.data?.error || "Failed to submit payment";
      showToast({ title: "Error", description: msg, variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMethodIcon = (category: string) => {
    switch (category) {
      case 'bank': return <CreditCard className="h-4 w-4" />;
      case 'e-wallet': return <Wallet className="h-4 w-4" />;
      case 'cash': return <DollarSign className="h-4 w-4" />;
      case 'pay later': return <Zap className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-[400px] bg-white rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Compact Header */}
        <div className="bg-slate-900 px-6 py-5 text-white relative">
          <button 
            onClick={onClose}
            className="absolute right-5 top-5 p-2 hover:bg-white/10 rounded-full transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight leading-none mb-1">Payment</h2>
              <p className="text-slate-500 text-[9px] uppercase font-bold tracking-[0.2em]">{currentInvoice.invoice_number}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Super Compact Summary */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total</p>
              <h3 className="text-xl font-black tracking-tighter text-slate-900">
                {formatCurrency(currentInvoice.amount)}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Due</p>
              <p className="text-[10px] font-bold text-slate-600">{format(new Date(currentInvoice.due_date), "MMM d, yyyy")}</p>
            </div>
          </div>

          {/* Discount Section - More compact */}
          {!currentInvoice.discount_id ? (
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
                {isApplyingDiscount ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Apply'}
              </Button>
            </div>
          ) : (
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 flex items-center justify-between border-dashed">
              <div className="flex items-center gap-2">
                <Ticket className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] font-bold text-emerald-700">Promo: -{formatCurrency(currentInvoice.discount_amount)}</p>
              </div>
              <span className="text-[8px] font-black text-emerald-600 uppercase">Applied</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Method Grid - Smaller Items */}
            <div className="space-y-2.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-1">Method</label>
              <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMethodId(m.id)}
                    className={cn(
                      "flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-left transition-all relative",
                      selectedMethodId === m.id 
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm" 
                        : "border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-100"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                      selectedMethodId === m.id ? "bg-indigo-600 text-white" : "bg-white text-slate-300 border border-slate-100"
                    )}>
                      {getMethodIcon(m.category)}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tight truncate">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Destination Details - More Compact */}
            {selectedMethod && (
              <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-3 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-[8px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Transfer To</h4>
                    <p className="text-sm font-black tracking-tight">{selectedMethod.provider}</p>
                    <p className="text-[9px] font-bold text-white/50 uppercase">{selectedMethod.account_name}</p>
                  </div>
                </div>
                
                {selectedMethod.account_number && (
                  <div className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5 group hover:bg-white/10 transition-all">
                    <span className="text-[11px] font-mono font-bold">{selectedMethod.account_number}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedMethod.account_number!, 'acc')}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-indigo-300 flex items-center gap-1"
                    >
                      {copiedId === 'acc' ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                      <span className="text-[8px] font-black uppercase">{copiedId === 'acc' ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="flex-1 h-10 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-400"
              >
                Cancel
              </Button>
              <Button
                disabled={isSubmitting || !selectedMethodId}
                className="flex-[2] h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Confirm Pay'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
