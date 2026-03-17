"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { inventoryService, Asset, AssetInstance } from "@/lib/api/inventoryService";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  QrCodeIcon, 
  MapPinIcon, 
  CalendarIcon,
  TagIcon,
  ArchiveBoxIcon,
  ShieldCheckIcon,
  Square3Stack3DIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";

export default function PublicAssetPage() {
  const params = useParams();
  const id = params?.id as string;
  
  const [data, setData] = useState<(AssetInstance & { asset: Asset }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        setIsLoading(true);
        const res = await inventoryService.getPublicInstance(id);
        setData(res.data);
      } catch (err) {
        setError("Item not found or link has expired.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_stock": return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">AVAILABLE</Badge>;
      case "deployed": return <Badge className="bg-blue-100 text-blue-700 border-blue-200">IN USE / DEPLOYED</Badge>;
      case "maintenance": return <Badge className="bg-amber-100 text-amber-700 border-amber-200">MAINTENANCE</Badge>;
      case "disposed": return <Badge className="bg-slate-200 text-slate-600 border-slate-300">DISPOSED</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case "new": return <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50/50">PERFECT CONDITION</Badge>;
      case "second": return <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50/50">NORMAL USE</Badge>;
      case "broken": return <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50/50">NEEDS REPAIR</Badge>;
      default: return <Badge variant="outline">{condition}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Decrypting Asset Identity...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-sm w-full">
           <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
              <InformationCircleIcon className="w-10 h-10" />
           </div>
           <h1 className="text-xl font-black text-slate-900 mb-2">Verification Failed</h1>
           <p className="text-sm text-slate-500 mb-8">{error || "This tracking ID is invalid or has been decommissioned from our system."}</p>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">© ERP_NET SECURITY SYNC</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100 p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Verification Header */}
        <div className="flex items-center justify-center gap-2 mb-8">
           <div className="bg-indigo-600 p-1.5 rounded-lg">
             <ShieldCheckIcon className="w-5 h-5 text-white" />
           </div>
           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Official Asset Verification</span>
        </div>

        {/* Main Identity Card */}
        <Card className="border-0 shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-[2.5rem] overflow-hidden bg-white">
           <div className="bg-indigo-600 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-10 -mr-8 -mt-8">
                 <QrCodeIcon className="w-48 h-48" />
              </div>
              <div className="relative z-10">
                 <div className="flex justify-between items-start mb-6">
                    <code className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                       {data.asset.code}
                    </code>
                    {getStatusBadge(data.status)}
                 </div>
                 <h1 className="text-3xl font-black leading-tight mb-2">{data.asset.name}</h1>
                 <p className="text-white/70 text-sm font-medium italic">
                    {data.asset.category} • Instance SN: {data.serial_number}
                 </p>
              </div>
           </div>

           <CardContent className="p-8 space-y-8">
              {/* Core Specs */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Condition</p>
                    <div className="font-bold text-sm">{getConditionBadge(data.condition)}</div>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Location</p>
                    <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
                       <MapPinIcon className="w-4 h-4 text-indigo-500" />
                       {data.location || "Main Warehouse"}
                    </div>
                 </div>
              </div>

              {/* Description */}
              <div className="space-y-3">
                 <div className="flex items-center gap-2">
                    <ArchiveBoxIcon className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400">Specifications / Memo</h3>
                 </div>
                 <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-dashed border-slate-200 italic">
                    {data.asset.description || "No additional specifications provided for this unit."}
                 </p>
              </div>

              {/* Tracking Details */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                       <CalendarIcon className="w-3.5 h-3.5" /> Checked At
                    </span>
                    <span className="font-black text-slate-900">
                       {data.last_checked_at ? new Date(data.last_checked_at).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Never'}
                    </span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                       <Square3Stack3DIcon className="w-3.5 h-3.5" /> Unit ID (Global)
                    </span>
                    <code className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-600">
                       {data.id.substring(0, 8)}...
                    </code>
                 </div>
              </div>
           </CardContent>
        </Card>

        {/* Footer Info */}
        <div className="text-center space-y-4">
           <div className="bg-white/50 backdrop-blur-sm p-6 rounded-[2rem] border border-white max-w-sm mx-auto">
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                 The information above is a real-time record from the <span className="font-black text-indigo-600 uppercase">ERP_NET Sync</span> engine. 
                 Any unauthorized physical modification of this asset is strictly prohibited.
              </p>
           </div>
           <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">
             © 2026 ERP_NET SYNC • INVENTORY AUTH
           </p>
        </div>

      </div>
    </div>
  );
}
