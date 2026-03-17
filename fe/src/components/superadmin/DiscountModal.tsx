"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Ticket, Percent, DollarSign, Calendar, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CreatePlatformDiscountRequest, PlatformDiscountType } from "@/lib/api/platformDiscountService";

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePlatformDiscountRequest) => Promise<void>;
  initialData?: CreatePlatformDiscountRequest;
  mode: "create" | "edit";
}

export function DiscountModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}: DiscountModalProps) {
  const [formData, setFormData] = useState<CreatePlatformDiscountRequest>({
    code: "",
    name: "",
    description: "",
    type: "percent",
    value: 0,
    min_purchase: 0,
    max_discount: undefined,
    usage_limit: undefined,
    expires_at: undefined,
    is_active: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        code: "",
        name: "",
        description: "",
        type: "percent",
        value: 0,
        min_purchase: 0,
        max_discount: undefined,
        usage_limit: undefined,
        expires_at: undefined,
        is_active: true,
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error("Failed to submit:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                    <Ticket className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      {mode === "create" ? "Add Platform Discount" : "Edit Discount"}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Create promotional coupons for registration and subscriptions
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)] font-jakarta">
                <div className="grid grid-cols-2 gap-6">
                  {/* Discount Code */}
                  <div className="col-span-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2 italic">
                      COUPON CODE *
                    </label>
                    <div className="relative">
                      <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        placeholder="e.g., RAMADAN2026"
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-black tracking-widest text-purple-600"
                      />
                    </div>
                  </div>

                  {/* Discount Name */}
                  <div className="col-span-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      DISCOUNT NAME *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Ramadhan Promo"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-bold"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    DESCRIPTION
                  </label>
                  <textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short details about this promo..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-[80px]"
                  />
                </div>

                {/* Discount Type & Value */}
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Info className="w-5 h-5 text-purple-600" />
                    <h3 className="font-black text-slate-900 italic tracking-tight uppercase">Reward Configuration</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">
                        Type
                      </label>
                      <div className="flex gap-2">
                        {(["percent", "nominal"] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({ ...formData, type })}
                            className={cn(
                              "flex-1 py-3 rounded-xl border-2 transition-all font-bold text-sm flex items-center justify-center gap-2",
                              formData.type === type
                                ? "border-purple-600 bg-white text-purple-600 shadow-md"
                                : "border-transparent bg-slate-200/50 text-slate-500 hover:bg-slate-200"
                            )}
                          >
                            {type === "percent" ? <Percent className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                            {type === "percent" ? "Percentage" : "Fixed Amount"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">
                        Value
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          value={formData.value}
                          onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-black text-lg"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">
                          {formData.type === "percent" ? "%" : "IDR"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">
                        Min. Purchase
                      </label>
                      <input
                        type="number"
                        value={formData.min_purchase}
                        onChange={(e) => setFormData({ ...formData, min_purchase: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-bold"
                      />
                    </div>

                    {formData.type === "percent" && (
                      <div>
                        <label className="block text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">
                          Max. Discount
                        </label>
                        <input
                          type="number"
                          value={formData.max_discount || ""}
                          onChange={(e) => setFormData({ ...formData, max_discount: e.target.value ? parseFloat(e.target.value) : undefined })}
                          placeholder="Unlimited"
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-bold"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Limitations & Expiry */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-tight">
                      Usage Limit
                    </label>
                    <input
                      type="number"
                      value={formData.usage_limit || ""}
                      onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Unlimited usage"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-tight font-jakarta">
                      Expiry Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        value={formData.expires_at ? formData.expires_at.split('T')[0] : ""}
                        onChange={(e) => setFormData({ ...formData, expires_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Active Status */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="font-bold text-slate-700 uppercase tracking-tighter italic">Status Active</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Discount can be used immediately</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={cn(
                      "relative w-14 h-7 rounded-full transition-colors",
                      formData.is_active ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-slate-300"
                    )}
                  >
                    <motion.div
                      animate={{ x: formData.is_active ? 28 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                    />
                  </button>
                </div>
              </form>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="font-bold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="font-black italic uppercase tracking-tighter bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-900/20 px-8 py-6 rounded-2xl h-auto transition-all active:scale-95"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>{mode === "create" ? "Create Discount Code" : "Save Changes"}</>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
