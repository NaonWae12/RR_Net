import React from 'react';
import { VoucherTemplateProps } from "./types";

const MikhmonTemplate: React.FC<VoucherTemplateProps> = ({ voucher, index, pkg, headerTitle }) => {
  return (
    <div className="print-card bg-white border-2 border-black p-1 text-[9px] font-bold text-black w-full max-w-[160px] shadow-none uppercase min-h-[86px] flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center border-b-2 border-black pb-0.5 mb-1 px-1">
          <span className="truncate max-w-[100px] font-bold normal-case text-[10px]">{headerTitle}</span>
          <span className="text-[8px]">[{index + 1}]</span>
        </div>
        <div className="flex text-[8px] text-center mb-0.5 leading-none">
          <div className="flex-1">User</div>
          <div className="flex-1">Pass</div>
        </div>
        <div className="flex gap-1 mb-1">
          <div className="flex-1 border-2 border-black py-0.5 px-0.5 text-center font-bold text-[12px] leading-tight normal-case bg-slate-50/50">
            {voucher.code}
          </div>
          <div className="flex-1 border-2 border-black py-0.5 px-0.5 text-center font-bold text-[12px] leading-tight normal-case bg-slate-50/50">
            {voucher.password || voucher.code}
          </div>
        </div>
      </div>
      <div className="border-2 border-black py-0.5 px-1 text-center text-[10px] font-black leading-none bg-slate-100/30">
        {pkg?.duration_hours ? `${pkg.duration_hours}J` : '∞'} - RP {pkg?.price ? pkg.price.toLocaleString('id-ID') : '0'}
      </div>
    </div>
  );
};

export default MikhmonTemplate;
