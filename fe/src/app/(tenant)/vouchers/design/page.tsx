"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShoppingBag, 
  Palette, 
  CheckCircle2, 
  Globe, 
  UserCircle,
  AlertCircle,
  Layout,
  LayoutGrid,
  ShieldCheck,
  ArrowRight,
  Info,
  ArrowLeft,
  RotateCw,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { voucherService } from '@/lib/api/voucherService';
import { VoucherDesign, Tenant } from '@/lib/api/types';
import { useNotificationStore } from '@/stores/notificationStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VOUCHER_TEMPLATES, getTemplateBySlug } from '@/components/vouchers/templates/registry';

export default function VoucherDesignManagementPage() {
  const router = useRouter();
  const { tenant, refreshTenant } = useAuth();
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [ownedDesigns, setOwnedDesigns] = useState<VoucherDesign[]>([]);
  const [allDesigns, setAllDesigns] = useState<VoucherDesign[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [owned, all] = await Promise.all([
        voucherService.listOwnedDesigns(),
        voucherService.listDesigns()
      ]);
      setOwnedDesigns([
        ...owned,
        {
          id: "design-modern",
          slug: "modern",
          name: "Modern QR",
          description: "Desain modern dengan QR code dan info lengkap.",
          price: 0,
          is_free: true,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ]);
      setAllDesigns(all);
    } catch (error) {
      showToast({ title: "Gagal memuat data", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdateSettings = async (defaultSlugs: string[], resellerSlugs: string[]) => {
    setUpdating("global");
    try {
      // Filter out empty strings if any
      const cleanedDefaults = defaultSlugs.filter(s => s.trim() !== "");
      const cleanedResellers = resellerSlugs.filter(s => s.trim() !== "");
      
      await voucherService.updateDesignSettings(cleanedDefaults, cleanedResellers);
      showToast({ 
        title: "Konfigurasi Disimpan", 
        description: "Koleksi desain global berhasil diperbarui.",
        variant: "success" 
      });
      await refreshTenant();
    } catch (error: any) {
      showToast({ title: "Gagal menyimpan", description: error.message, variant: "error" });
    } finally {
      setUpdating(null);
    }
  };

  const handlePurchase = async (design: VoucherDesign) => {
    setUpdating(design.id);
    try {
      await voucherService.purchaseDesign(design.id);
      showToast({ 
        title: "Pembelian Berhasil", 
        description: `Desain "${design.name}" sekarang ada di koleksi Anda.`,
        variant: "success" 
      });
      await load();
    } catch (error: any) {
      showToast({ title: "Gagal membeli", description: error.message, variant: "error" });
    } finally {
      setUpdating(null);
    }
  };

  // Mock data for preview rendering
  const mockVoucher = { code: "X27F9", password: "9212" };
  const mockPackage = { name: "2 Jam Rp 5rb" };
  const mockConfig = { 
    label: tenant?.name || "HOTSPOT", 
    dnsName: "hotspot.net",
    selectedDesignSlug: "" 
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="space-y-4">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/vouchers')}
            className="group p-0 hover:bg-transparent text-slate-500 hover:text-purple-600 transition-colors font-bold flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            Kembali ke Vouches
          </Button>
          
          <div className="space-y-2">
            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none px-3 py-1 text-xs font-bold uppercase tracking-wider">
              Premium Customization
            </Badge>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <Layout className="w-10 h-10 text-purple-600" />
              Voucher Design Management
            </h1>
            <p className="text-slate-500 text-lg font-medium max-w-2xl">
              Kelola identitas visual voucher WiFi Anda. Atur desain standar untuk tenant dan paksakan branding reseller dari satu tempat.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="inventory" className="space-y-8">
        <div className="flex items-center justify-between">
          <TabsList className="bg-slate-100 p-1.5 rounded-2xl h-14 w-full max-w-md border border-slate-200">
            <TabsTrigger 
              value="inventory" 
              className="rounded-xl flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-purple-600 font-bold transition-all h-full"
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              My Collection
            </TabsTrigger>
            <TabsTrigger 
              value="store" 
              className="rounded-xl flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-amber-600 font-bold transition-all h-full"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Design Store
            </TabsTrigger>
          </TabsList>
        </div>

        {/* MY COLLECTION TAB */}
        <TabsContent value="inventory" className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Design Selector Cards */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ownedDesigns.map((design) => {
                  const templateData = getTemplateBySlug(design.slug);
                  const Template = templateData.component;
                  const isGlobalDefault = Array.isArray(tenant?.default_voucher_design_slug) 
                    ? tenant?.default_voucher_design_slug?.includes(design.slug)
                    : tenant?.default_voucher_design_slug === design.slug;
                    
                  const isResellerDefault = Array.isArray(tenant?.reseller_voucher_design_slug)
                    ? tenant?.reseller_voucher_design_slug?.includes(design.slug)
                    : tenant?.reseller_voucher_design_slug === design.slug;

                  return (
                    <Card key={design.id} className={`group relative overflow-hidden transition-all duration-300 hover:shadow-2xl border-2 ${isGlobalDefault || isResellerDefault ? 'border-purple-500 shadow-purple-500/5' : 'border-slate-100 hover:border-slate-300'}`}>
                      <CardHeader className="p-5 pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-xl font-black text-slate-800">{design.name}</CardTitle>
                            <CardDescription className="text-xs uppercase font-bold tracking-widest mt-1 opacity-70">Slug: {design.slug}</CardDescription>
                          </div>
                          {(isGlobalDefault || isResellerDefault) && (
                            <Badge className="bg-purple-600 text-white border-none">
                              Active
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-5">
                        {/* Preview Area */}
                        <div className="aspect-[1.6/1] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center p-4 mb-6 group-hover:bg-slate-100/50 transition-colors transform group-hover:scale-[1.02] duration-500 origin-center overflow-hidden">
                          <div className="transform scale-[0.8] origin-center">
                             <Template 
                               voucher={mockVoucher as any} 
                               index={0}
                               pkg={mockPackage as any} 
                               config={{...mockConfig, selectedDesignSlug: design.slug}} 
                             />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-1 gap-3">
                          <Button 
                            variant={isGlobalDefault ? "secondary" : "outline"}
                            className={`w-full justify-between h-12 rounded-xl transition-all ${isGlobalDefault ? 'bg-purple-50 text-purple-700 border-purple-200' : 'hover:bg-slate-50'}`}
                            disabled={updating === "global"}
                            onClick={() => {
                              const current = Array.isArray(tenant?.default_voucher_design_slug) 
                                ? tenant?.default_voucher_design_slug 
                                : (tenant?.default_voucher_design_slug ? [tenant.default_voucher_design_slug as unknown as string] : []);
                                
                              const next = current.includes(design.slug) 
                                ? current.filter(s => s !== design.slug) 
                                : [...current, design.slug];
                              
                              if (next.length > current.length && next.length > 3) {
                                showToast({ 
                                  title: "Limit Tercapai", 
                                  description: "Anda hanya bisa memilih maksimal 3 desain default.",
                                  variant: "error" 
                                });
                                return;
                              }
                              
                              const resellerSlugs = Array.isArray(tenant?.reseller_voucher_design_slug)
                                ? tenant?.reseller_voucher_design_slug
                                : (tenant?.reseller_voucher_design_slug ? [tenant.reseller_voucher_design_slug as unknown as string] : []);

                              console.log("Updating default designs:", next);
                              handleUpdateSettings(next, resellerSlugs);
                            }}
                          >
                            <span className="flex items-center">
                              {updating === "global" ? <RotateCw className="w-4 h-4 mr-2 animate-spin" /> : <UserCircle className="w-4 h-4 mr-2" />}
                              Default Design
                            </span>
                            {isGlobalDefault && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                          </Button>

                          <Button 
                            variant={isResellerDefault ? "secondary" : "outline"}
                            className={`w-full justify-between h-12 rounded-xl transition-all ${isResellerDefault ? 'bg-amber-50 text-amber-700 border-amber-200' : 'hover:bg-slate-50'}`}
                            disabled={updating === "global"}
                            onClick={() => {
                              const current = Array.isArray(tenant?.reseller_voucher_design_slug) 
                                ? tenant?.reseller_voucher_design_slug 
                                : (tenant?.reseller_voucher_design_slug ? [tenant.reseller_voucher_design_slug as unknown as string] : []);

                              const next = current.includes(design.slug) 
                                ? current.filter(s => s !== design.slug) 
                                : [...current, design.slug];
                              
                              if (next.length > current.length && next.length > 3) {
                                showToast({ 
                                  title: "Limit Tercapai", 
                                  description: "Anda hanya bisa memilih maksimal 3 desain reseller.",
                                  variant: "error" 
                                });
                                return;
                              }
                              
                              const defaultSlugs = Array.isArray(tenant?.default_voucher_design_slug)
                                ? tenant?.default_voucher_design_slug
                                : (tenant?.default_voucher_design_slug ? [tenant.default_voucher_design_slug as unknown as string] : []);

                              console.log("Updating reseller designs:", next);
                              handleUpdateSettings(defaultSlugs, next);
                            }}
                          >
                            <span className="flex items-center">
                              {updating === "global" ? <RotateCw className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                              Design Reseller
                            </span>
                            {isResellerDefault && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Quick Summary / Status Sidebar */}
            <div className="space-y-6">
              <Card className="rounded-3xl border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full -translate-y-16 translate-x-16 blur-3xl opacity-50" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-purple-400" />
                    Status Branding Global
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 relative z-10">
                    <div className="bg-white/5 p-5 rounded-2xl space-y-3">
                      <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Default Templates</p>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(tenant?.default_voucher_design_slug) && tenant.default_voucher_design_slug.length > 0 ? (
                          tenant.default_voucher_design_slug.map(slug => (
                            <Badge key={slug} className="bg-purple-500/20 text-purple-200 border-none">
                              {ownedDesigns.find(d => d.slug === slug)?.name || slug}
                            </Badge>
                          ))
                        ) : tenant?.default_voucher_design_slug && typeof tenant.default_voucher_design_slug === 'string' ? (
                          <Badge className="bg-purple-500/20 text-purple-200 border-none">
                            {ownedDesigns.find(d => d.slug === tenant.default_voucher_design_slug)?.name || tenant.default_voucher_design_slug}
                          </Badge>
                        ) : (
                          <span className="text-slate-500 text-sm italic">Desain Simple (Standard)</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-white/5 p-5 rounded-2xl space-y-3">
                      <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Reseller Allowed Designs</p>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(tenant?.reseller_voucher_design_slug) && tenant.reseller_voucher_design_slug.length > 0 ? (
                          tenant.reseller_voucher_design_slug.map(slug => (
                            <Badge key={slug} className="bg-amber-500/20 text-amber-200 border-none">
                              {ownedDesigns.find(d => d.slug === slug)?.name || slug}
                            </Badge>
                          ))
                        ) : tenant?.reseller_voucher_design_slug && typeof tenant.reseller_voucher_design_slug === 'string' ? (
                          <Badge className="bg-amber-500/20 text-amber-200 border-none">
                            {ownedDesigns.find(d => d.slug === tenant.reseller_voucher_design_slug)?.name || tenant.reseller_voucher_design_slug}
                          </Badge>
                        ) : (
                          <span className="text-slate-500 text-sm italic">Desain Simple (Standard)</span>
                        )}
                      </div>
                    </div>

                  <div className="pt-4 flex items-start gap-3 text-sm text-slate-300 leading-relaxed italic">
                    <AlertCircle className="w-5 h-5 text-purple-400 shrink-0" />
                    Konfigurasi global ini akan digunakan secara otomatis jika router tidak memiliki setingan branding khusus.
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-slate-100 bg-slate-50/50 shadow-sm border-2">
                <CardHeader>
                  <CardTitle className="text-lg">Tips Branding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <div className="bg-white w-8 h-8 rounded-lg flex items-center justify-center shadow-sm text-purple-600 font-bold border border-slate-100">1</div>
                    <p className="text-sm text-slate-600 leading-snug">Gunakan desain <b>Mikhmon</b> untuk tampilan klasik yang familiar bagi pelanggan.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-white w-8 h-8 rounded-lg flex items-center justify-center shadow-sm text-purple-600 font-bold border border-slate-100">2</div>
                    <p className="text-sm text-slate-600 leading-snug">Aktifkan <b>Paksaan Reseller</b> agar agen penjualan Anda tetap mengikuti identitas bisnis Anda.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* STORE TAB */}
        <TabsContent value="store" className="animate-in slide-in-from-right-4 duration-500">
          <div className="relative rounded-[2.5rem] bg-gradient-to-br from-amber-500 to-orange-600 p-10 text-white mb-12 overflow-hidden shadow-2xl shadow-amber-500/20">
             <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
               <div className="space-y-4 max-w-2xl text-center md:text-left">
                  <Badge className="bg-white/20 text-white hover:bg-white/30 border-none px-4 py-1.5 backdrop-blur-md">
                    Limited Collections
                  </Badge>
                  <h2 className="text-5xl font-black leading-tight tracking-tight">Eksplor Galeri Desain Voucher Terkini</h2>
                  <p className="text-amber-50 font-medium text-lg opacity-90">Koleksi desain voucher yang dirancang khusus untuk meningkatkan nilai jual brand hotspot Anda. Sekali beli, milik selamanya.</p>
               </div>
               <div className="bg-white/10 backdrop-blur-xl rounded-full p-10 border border-white/20">
                  <ShoppingBag className="w-24 h-24 text-white animate-pulse" />
               </div>
             </div>
             <Sparkles className="absolute -right-10 -bottom-10 w-96 h-96 opacity-10 rotate-12" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {allDesigns.filter(d => !ownedDesigns.some(od => od.id === d.id)).map((design) => {
              const templateData = getTemplateBySlug(design.slug);
              const Template = templateData.component;
              return (
                <Card key={design.id} className="group overflow-hidden rounded-[2rem] border-none shadow-lg hover:shadow-2xl transition-all duration-500 flex flex-col">
                  {/* Preview Section */}
                  <div className="aspect-[1.6/1] bg-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="transform scale-[0.75] group-hover:scale-90 transition-transform duration-700">
                       <Template 
                         voucher={mockVoucher as any} 
                         index={0}
                         pkg={mockPackage as any} 
                         config={{...mockConfig, selectedDesignSlug: design.slug}} 
                       />
                    </div>
                  </div>
                  
                  <CardContent className="p-8 space-y-6 bg-white flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-black text-slate-800">{design.name}</CardTitle>
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 px-2 py-0">Hot Item</Badge>
                      </div>
                      <p className="text-slate-500 line-clamp-2 text-sm leading-relaxed">{design.description || "Desain eksklusif untuk mempercantik kartu voucher hotspot WiFi Anda."}</p>
                    </div>

                    <div className="space-y-4 pt-2">
                       <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                          <span className="text-slate-400 font-bold uppercase tracking-tighter text-xs">Harga Design</span>
                          <span className="text-3xl font-black text-slate-900">
                             {design.price === 0 ? "FREE" : `Rp ${design.price.toLocaleString()}`}
                          </span>
                       </div>
                       
                       <Button 
                        className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-lg group transition-all"
                        onClick={() => handlePurchase(design)}
                        disabled={updating === design.id}
                       >
                         {updating === design.id ? "Memproses..." : (
                           <span className="flex items-center">
                             Beli & Amankan Sekarang
                             <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                           </span>
                         )}
                       </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {allDesigns.filter(d => !ownedDesigns.some(od => od.id === d.id)).length === 0 && (
            <div className="text-center py-24 bg-slate-50 rounded-[3rem] border border-dashed border-slate-300">
               <CheckCircle2 className="w-16 h-16 text-purple-400 mx-auto mb-4" />
               <h3 className="text-2xl font-black text-slate-800">Luar Biasa!</h3>
               <p className="text-slate-500">Anda sudah memiliki semua koleksi desain kami. Tunggu update desain menarik lainnya.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
