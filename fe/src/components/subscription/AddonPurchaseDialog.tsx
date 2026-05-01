"use client";

import React, { useState } from "react";
import { PlatformAddon } from "@/lib/api/subscriptionService";
import { Button } from "@/components/ui/button";
import { X, Minus, Plus, Zap, Router, Users, MessageCircle, Package, ShieldCheck, ArrowRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface AddonPurchaseDialogProps {
  addon: PlatformAddon;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (addon: PlatformAddon, quantity: number) => void;
}

// Map addon value keys to human-readable labels and icons
const VALUE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  add_routers: { label: "Routers", icon: <Router className="h-4 w-4" /> },
  add_clients: { label: "Clients", icon: <Users className="h-4 w-4" /> },
  add_wa_quota: { label: "WA Messages", icon: <MessageCircle className="h-4 w-4" /> },
  add_vouchers: { label: "Vouchers", icon: <Package className="h-4 w-4" /> },
  add_odc: { label: "ODC Ports", icon: <Zap className="h-4 w-4" /> },
  add_odp: { label: "ODP Ports", icon: <Zap className="h-4 w-4" /> },
};

const CYCLE_LABELS: Record<string, string> = {
  monthly: "/bulan",
  yearly: "/tahun",
  one_time: " (sekali bayar)",
};

export default function AddonPurchaseDialog({
  addon,
  isOpen,
  onClose,
  onConfirm,
}: AddonPurchaseDialogProps) {
  const [quantity, setQuantity] = useState(1);

  if (!isOpen) return null;

  const unitPrice = addon.price;
  const totalPrice = unitPrice * quantity;
  const cycleLabel = CYCLE_LABELS[addon.billing_cycle] || `/${addon.billing_cycle}`;

  // Extract what this addon gives per unit
  const valueEntries = Object.entries(addon.value || {}).filter(
    ([, v]) => typeof v === "number" && (v as number) > 0
  );

  const handleIncrement = () => setQuantity((q) => Math.min(q + 1, 10));
  const handleDecrement = () => setQuantity((q) => Math.max(q - 1, 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-[440px] bg-white rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-linear-to-br from-indigo-600 to-purple-600 px-6 py-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 p-2 hover:bg-white/10 rounded-full transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight leading-none mb-1">
                {addon.name}
              </h2>
              <p className="text-white/60 text-[9px] uppercase font-bold tracking-[0.2em]">
                ADD-ON PURCHASE
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Description */}
          {addon.description && (
            <p className="text-sm text-slate-500 leading-relaxed">
              {addon.description}
            </p>
          )}

          {/* What you get per unit */}
          {valueEntries.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Yang didapat per unit
              </p>
              <div className="space-y-2">
                {valueEntries.map(([key, val]) => {
                  const info = VALUE_LABELS[key] || {
                    label: key.replace(/_/g, " "),
                    icon: <Package className="h-4 w-4" />,
                  };
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                          {info.icon}
                        </div>
                        <span className="text-sm font-bold text-slate-700">
                          {info.label}
                        </span>
                      </div>
                      <span className="text-sm font-black text-indigo-600">
                        +{val as number}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">
              Jumlah Unit
            </p>
            <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-3 border border-slate-100">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={quantity <= 1}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all font-bold text-lg",
                  quantity <= 1
                    ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                    : "bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 shadow-sm border border-slate-100 active:scale-95"
                )}
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="text-center">
                <span className="text-3xl font-black text-slate-900 tabular-nums">
                  {quantity}x
                </span>
                {valueEntries.length > 0 && (
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {valueEntries
                      .map(([key, val]) => {
                        const info = VALUE_LABELS[key];
                        const totalVal = (val as number) * quantity;
                        return `+${totalVal} ${info?.label || key}`;
                      })
                      .join(", ")}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleIncrement}
                disabled={quantity >= 10}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all font-bold text-lg",
                  quantity >= 10
                    ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                    : "bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 shadow-sm border border-slate-100 active:scale-95"
                )}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-3 shadow-lg">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-medium">Harga per unit</span>
              <span className="font-bold">
                {formatCurrency(unitPrice)}
                <span className="text-[10px] text-slate-500 ml-1">{cycleLabel}</span>
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-medium">Jumlah</span>
              <span className="font-bold">×{quantity}</span>
            </div>
            <div className="border-t border-white/10 pt-3 flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">
                Total Bayar
              </span>
              <span className="text-xl font-black">
                {formatCurrency(totalPrice)}
                <span className="text-[10px] text-slate-500 ml-1">{cycleLabel}</span>
              </span>
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              Pembayaran akan diverifikasi oleh admin. Add-on aktif setelah pembayaran dikonfirmasi. Perpanjangan berikutnya disatukan dalam tagihan bulanan.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-400"
            >
              Batal
            </Button>
            <Button
              onClick={() => onConfirm(addon, quantity)}
              className="flex-[2] h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
              Lanjut ke Pembayaran
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
