"use client";

import React, { useState } from "react";
import { PageLayout } from "@/components/layouts";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  PlusIcon, 
  ArchiveBoxIcon,
  TagIcon,
  CpuChipIcon,
  SignalIcon,
  MagnifyingGlassIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";
import { inventoryService, Asset, GlobalSummary } from "@/lib/api/inventoryService";
import { toast } from "sonner";
import { NewAssetModal } from "@/components/finance/NewAssetModal";

export default function InventoryPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewAssetModalOpen, setIsNewAssetModalOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [summary, setSummary] = useState<GlobalSummary | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [assetsRes, summaryRes] = await Promise.all([
        inventoryService.listAssets({ search: searchTerm }),
        inventoryService.getSummary()
      ]);
      setAssets(assetsRes.data.data || []);
      setSummary(summaryRes.data);
    } catch (error) {
      toast.error("Failed to fetch inventory data");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [searchTerm]);

  const getStatusBadge = (asset: Asset) => {
    const summary = asset.stock_summary;
    if (!summary) return null;
    
    if (summary.in_stock === 0) return <Badge className="bg-red-100 text-red-700 border-red-200">Out of Stock</Badge>;
    if (summary.low_stock) return <Badge className="bg-amber-100 text-amber-700 border-amber-200 uppercase font-black tracking-tighter text-[10px]">Low Stock</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">In Stock</Badge>;
  };

  return (
    <PageLayout
      title="Asset & Inventory"
      breadcrumbs={[
        { label: "Finance", href: "/finance/dashboard" },
        { label: "Inventory" }
      ]}
    >
      <div className="space-y-6 pb-20">
        {/* Inventory Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Asset Types", value: summary?.total_assets ? `${summary.total_assets} Types` : "0 Types", icon: <ArchiveBoxIcon className="w-5 h-5" />, color: "bg-indigo-50 text-indigo-600" },
            { label: "Active Items", value: summary?.active_items ? `${summary.active_items} Items` : "0 Items", icon: <TagIcon className="w-5 h-5" />, color: "bg-emerald-50 text-emerald-600" },
            { label: "Low Stock Items", value: summary?.low_stock_assets ? `${summary.low_stock_assets} Items` : "0 Items", icon: <SignalIcon className="w-5 h-5" />, color: "bg-amber-50 text-amber-600" },
            { label: "Pending Issues", value: "0 Items", icon: <PlusIcon className="w-5 h-5" />, color: "bg-blue-50 text-blue-600" },
          ].map((stat, i) => (
            <Card key={i} className="border-slate-200 shadow-xs">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${stat.color}`}>{stat.icon}</div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                    <p className="text-xl font-black text-slate-900">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tools & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative w-full md:w-96">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search assets by name or code..." 
              className="pl-10 border-slate-200 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button 
              className="flex-1 md:flex-none bg-slate-900 hover:bg-black gap-2"
              onClick={() => setIsNewAssetModalOpen(true)}
            >
              <PlusIcon className="w-4 h-4" /> New Asset
            </Button>
          </div>
        </div>

        {/* Inventory List */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                <tr>
                  <th className="px-6 py-4">Asset Details</th>
                  <th className="px-6 py-4">SKU / System Code</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-center">Stock</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 italic">
                {isLoading ? (
                   <tr>
                     <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold animate-pulse">
                       Loading inventory data...
                     </td>
                   </tr>
                ) : (!Array.isArray(assets) || assets.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold">
                      No assets found. {searchTerm && "Try a different search term."}
                    </td>
                  </tr>
                ) : (
                  assets?.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                            <CpuChipIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 not-italic">{item.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Asset-ID: {item.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600 text-[11px] font-bold">
                        {item.code}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium capitalize">{item.category}</td>
                      <td className="px-6 py-4 text-center font-black text-slate-900">{item.stock_summary?.in_stock ?? 0}</td>
                      <td className="px-6 py-4 text-center">{getStatusBadge(item)}</td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 font-bold px-4 flex items-center gap-2 ml-auto"
                          onClick={() => router.push(`/finance/inventory/${item.id}`)}
                        >
                          <InformationCircleIcon className="w-4 h-4" />
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Conceptual info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-100">
            <h4 className="font-black text-indigo-900 mb-2">Auto-Generate System</h4>
            <p className="text-sm text-indigo-700 leading-relaxed">
              Every new item added will receive a unique <span className="underline font-bold">Asset Tag QR</span>. 
              The system supports custom SKU formats: <code className="bg-white/50 px-1 rounded">[CATEGORY]-[LOC]-[YEAR]-XXXX</code>.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100">
            <h4 className="font-black text-emerald-900 mb-2">QR Integrated Tracking</h4>
            <p className="text-sm text-emerald-700 leading-relaxed">
              Technicians can scan QR codes in the field to view technical specs or report damage directly to Finance/Inventory.
            </p>
          </div>
        </div>
      </div>

      <NewAssetModal 
        isOpen={isNewAssetModalOpen} 
        onClose={() => setIsNewAssetModalOpen(false)} 
      />
    </PageLayout>
  );
}
