import React from 'react';
import { Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VoucherTemplateProps } from "./types";

const BrandedTemplate: React.FC<VoucherTemplateProps> = ({ voucher, index, pkg, headerTitle }) => {
  const isSameCredentials = voucher.code === (voucher.password || voucher.code);

  return (
    <div className="print-card border-2 border-dashed border-indigo-300 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50 h-full">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-3 text-white">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            <span className="font-bold text-sm uppercase truncate max-w-[150px]">
              {headerTitle}
            </span>
          </div>
          <span className="text-xs font-bold opacity-80">#{String(index + 1).padStart(3, '0')}</span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div className="text-center mb-2">
          <Badge className="bg-indigo-600 text-white font-bold">{pkg?.name || 'Voucher'}</Badge>
        </div>
        <div className="space-y-1 bg-white rounded-lg p-3 border border-indigo-200">
          {isSameCredentials ? (
            <div className="flex justify-between text-[10px] sm:text-xs">
              <span className="text-slate-500 font-medium">Kode Akses:</span>
              <span className="font-mono font-bold text-indigo-700">{voucher.code}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-[10px] sm:text-xs">
                <span className="text-slate-500 font-medium">Username:</span>
                <span className="font-mono font-bold text-indigo-700">{voucher.code}</span>
              </div>
              <div className="flex justify-between text-[10px] sm:text-xs">
                <span className="text-slate-500 font-medium">Password:</span>
                <span className="font-mono font-bold text-purple-700">{voucher.password}</span>
              </div>
            </>
          )}
          <div className="pt-1 border-t border-indigo-50 mt-1">
            <div className="flex justify-between text-[10px] sm:text-xs">
              <span className="text-slate-500 font-medium">Harga:</span>
              <span className="font-bold text-emerald-600">Rp {(pkg?.price || 0).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandedTemplate;
