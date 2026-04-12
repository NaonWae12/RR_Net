import React from 'react';
import { Badge } from "@/components/ui/badge";
import { VoucherTemplateProps } from "./types";

const SimpleTemplate: React.FC<VoucherTemplateProps> = ({ voucher, index, pkg, headerTitle }) => {
  return (
    <div className="print-card border-2 border-dashed border-slate-300 rounded-lg p-4 bg-white h-full">
      <div className="space-y-2">
        <div className="flex justify-between items-start">
          <span className="text-xs font-bold text-slate-400">#{String(index + 1).padStart(3, '0')}</span>
          <Badge variant="outline" className="text-xs uppercase max-w-[120px] truncate">
            {headerTitle}
          </Badge>
        </div>
        <div className="border-t border-slate-200 pt-2">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Username:</span>
              <span className="font-mono font-bold text-slate-900">{voucher.code}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Password:</span>
              <span className="font-mono font-bold text-slate-900">{voucher.password || voucher.code}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Harga:</span>
              <span className="font-bold text-emerald-600">Rp {(pkg?.price || 0).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Masa Aktif:</span>
              <span className="font-bold text-slate-700">{pkg?.duration_hours ? `${pkg.duration_hours} Jam` : 'Unlimited'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleTemplate;
