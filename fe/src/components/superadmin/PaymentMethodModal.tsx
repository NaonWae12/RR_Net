"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaymentMethodFormData {
  name: string;
  category: "bank" | "cash" | "e-wallet";
  provider?: string;
  account_number?: string;
  account_name?: string;
  is_active: boolean;
}

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentMethodFormData) => Promise<void>;
  initialData?: PaymentMethodFormData;
  mode: "create" | "edit";
}

export function PaymentMethodModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}: PaymentMethodModalProps) {
  const [formData, setFormData] = useState<PaymentMethodFormData>({
    name: "",
    category: "bank",
    provider: "",
    account_number: "",
    account_name: "",
    is_active: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: "",
        category: "bank",
        provider: "",
        account_number: "",
        account_name: "",
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

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "bank":
        return "Bank Transfer";
      case "e-wallet":
        return "E-Wallet";
      case "cash":
        return "Cash";
      default:
        return category;
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
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {mode === "create" ? "Add Payment Method" : "Edit Payment Method"}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Configure payment method for tenant invoices
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                {/* Payment Method Name */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Payment Method Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Bank Mandiri - Corporate Account"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Category *
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["bank", "e-wallet", "cash"] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat })}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all font-bold text-sm",
                          formData.category === cat
                            ? "border-purple-600 bg-purple-50 text-purple-600"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        )}
                      >
                        {getCategoryLabel(cat)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Provider (for e-wallet) */}
                {formData.category === "e-wallet" && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Provider
                    </label>
                    <input
                      type="text"
                      value={formData.provider || ""}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                      placeholder="e.g., GoPay, OVO, Dana"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                )}

                {/* Bank Name (for bank) */}
                {formData.category === "bank" && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={formData.provider || ""}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                      placeholder="e.g., Bank Mandiri, BCA, BNI"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                )}

                {/* Account Number */}
                {formData.category !== "cash" && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      {formData.category === "bank" ? "Account Number" : "Phone Number"}
                    </label>
                    <input
                      type="text"
                      value={formData.account_number || ""}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      placeholder={formData.category === "bank" ? "e.g., 1234567890" : "e.g., +62 812-3456-7890"}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                )}

                {/* Account Name */}
                {formData.category !== "cash" && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={formData.account_name || ""}
                      onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                      placeholder="e.g., PT RRNET Indonesia"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                )}

                {/* Active Status */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-bold text-slate-700">Active Status</p>
                    <p className="text-xs text-slate-500">Enable this payment method for tenants</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={cn(
                      "relative w-14 h-7 rounded-full transition-colors",
                      formData.is_active ? "bg-emerald-500" : "bg-slate-300"
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
              <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="font-bold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="font-bold bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>{mode === "create" ? "Add Payment Method" : "Save Changes"}</>
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
