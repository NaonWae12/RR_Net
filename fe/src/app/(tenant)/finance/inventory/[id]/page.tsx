"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/select";
import { 
  QrCodeIcon, 
  MapPinIcon, 
  CalendarIcon,
  TagIcon,
  ArrowTopRightOnSquareIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  ArchiveBoxIcon,
  CpuChipIcon,
  PrinterIcon,
  ArrowsPointingOutIcon,
  DocumentIcon,
  Squares2X2Icon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Modal } from "@/components/modals/Modal";
import { QRCodeSVG } from "qrcode.react";
import { inventoryService, Asset, AssetInstance as BackendInstance, AssetLog } from "@/lib/api/inventoryService";

// Keep local interface aligned with backend
type AssetInstance = BackendInstance;

export default function AssetDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  
  const [asset, setAsset] = useState<Asset | null>(null);
  const [instances, setInstances] = useState<AssetInstance[]>([]);
  const [logs, setLogs] = useState<AssetLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    serial: true,
    condition: true,
    location: true,
    status: true,
    lastChecked: true
  });
  const [editingUnit, setEditingUnit] = useState<AssetInstance | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [qrSize, setQrSize] = useState("medium");
  
  // Batch Print States
  const [isBatchPrintModalOpen, setIsBatchPrintModalOpen] = useState(false);
  const [printerType, setPrinterType] = useState<"thermal" | "regular">("thermal");
  const [showBorder, setShowBorder] = useState(true);
  const [labelsPerRow, setLabelsPerRow] = useState(3);

  // New Feature States
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");

  const fetchData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [assetRes, instancesRes, logsRes] = await Promise.all([
        inventoryService.getAsset(id),
        inventoryService.listInstances(id),
        inventoryService.getHistory({ asset_id: id })
      ]);
      setAsset(assetRes.data);
      setInstances(instancesRes.data.data || []);
      setLogs(logsRes.data.data || []);
    } catch (error) {
      toast.error("Failed to load asset details");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [id]);

  const printConfig = {
    small: { w: "40mm", h: "30mm", font: "8px" },
    medium: { w: "50mm", h: "30mm", font: "10px" },
    large: { w: "100mm", h: "50mm", font: "14px" },
  };

  const filteredInstances = useMemo(() => {
    return instances.filter(instance => 
      instance.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instance.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      instance.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [instances, searchTerm]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_stock": return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Available</Badge>;
      case "deployed": return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Deployed</Badge>;
      case "maintenance": return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Maintenance</Badge>;
      case "disposed": return <Badge className="bg-slate-200 text-slate-600 border-slate-300">Disposed</Badge>;
      case "sold": return <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">Sold Out</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case "new": return <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50/50">NEW</Badge>;
      case "second": return <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50/50">SECOND</Badge>;
      case "broken": return <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50/50">BROKEN</Badge>;
      case "refurbished": return <Badge variant="outline" className="border-indigo-200 text-indigo-600 bg-indigo-50/50">REFURBISHED</Badge>;
      default: return <Badge variant="outline">{condition}</Badge>;
    }
  };

  const handleUpdateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit || !id) return;
    
    setIsUpdating(true);
    try {
      await inventoryService.updateInstance(id, editingUnit.id, {
        status: editingUnit.status,
        condition: editingUnit.condition,
        location: editingUnit.location,
      });
      toast.success(`Asset ${editingUnit.id} updated successfully!`);
      setEditingUnit(null);
      fetchData(); // Refresh list
    } catch (error) {
      toast.error("Failed to update asset instance");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || !id) return;
    try {
      setIsUpdating(true);
      await inventoryService.bulkUpdate(id, bulkStatus);
      toast.success("Bulk update successful!");
      setIsGlobalSettingsOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Bulk update failed");
    } finally {
      setIsUpdating(false);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleDeleteAsset = async () => {
    try {
      setIsUpdating(true);
      await inventoryService.deleteAsset(id);
      toast.success("Asset deleted successfully");
      router.push("/finance/inventory");
    } catch (error) {
      toast.error("Failed to delete asset");
    } finally {
      setIsUpdating(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handlePrintQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !editingUnit) return;

    const config = printConfig[qrSize as keyof typeof printConfig];
    const qrSvg = document.getElementById('printable-qr')?.innerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Label - ${editingUnit.id}</title>
          <style>
            @page { size: ${config.w} ${config.h}; margin: 0; }
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background: white; }
            .label { 
              width: ${config.w}; 
              height: ${config.h}; 
              padding: 3mm; 
              display: flex; 
              align-items: center; 
              gap: 4mm;
              overflow: hidden;
            }
            .qr-container { 
              width: 35%;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-container svg { 
              width: 100% !important; 
              height: auto !important; 
              display: block;
            }
            .info { 
              flex: 1; 
              display: flex; 
              flex-direction: column; 
              justify-content: center;
              overflow: hidden;
            }
             .header {
               font-size: calc(${config.font} * 0.45);
               font-weight: 900;
               text-transform: uppercase;
               letter-spacing: 0.15em;
               color: #4f46e5;
               margin-bottom: 0.5mm;
             }
             .id { 
               font-weight: 900; 
               font-size: ${config.font}; 
               line-height: 1.1;
               color: #000;
               word-break: break-all;
               margin-bottom: 0.5mm;
             }
             .model { 
               font-size: calc(${config.font} * 0.65); 
               color: #444; 
               font-weight: 600;
               white-space: nowrap;
               overflow: hidden;
               text-overflow: ellipsis;
             }
             .brand {
               font-size: calc(${config.font} * 0.45);
               color: #999;
               font-weight: 700;
               margin-top: 1.5mm;
               text-transform: uppercase;
               letter-spacing: 0.1em;
             }
          </style>
        </head>
        <body onload="setTimeout(() => { window.print(); window.close(); }, 500)">
           <div class="label">
              <div class="qr-container">${qrSvg}</div>
              <div class="info">
                 <div class="header">Inventory Management</div>
                 <div class="id">${asset?.name} ${editingUnit.serial_number?.split('-').pop() || '000'}</div>
                 <div class="model">${editingUnit.serial_number}</div>
                 <div class="brand">© ERP_NET SYNC 2026</div>
              </div>
           </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintBatchExecute = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const config = printConfig[qrSize as keyof typeof printConfig];
    
    // Grab SVGs directly from the preview DOM to ensure they are the same
    const labelsHtml = filteredInstances.map(instance => {
      const qrElement = document.getElementById(`qr-preview-${instance.id}`);
      const qrMarkup = qrElement ? qrElement.outerHTML : '';
      
      return `
        <div class="label-box ${showBorder ? 'with-border' : ''}">
           <div class="qr-container">${qrMarkup}</div>
           <div class="info">
              <div class="header">Inventory Management</div>
              <div class="id">${asset?.name} ${instance.serial_number?.split('-').pop() || '000'}</div>
              <div class="model">${instance.serial_number}</div>
              <div class="brand">© ERP_NET SYNC 2026</div>
           </div>
        </div>
      `;
    }).join('');

    const layoutStyles = printerType === 'thermal' ? `
      @page { size: ${config.w} ${config.h}; margin: 0; }
      body { margin: 0; }
      .label-box { 
        page-break-after: always; 
        width: ${config.w}; 
        height: ${config.h}; 
        display: flex; 
        align-items: center; 
        gap: 4mm; 
        padding: 3mm;
      }
    ` : `
      @page { size: A4; margin: 10mm; }
      body { margin: 0; padding: 10mm; }
      .container { 
        display: grid; 
        grid-template-columns: repeat(${labelsPerRow}, 1fr); 
        gap: 5mm; 
      }
      .label-box { 
        display: flex; 
        align-items: center; 
        gap: 3mm; 
        padding: 4mm;
        height: 40mm;
      }
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Batch Print - ${asset?.code}</title>
          <style>
            ${layoutStyles}
            * { box-sizing: border-box; }
            body { font-family: sans-serif; background: white; }
            .with-border { border: 0.3mm solid #000; border-radius: 1mm; }
            .qr-container { width: 35%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            .qr-container svg { width: 100% !important; height: auto !important; }
            .info { flex: 1; display: flex; flex-direction: column; justify-content: center; overflow: hidden; }
            .header { font-size: 7pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #4f46e5; margin-bottom: 0.5mm; }
            .id { font-weight: 900; font-size: 11pt; line-height: 1.1; margin-bottom: 0.5mm; color: #000; }
            .model { font-size: 8pt; color: #333; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .brand { font-size: 6pt; color: #999; font-weight: 700; margin-top: 1mm; text-transform: uppercase; letter-spacing: 0.5pt; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
           ${printerType === 'regular' ? `<div class="container">${labelsHtml}</div>` : labelsHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <PageLayout
      title="Asset Records Detail"
      breadcrumbs={[
        { label: "Finance", href: "/finance/dashboard" },
        { label: "Inventory", href: "/finance/inventory" },
        { label: asset?.code || "..." }
      ]}
>
  <div className="space-y-6 pb-20">
    {isLoading ? (
       <div className="flex flex-col items-center justify-center py-40 gap-4">
         <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
         <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Accessing tracking engine...</p>
       </div>
    ) : !asset ? (
       <div className="text-center py-40">
          <h2 className="text-2xl font-black text-slate-900">Asset Not Found</h2>
          <Button onClick={() => router.push("/finance/inventory")} className="mt-4">Back to Inventory</Button>
       </div>
    ) : (
<>
        {/* Header & Stats */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-xl border-slate-200 bg-white">
              <ArrowLeftIcon className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">{asset.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <code className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[11px] font-black">{asset.code}</code>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">• {asset.category}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="rounded-xl border-slate-200 bg-white gap-2 font-bold text-slate-600"
              onClick={() => setIsBatchPrintModalOpen(true)}
            >
               <QrCodeIcon className="w-4 h-4" /> Batch Label
            </Button>
            <Button 
              className="rounded-xl bg-slate-900 hover:bg-black gap-2 font-black shadow-xl"
              onClick={() => setIsGlobalSettingsOpen(true)}
            >
               <AdjustmentsHorizontalIcon className="w-4 h-4" /> Global Settings
            </Button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-white border-b border-slate-100 py-4 px-6 flex flex-row items-center justify-between">
               <CardTitle className="text-sm font-black text-slate-400 uppercase tracking-widest">General Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Description</p>
                      <p className="text-sm text-slate-600 leading-relaxed italic">{asset.description || "No description provided"}</p>
                    </div>
                    <div className="flex gap-6">
                       <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Count</p>
                         <p className="text-xl font-black text-slate-900">{asset.stock_summary?.total || 0} <span className="text-xs font-medium text-slate-400">Units</span></p>
                       </div>
                       <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">In Stock</p>
                         <p className="text-xl font-black text-emerald-600">{asset.stock_summary?.in_stock || 0} <span className="text-xs font-medium text-slate-400 uppercase tracking-tighter">Ready</span></p>
                       </div>
                       <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deployed</p>
                         <p className="text-xl font-black text-indigo-500">{asset.stock_summary?.deployed || 0} <span className="text-xs font-medium text-slate-400 uppercase tracking-tighter">Active</span></p>
                       </div>
                    </div>
                 </div>
                 <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/50">
                    <div className="flex items-center gap-3 mb-4">
                       <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                          <ArchiveBoxIcon className="w-6 h-6" />
                       </div>
                       <h4 className="font-black text-slate-900">Tracking Engine</h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      This model uses unique identifier system. Each unit is individually serialized and QR-tagged for precision tracking throughout the company lifecycle.
                    </p>
                 </div>
               </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-white border-b border-slate-100 py-4 px-6">
              <CardTitle className="text-sm font-black text-slate-400 uppercase tracking-widest">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {logs.slice(0, 5).map(log => (
                  <div key={log.id} className="flex gap-3 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <CalendarIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{log.action.replace(/_/g, ' ')}</p>
                      <p className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                <Button 
                  variant="ghost" 
                  className="w-full text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl"
                  onClick={() => setIsLogsOpen(true)}
                >
                  View All Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tracking List */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <h4 className="font-black text-slate-900 text-sm uppercase tracking-wider">Unique Unit Tracking List</h4>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search SN, ID, or Location..." 
                  className="pl-10 h-10 bg-slate-50/50 border-slate-200 rounded-xl text-xs focus:bg-white transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 rounded-xl gap-2 text-xs font-bold border-slate-200 bg-white shadow-xs px-4">
                    <AdjustmentsHorizontalIcon className="w-4 h-4" />
                    Filters
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {Object.entries(visibleColumns).map(([key, value]) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={value}
                      onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, [key]: !!checked }))}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                <tr>
                  {visibleColumns.id && <th className="px-6 py-4">Asset ID / QR</th>}
                  {visibleColumns.serial && <th className="px-6 py-4">Serial Number</th>}
                  {visibleColumns.condition && <th className="px-6 py-4">Condition</th>}
                  {visibleColumns.location && <th className="px-6 py-4">Current Location</th>}
                  {visibleColumns.status && <th className="px-6 py-4 text-center">Status</th>}
                  {visibleColumns.lastChecked && <th className="px-6 py-4 text-right">Last Verified</th>}
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 italic">
                {filteredInstances.map((instance) => (
                  <tr 
                    key={instance.id} 
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    onClick={() => setEditingUnit(instance)}
                  >
                    {visibleColumns.id && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs">
                            <QrCodeIcon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-black text-slate-900 not-italic">
                            {asset?.name} {instance.serial_number?.split('-').pop() || '000'}
                          </span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.serial && (
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-700 text-xs not-italic">
                          {instance.serial_number ? (
                            instance.serial_number.split('-').length > 2 
                              ? instance.serial_number.split('-').slice(-2).join('-') 
                              : instance.serial_number
                          ) : "-"}
                        </span>
                      </td>
                    )}
                    {visibleColumns.condition && (
                      <td className="px-6 py-4">
                        {getConditionBadge(instance.condition)}
                      </td>
                    )}
                    {visibleColumns.location && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-600 text-xs not-italic font-medium">
                          <MapPinIcon className="w-3.5 h-3.5 text-slate-400" />
                          {instance.location || "Central Warehouse"}
                        </div>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(instance.status)}
                      </td>
                    )}
                    {visibleColumns.lastChecked && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-slate-400 text-[10px] not-italic font-black uppercase tracking-tighter">
                          <CalendarIcon className="w-3 h-3" />
                          {instance.last_checked_at ? new Date(instance.last_checked_at).toLocaleDateString() : "-"}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="rounded-xl h-8 w-10 p-0 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all opacity-0 group-hover:opacity-100">
                        <PencilSquareIcon className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      {editingUnit && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setEditingUnit(null)} />
          
          <div className="relative w-full max-w-4xl bg-slate-50 h-full shadow-2xl animate-in slide-in-from-right duration-500 flex overflow-hidden">
            
            {/* Left Panel: QR & Print Branding */}
            <div className="flex-1 bg-white border-r border-slate-200 p-12 flex flex-col items-center justify-center space-y-8 overflow-y-auto">
              <div className="text-center space-y-2">
                 <Badge className="bg-indigo-600 text-white rounded-full px-4 border-0">Label Preview</Badge>
                 <h3 className="text-xl font-black text-slate-900">Thermal Print Asset Tag</h3>
                 <p className="text-sm text-slate-400 font-medium">Auto-generated unique tracking label</p>
              </div>

              {/* QR Label Visual */}
              <div 
                className="bg-white border-2 border-slate-900 p-6 rounded-2xl shadow-2xl flex items-center gap-6 transition-all duration-300"
                style={{ 
                  width: qrSize === 'large' ? '400px' : qrSize === 'medium' ? '320px' : '280px',
                  minHeight: qrSize === 'large' ? '200px' : '160px'
                }}
              >
                <div id="printable-qr" className="shrink-0 p-2 bg-white border border-slate-100 rounded-xl">
                  <QRCodeSVG 
                    value={`${window.location.origin}/public/asset/${editingUnit.id}`} 
                    size={qrSize === 'large' ? 140 : qrSize === 'medium' ? 100 : 80}
                    level="H"
                  />
                </div>
                <div className="space-y-1 overflow-hidden">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Inventory Management</p>
                  <h4 className="text-lg font-black text-slate-900 truncate leading-tight">
                    {asset.name} {editingUnit.serial_number?.split('-').pop() || '000'}
                  </h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{editingUnit.serial_number}</p>
                  <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mt-2">© ERP_NET SYNC 2026</p>
                </div>
              </div>

              {/* Print Controls */}
              <div className="w-full max-w-xs space-y-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Label Size (Thermal Specs)</Label>
                    <SimpleSelect value={qrSize} onValueChange={setQrSize} className="h-10 text-xs rounded-xl font-bold">
                       <option value="small">Small Thermal (40x30mm)</option>
                       <option value="medium">Standard Label (50x30mm)</option>
                       <option value="large">Large Shipping (100x50mm)</option>
                    </SimpleSelect>
                 </div>
                 <Button onClick={handlePrintQR} className="w-full bg-slate-900 hover:bg-black text-white h-12 rounded-xl font-black gap-2 shadow-xl shadow-slate-200">
                    <PrinterIcon className="w-5 h-5" /> Print Thermal Tag
                 </Button>
              </div>
            </div>

            {/* Right Panel: Data Update Form */}
            <div className="w-full max-w-md bg-slate-50 h-full shadow-inner flex flex-col">
              <div className="p-8 pb-4">
                <div className="flex justify-between items-start mb-2">
                   <h2 className="text-2xl font-black text-slate-900 tracking-tight">Update Information</h2>
                   <Button variant="ghost" onClick={() => setEditingUnit(null)} className="rounded-full h-8 w-8 p-0 hover:bg-slate-200">×</Button>
                </div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Global Asset ID: {editingUnit.id}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-4">
                <form onSubmit={handleUpdateUnit} className="space-y-8">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Current Status</Label>
                        <SimpleSelect 
                          value={editingUnit.status} 
                          onValueChange={(v) => setEditingUnit({...editingUnit, status: v as any})}
                          className="h-12 border-slate-200 rounded-xl bg-slate-50/50"
                        >
                          <option value="in_stock">Available / In Stock</option>
                          <option value="deployed">Deployed to Client</option>
                          <option value="maintenance">Under Maintenance</option>
                          <option value="disposed">🗑️ Disposed / Dimusnahkan</option>
                          <option value="sold">💰 Sold / Terjual</option>
                        </SimpleSelect>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Physical Condition</Label>
                        <SimpleSelect 
                          value={editingUnit.condition} 
                          onValueChange={(v) => setEditingUnit({...editingUnit, condition: v as any})}
                          className="h-12 border-slate-200 rounded-xl bg-slate-50/50"
                        >
                          <option value="new">🆕 New / Baru</option>
                          <option value="second">🔄 Second / Bekas</option>
                          <option value="broken">⚠️ Broken / Rusak</option>
                          <option value="refurbished">🛠️ Refurbished</option>
                        </SimpleSelect>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Location / Site Name</Label>
                        <div className="relative">
                          <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input 
                            value={editingUnit.location} 
                            onChange={(e) => setEditingUnit({...editingUnit, location: e.target.value})}
                            className="pl-10 h-12 border-slate-200 rounded-xl bg-slate-50/50" 
                          />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Updated By (Personnel)</Label>
                        <div className="relative">
                          <CheckCircleIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input 
                            placeholder="Enter your name / staff ID" 
                            className="pl-10 h-12 border-slate-200 rounded-xl bg-slate-50/50" 
                            value={editingUnit.last_checked_by || ""}
                            onChange={(e) => setEditingUnit({...editingUnit, last_checked_by: e.target.value})}
                          />
                        </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={isUpdating} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black gap-3 shadow-2xl shadow-indigo-100 transition-all active:scale-[0.98]">
                    {isUpdating ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <CheckCircleIcon className="w-6 h-6" />
                    )}
                    Sync & Save Changes
                  </Button>
                </form>

                <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 mt-8 space-y-3">
                   <div className="flex items-center gap-2">
                      <ArrowsPointingOutIcon className="w-4 h-4 text-indigo-500" />
                      <h5 className="font-black text-indigo-900 text-xs uppercase">Audit Log Info</h5>
                   </div>
                   <p className="text-[10px] text-indigo-700 leading-relaxed italic font-medium">
                     Setiap perubahan data unit akan langsung memicu pembaruan pada dashboard Finance pusat dan tercatat di riwayat aset permanen.
                   </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Advanced Batch Print Preview Modal */}
      <Modal
        isOpen={isBatchPrintModalOpen}
        onClose={() => setIsBatchPrintModalOpen(false)}
        title="Batch Print Preview"
        subtitle="Configure your layout before printing all asset labels"
        size="xl"
        className="bg-slate-50"
        footer={
          <div className="flex gap-3 w-full justify-between items-center">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
               Total Labels: {filteredInstances.length} Units
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsBatchPrintModalOpen(false)} className="rounded-xl font-bold">Cancel</Button>
              <Button onClick={handlePrintBatchExecute} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black gap-2 px-8 shadow-lg shadow-indigo-100 italic">
                 <PrinterIcon className="w-4 h-4" /> Go Print
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 py-4 h-[600px]">
           {/* Controls Side */}
           <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-2">
              <div className="space-y-4">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Printer Platform</Label>
                 <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => setPrinterType('thermal')}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${printerType === 'thermal' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500'}`}
                    >
                       <DocumentIcon className="w-5 h-5" />
                       <div className="text-left">
                          <p className="text-xs font-black">Thermal Printer</p>
                          <p className="text-[10px] opacity-70">Roll Label (One by one)</p>
                       </div>
                    </button>
                    <button 
                      onClick={() => setPrinterType('regular')}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${printerType === 'regular' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500'}`}
                    >
                       <Squares2X2Icon className="w-5 h-5" />
                       <div className="text-left">
                          <p className="text-xs font-black">Ordinary Printer</p>
                          <p className="text-[10px] opacity-70">A4 Paper (Grid Layout)</p>
                       </div>
                    </button>
                 </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Layout Settings</Label>
                 
                 <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-600">Show Borders</div>
                    <input 
                      type="checkbox" 
                      checked={showBorder} 
                      onChange={(e) => setShowBorder(e.target.checked)}
                      className="w-5 h-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                 </div>

                 {printerType === 'regular' && (
                    <div className="space-y-2">
                       <p className="text-[10px] font-bold text-slate-500">Labels Per Row</p>
                       <div className="flex gap-2">
                          {[2, 3, 4].map(num => (
                             <button 
                                key={num}
                                onClick={() => setLabelsPerRow(num)}
                                className={`flex-1 py-2 text-xs font-black rounded-lg border ${labelsPerRow === num ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}
                             >
                                {num}
                             </button>
                          ))}
                       </div>
                    </div>
                 )}
              </div>
           </div>

           {/* Preview Side */}
           <div className="lg:col-span-3 bg-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-inner">
              <div className="bg-slate-800 p-2 flex items-center justify-between px-4">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Interactive Print Preview
                 </span>
                 <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 bg-[#525659]">
                 <div 
                    className={`bg-white shadow-2xl mx-auto transition-all transition-duration-500 ${printerType === 'regular' ? 'w-[400px] min-h-[560px] p-6' : 'w-[200px] p-2'}`}
                 >
                    <div className={printerType === 'regular' ? `grid grid-cols-${labelsPerRow} gap-2` : 'space-y-2'}>
                        {filteredInstances.map((instance, i) => (
                           <div 
                             key={i} 
                             className={`flex items-center gap-2 p-2 ${showBorder ? 'border border-slate-200 rounded' : ''} ${printerType === 'thermal' ? 'mb-2' : ''}`}
                             style={{ height: printerType === 'regular' ? '60px' : 'auto' }}
                           >
                              <div className="w-[30%] shrink-0">
                                 <QRCodeSVG 
                                   id={`qr-preview-${instance.id}`} 
                                   value={`ASSET://${instance.id}`} 
                                   size={printerType === 'regular' ? 35 : 45} 
                                   level="H"
                                 />
                              </div>
                              <div className="flex-1 overflow-hidden space-y-0.5">
                                 <p className="text-[5px] font-black uppercase tracking-[0.1em] text-indigo-600">Inventory Management</p>
                                 <p className="text-[8px] font-bold leading-tight truncate text-slate-900">
                                   {asset.name} {instance.serial_number?.split('-').pop() || '000'}
                                 </p>
                                 <p className="text-[6px] text-slate-400 font-bold truncate tracking-widest uppercase">{instance.serial_number}</p>
                                 <p className="text-[5px] text-slate-300 font-bold uppercase tracking-widest leading-none mt-1">© ERP_NET SYNC 2026</p>
                              </div>
                           </div>
                        ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </Modal>

      {/* Global Settings Modal */}
      <Modal
        isOpen={isGlobalSettingsOpen}
        onClose={() => setIsGlobalSettingsOpen(false)}
        title="Global Asset Settings"
        subtitle={`Configure ${asset.name} properties`}
        size="lg"
        className="bg-white"
      >
        <div className="space-y-8 py-4">
           {/* General Metadata */}
           <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                 Metadata Updates
              </h4>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <Label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Asset Name</Label>
                     <Input defaultValue={asset.name} className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-600 transition-all font-bold text-slate-900" />
                  </div>
                  <div className="space-y-1">
                     <Label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Asset Category</Label>
                     <SimpleSelect defaultValue={asset.category} className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-bold text-slate-900">
                       <option value="router">Router & Networking</option>
                       <option value="olt">OLT & Infrastructure</option>
                       <option value="accessories">Accessories</option>
                       <option value="cables">Cables & Fiber</option>
                       <option value="others">Others</option>
                    </SimpleSelect>
                 </div>
                 <div className="col-span-2 space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Base Description</Label>
                     <textarea 
                       className="w-full p-4 text-sm bg-slate-50/50 border border-slate-200 rounded-2xl min-h-[100px] focus:ring-2 focus:ring-indigo-600 focus:bg-white outline-none transition-all font-medium text-slate-600 leading-relaxed"
                       defaultValue={asset.description}
                     />
                 </div>
              </div>
           </div>

           {/* Bulk Sync Section */}
           <div className="p-8 bg-[#0f172a] rounded-[2rem] text-white space-y-5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full -mr-16 -mt-16 blur-3xl" />
              <div className="flex items-center gap-3 relative z-10">
                 <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-indigo-400">
                    <CpuChipIcon className="w-6 h-6 border-indigo-400" />
                 </div>
                 <div>
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Bulk Sync Actions</h4>
                    <p className="text-[10px] text-slate-400 font-bold">Instantly synchronize state across 15 identified units</p>
                 </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-3 relative z-10 pt-2">
                 <SimpleSelect 
                    className="flex-1 bg-white/5 border-white/10 text-white rounded-xl h-12 font-bold px-4 hover:border-white/20 transition-all appearance-none"
                    value={bulkStatus}
                    onValueChange={setBulkStatus}
                 >
                    <option value="" className="bg-[#0f172a]">Select Target Status...</option>
                    <option value="maintenance" className="bg-[#0f172a]">🛠️ Force All to Maintenance</option>
                    <option value="in_stock" className="bg-[#0f172a]">✅ Mark All as Available</option>
                    <option value="deployed" className="bg-[#0f172a]">📦 Mark All as Deployed</option>
                 </SimpleSelect>
                 <Button 
                   className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black px-8 h-12 shadow-xl shadow-indigo-900/40 border-0 transition-all active:scale-95"
                   onClick={handleBulkStatusUpdate}
                   disabled={!bulkStatus || isUpdating}
                 >
                   {isUpdating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Sync Globally"}
                 </Button>
              </div>
           </div>

           <div className="pt-2">
              <Button className="w-full bg-[#0f172a] hover:bg-black text-white h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-200/50">
                 Commit Metadata Changes
              </Button>
           </div>

            {/* Danger Zone */}
            <div className="pt-6 border-t border-slate-100 space-y-4">
               <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Danger Zone
               </h4>
               <div className="pt-2">
                  <Button 
                    variant="outline" 
                    className="w-full h-12 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transition-colors"
                    onClick={() => setIsDeleteModalOpen(true)}
                    disabled={isUpdating}
                  >
                    <ArchiveBoxIcon className="w-4 h-4" />
                    Delete this Asset
                  </Button>
               </div>
               <p className="text-[9px] text-slate-400 font-medium text-center italic">Actions in this zone are permanent and cannot be reversed.</p>
            </div>
        </div>
      </Modal>

      {/* Activity Logs Modal */}
      <Modal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        title="Asset Activity Stream"
        subtitle={`Tracking records for ${asset.code}`}
        size="lg"
      >
        <div className="space-y-6 py-4 max-h-[500px] overflow-y-auto pr-2">
           {logs.map((log, i) => (
              <div key={log.id} className="relative pl-8 pb-8 border-l-2 border-slate-100 last:border-0 last:pb-0">
                 <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-indigo-600 shadow-sm" />
                 
                 <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm hover:border-indigo-200 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-tighter">
                          {log.action.replace(/_/g, ' ')}
                       </span>
                       <span className="text-[10px] font-bold text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 mb-1">
                       Actor: <span className="font-mono text-indigo-600">{log.actor}</span>
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed italic">
                       {log.notes}
                    </p>
                    {log.from_value && log.to_value && (
                       <div className="mt-3 flex items-center gap-2 border-t border-slate-50 pt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          CHANGE: {log.from_value} → {log.to_value}
                       </div>
                    )}
                 </div>
              </div>
           ))}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Deletion"
        size="md"
      >
        <div className="p-1 space-y-6">
          <div className="flex flex-col items-center justify-center text-center gap-4 py-4">
             <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-600 mb-2">
                <ArchiveBoxIcon className="w-8 h-8" />
             </div>
             <p className="text-sm font-bold text-slate-600 leading-relaxed max-w-[300px]">
               Are you sure you want to delete this asset and all its instances? This action cannot be undone.
             </p>
          </div>
          
          <div className="flex gap-3 pt-2">
             <Button 
               variant="outline" 
               className="flex-1 h-12 rounded-xl font-bold border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
               onClick={() => setIsDeleteModalOpen(false)}
             >
                Cancel
             </Button>
             <Button 
               className="flex-1 h-12 rounded-xl font-black bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-200 transition-all active:scale-95"
               onClick={handleDeleteAsset}
               disabled={isUpdating}
             >
                {isUpdating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Confirm Delete"}
             </Button>
          </div>
        </div>
      </Modal>
    </>
    )}
  </div>
</PageLayout>
);
}
