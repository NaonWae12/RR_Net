import React from 'react';
import { VoucherTemplateProps } from "./types";
import QRCode from "react-qr-code";
import { 
  Globe, 
  Monitor, 
  Facebook, 
  Twitter, 
  Youtube, 
  Chrome, 
  Radio,
  Wifi
} from 'lucide-react';

const ModernTemplate: React.FC<VoucherTemplateProps> = ({ voucher, index = 0, pkg, headerTitle, config }) => {
  // Format current date for display
  const dateStr = new Date().toISOString().split('T')[0];
  
  // Logic for QR Code data
  const dns = config?.dnsName || headerTitle || "hotspot.net";
  const qrData = `http://${dns}/login?username=${voucher.code}&password=${voucher.password || ""}`;

  // Dynamic Header Text
  const displayTitle = headerTitle || "INTERNET HOTSPOT";

  return (
    <div className="print-card bg-white border border-dashed border-slate-600 p-0 text-slate-900 w-full max-w-[160px] shadow-none flex flex-col overflow-hidden leading-none font-sans relative h-[85px]">
      
      {/* Header Area - Ultra Compact */}
      <div className="flex items-center gap-1 p-0.5 border-b border-slate-200 bg-slate-50/50 h-[22px]">
        <div className="flex-shrink-0 relative scale-90 origin-left">
          <Monitor className="w-5 h-5 text-black" />
          <Globe className="w-2.5 h-2.5 text-slate-700 absolute -top-0.5 -right-0.5" />
        </div>
        <div className="flex flex-col justify-center overflow-hidden">
          <div className="font-black text-[9px] leading-tight tracking-tighter text-blue-600 truncate uppercase">
            {displayTitle}
          </div>
          <span className="text-[6px] font-black text-slate-500 uppercase tracking-tighter leading-none">Authentication Code</span>
        </div>
      </div>

      <div className="flex flex-1 relative overflow-hidden">
        {/* Left Side: Date & QR */}
        <div className="w-[40%] border-r border-slate-200 flex flex-col items-center justify-start bg-slate-50/30 h-full pt-1">
          <span className="text-[7px] font-bold text-slate-500 font-mono tracking-tighter mb-0.5 leading-none">{dateStr}</span>
          <div className="bg-white p-0.5 rounded-sm border border-slate-100 flex items-center justify-center">
            <QRCode value={qrData} size={42} />
          </div>
        </div>

        {/* Center Side: Data with Watermark */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-white/40 h-full">
          {/* Watermark ... SAME ... */}
          <div className="absolute inset-0 flex items-center justify-center translate-x-1 opacity-[0.03] pointer-events-none">
             <Radio className="w-10 h-10" />
          </div>

          {/* Username Row */}
          <div className="flex-[1.2] flex border-b border-slate-200 items-center justify-between px-1.5 relative z-10 leading-none">
            <span className="text-[10px] font-black text-black font-mono tracking-tighter">{voucher.code}</span>
            <span className="rotate-180 [writing-mode:vertical-lr] text-[5px] font-black text-slate-400 uppercase">User</span>
          </div>

          {/* Password Row */}
          <div className="flex-[1.2] flex border-b border-slate-200 items-center justify-between px-1.5 relative z-10 leading-none">
            <span className="text-[10px] font-black text-black font-mono tracking-tighter">{voucher.password || voucher.code}</span>
            <span className="rotate-180 [writing-mode:vertical-lr] text-[4px] font-black text-slate-400 uppercase tracking-tighter">Pass</span>
          </div>

          {/* Price Row */}
          <div className="flex-1 flex items-center justify-between px-1.5 bg-slate-50/50 relative z-10 leading-none">
            <span className="text-[9px] font-black text-black tracking-tighter leading-none">RP {pkg?.price ? pkg.price.toLocaleString('id-ID') : '0'}</span>
            <span className="rotate-180 [writing-mode:vertical-lr] text-[4px] font-black text-slate-400 uppercase tracking-tighter">Price</span>
          </div>
        </div>

        {/* Right Side Bar: Social Icons & Index */}
        <div className="w-6 border-l border-slate-200 flex flex-col items-center justify-start py-1 bg-slate-50/80 h-full">
           <div className="flex flex-col items-center gap-1 mt-0">
              <Facebook className="w-2.5 h-2.5 text-slate-500" />
              <Youtube className="w-2.5 h-2.5 text-slate-500" />
              <Chrome className="w-2.5 h-2.5 text-slate-500" />
           </div>
           
           {/* Index Voucher */}
           <div className="mt-auto w-4 h-4 rounded-full border border-black flex items-center justify-center bg-black text-white font-black text-[7px] shrink-0 mb-1.5">
             {index + 1}
           </div>
        </div>
      </div>
    </div>
  );
};

export default ModernTemplate;
