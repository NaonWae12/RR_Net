"use client";

import React, { useEffect, useState } from "react";
import { PageLayout } from "@/components/layouts";
import { subscriptionService, PlatformInvoice, PlatformAddon, TenantAddon } from "@/lib/api/subscriptionService";
import { LoadingSpinner } from "@/components/utilities";
import { useAuthStore } from "@/stores/authStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, History, Package, AlertCircle, CheckCircle2, Zap, Users, Shield, ArrowRight, MessageSquare, Bot, Globe, MessageCircle, Rocket, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import SubscriptionPaymentModal from "@/components/subscription/SubscriptionPaymentModal";
import ChangePlanModal from "@/components/subscription/ChangePlanModal";
import AddonPurchaseDialog from "@/components/subscription/AddonPurchaseDialog";
import { affiliateService } from "@/lib/api/affiliateService";

export default function SubscriptionPage() {
  const { tenant } = useAuthStore();
  const { data: dashboardData, fetchBootstrapData } = useDashboardStore();
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [availableAddons, setAvailableAddons] = useState<PlatformAddon[]>([]);
  const [myAddons, setMyAddons] = useState<TenantAddon[]>([]);
   const [loading, setLoading] = useState(true);
  const [showPlanDetails, setShowPlanDetails] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PlatformInvoice | null>(null);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<{ id: string, name: string, price: number, currency: string } | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false);
  const [joiningAffiliate, setJoiningAffiliate] = useState(false);
  const [affiliateStatus, setAffiliateStatus] = useState<string>("unregistered");
  const [selectedAddonForPurchase, setSelectedAddonForPurchase] = useState<PlatformAddon | null>(null);
  const [addonPurchaseData, setAddonPurchaseData] = useState<{ addon: PlatformAddon; quantity: number } | null>(null);

  const { showToast } = useNotificationStore();
  const router = useRouter();

  const refreshInvoices = async () => {
    try {
      const invData = await subscriptionService.getMyInvoices();
      setInvoices(invData);
    } catch (error) {
      console.error("Failed to refresh invoices:", error);
    }
  };

  const handlePlanChangeSuccess = () => {
    // Force refresh dashboard data to reflect new plan limits/features
    const store = useDashboardStore.getState();
    store.reset();
    fetchBootstrapData();
  };

  const handlePayClick = (invoice: PlatformInvoice) => {
    setSelectedInvoice(invoice);
    setIsPaymentModalOpen(true);
  };

  const handleJoinAffiliate = async () => {
    try {
      setJoiningAffiliate(true);
      await affiliateService.joinProgram();
      showToast({ title: "Berhasil!", description: "Permintaan bergabung telah diajukan. Menunggu persetujuan admin.", variant: "success" });
      setAffiliateStatus("pending");
    } catch (error: any) {
      showToast({ title: "Gagal", description: error.response?.data?.error || "Terjadi kesalahan", variant: "error" });
    } finally {
      setJoiningAffiliate(false);
    }
  };

  // Open purchase dialog when tenant clicks Install
  const handleInstallAddon = (addon: PlatformAddon) => {
    setSelectedAddonForPurchase(addon);
  };

  // After quantity confirmed in purchase dialog → open payment modal
  const handleAddonPurchaseConfirm = async (addon: PlatformAddon, quantity: number) => {
    setSelectedAddonForPurchase(null); // close purchase dialog
    setAddonPurchaseData({ addon, quantity });

    try {
      setLoading(true);
      // Create addon purchase (creates invoice, does NOT activate yet)
      const invoice = await subscriptionService.purchaseAddon(addon.id, quantity);
      
      // Select the new invoice and open payment modal
      setSelectedInvoice(invoice);
      setIsPaymentModalOpen(true);

      // Refresh invoices list so the new one shows up
      const invData = await subscriptionService.getMyInvoices();
      setInvoices(invData);
      
    } catch (error: any) {
      showToast({
        title: "Gagal",
        description: error.response?.data?.error || "Gagal membuat tagihan add-on",
        variant: "error",
      });
    } finally {
      setLoading(false);
      setAddonPurchaseData(null);
    }
  };

  const handleCancelRenewal = async (addonId: string) => {
    try {
      setLoading(true);
      await subscriptionService.cancelAddonRenewal(addonId);
      showToast({
        title: "Berhasil",
        description: "Perpanjangan Add-on berhasil dibatalkan.",
        variant: "success",
      });
      // Refresh My Addons
      const myData = await subscriptionService.getMyAddons();
      setMyAddons(myData);
    } catch (error: any) {
      showToast({
        title: "Gagal",
        description: error.response?.data?.error || "Gagal membatalkan perpanjangan add-on",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBootstrapData();
    const fetchData = async () => {
      try {
        const [invData, availData, myData, affStatus] = await Promise.all([
          subscriptionService.getMyInvoices(),
          subscriptionService.getAvailableAddons(),
          subscriptionService.getMyAddons(),
          affiliateService.getMyStatus()
        ]);
        setInvoices(invData);
        setAvailableAddons(availData);
        setMyAddons(myData);
        setAffiliateStatus(affStatus.status);
      } catch (error) {
        console.error("Failed to fetch subscription data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [fetchBootstrapData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-amber-100 text-amber-700";
      case "overdue":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const plan = dashboardData?.plan;
  const features = dashboardData?.features || {};
  const limits = dashboardData?.limits || {};

  return (
    <PageLayout
      title="Subscription Management"
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Subscription" },
      ]}
    >
      <div className="space-y-6 pb-20">
        {/* Current Plan Card */}
        <Card className="overflow-hidden border-none bg-linear-to-br from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-lg">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-indigo-100" />
                  <span className="text-sm font-medium text-indigo-100 uppercase tracking-wider">Active Subscription</span>
                </div>
                <div>
                  <h2 className="text-4xl font-black tracking-tight">{plan?.name || "Standard Plan"}</h2>
                  <p className="mt-2 text-indigo-100 text-lg opacity-90 max-w-md">
                    Empowering your network operations with premium features and dedicated support.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 pt-2">
                  <button
                    onClick={() => setIsChangePlanModalOpen(true)}
                    title="Click to upgrade or manage your plan"
                    className="bg-white/10 backdrop-blur-md rounded-full px-4 py-1.5 flex items-center gap-2 border border-white/20 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all text-white outline-none ring-offset-indigo-600 focus:ring-2 focus:ring-white/40"
                  >
                    <Shield className="h-4 w-4 text-emerald-300" />
                    <span className="text-xs font-semibold">Enterprise Verified</span>
                  </button>
                  <Button 
                    variant="ghost" 
                    className="text-white hover:bg-white/10 flex items-center gap-2"
                    onClick={() => window.open('#', '_blank')}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Join Community
                  </Button>
                </div>
              </div>

              <div className="flex flex-col items-end gap-6">
                <div className="text-right">
                  <p className="text-sm text-indigo-100 opacity-80 uppercase font-semibold">Monthly Investment</p>
                  <p className="text-4xl font-black">
                    {plan ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: plan.currency, minimumFractionDigits: 0 }).format(plan.price_monthly) : 'N/A'}
                  </p>
                  <p className="text-xs text-indigo-100 opacity-70 mt-1">Next payment: {invoices.length > 0 && invoices[0].status === "pending" ? format(new Date(invoices[0].due_date), "MMM d, yyyy") : "Automated"}</p>
                </div>
                <Button 
                  onClick={() => setShowPlanDetails(!showPlanDetails)}
                  className="bg-white text-indigo-600 hover:bg-slate-50 font-bold px-8 py-6 rounded-xl shadow-xl hover:shadow-2xl transition-all"
                >
                  {showPlanDetails ? "Hide Plan Details" : "Manage Plan Details"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Plan Info (Conditional) */}
        {showPlanDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Features Detail */}
            <Card className="border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Zap className="h-5 w-5 text-emerald-500" />
                  Active Feature Matrix
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {Object.entries(features).map(([code, enabled]) => (
                    <div key={code} className="flex items-center gap-2 text-sm">
                      {enabled ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-slate-300 shrink-0" />
                      )}
                      <span className={enabled ? "text-slate-700 font-medium" : "text-slate-400 line-through"}>
                        {code.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quota detail */}
            <Card className="border-slate-200 shadow-sm border-l-4 border-l-indigo-500">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-500" />
                  Resource Allocation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(limits).map(([name, value]) => (
                  <div key={name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 font-medium">
                        {name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </span>
                      <span className="font-bold text-slate-900">
                        {value === -1 ? 'Unlimited' : value}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full" 
                        style={{ width: value === -1 ? '100%' : '65%' }} 
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Affiliate Promotion Banner */}
        <Card className={cn(
          "border-none text-white shadow-lg overflow-hidden relative",
          affiliateStatus === 'active' ? "bg-linear-to-r from-indigo-500 to-purple-600" :
          affiliateStatus === 'pending' ? "bg-linear-to-r from-amber-500 to-orange-600" :
          affiliateStatus === 'suspended' || affiliateStatus === 'rejected' ? "bg-linear-to-r from-rose-500 to-red-600" :
          "bg-linear-to-r from-emerald-500 to-teal-600"
        )}>
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
          <CardContent className="p-8 md:flex items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  "p-1.5 rounded-lg",
                  affiliateStatus === 'active' ? "bg-indigo-400/30" :
                  affiliateStatus === 'pending' ? "bg-amber-400/30" :
                  "bg-emerald-400/30"
                )}>
                  {affiliateStatus === 'active' ? <Rocket className="h-5 w-5 text-indigo-100 fill-current" /> :
                   affiliateStatus === 'pending' ? <Clock className="h-5 w-5 text-amber-100 fill-current" /> :
                   <Zap className="h-5 w-5 text-emerald-100 fill-current" />}
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-white/80">
                  {affiliateStatus === 'active' ? "Affiliate Partner" : 
                   affiliateStatus === 'pending' ? "Pendaftaran Diproses" : 
                   "Passive Income"}
                </span>
              </div>
              <h3 className="text-3xl font-black tracking-tight">
                {affiliateStatus === 'active' ? "Anda Adalah Partner Kami!" : 
                 affiliateStatus === 'pending' ? "Pendaftaran Sedang Ditinjau" : 
                 affiliateStatus === 'suspended' || affiliateStatus === 'rejected' ? "Pendaftaran Ditangguhkan" :
                 "Program Kemitraan Affiliasi"}
              </h3>
              <p className="text-white/90 max-w-xl text-lg leading-relaxed font-medium">
                {affiliateStatus === 'active' ? "Terima kasih telah menjadi bagian dari ekosistem RR-Net. Mari terus tumbuh bersama dan raih komisi maksimal setiap bulannya." :
                 affiliateStatus === 'pending' ? "Permintaan Anda sedang dalam antrian peninjauan oleh Super Admin. Kami akan memprosesnya dalam waktu maksimal 1x24 jam." :
                 affiliateStatus === 'suspended' || affiliateStatus === 'rejected' ? "Mohon maaf, saat ini pendaftaran Anda ditangguhkan. Silakan hubungi dukungan pelanggan untuk informasi lebih lanjut." :
                 "Rekomendasikan layanan kami ke partner RT/RW Net Anda dan dapatkan komisi recurring hingga 35% setiap bulannya."}
              </p>
            </div>
            <div className="mt-8 md:mt-0 shrink-0">
              {affiliateStatus === 'active' ? (
                <Button 
                  onClick={() => router.push('/affiliate/dashboard')}
                  className="bg-white text-indigo-700 hover:bg-slate-50 px-8 py-7 font-black rounded-2xl text-lg shadow-2xl hover:-translate-y-1 transition-all w-full md:w-auto"
                >
                  Buka Dashboard Affiliasi
                </Button>
              ) : affiliateStatus === 'pending' ? (
                <Button 
                  disabled
                  className="bg-white/20 text-white border border-white/30 px-8 py-7 font-black rounded-2xl text-lg w-full md:w-auto cursor-not-allowed"
                >
                  <Clock className="h-5 w-5 mr-2" /> Menunggu Approval
                </Button>
              ) : (
                <Button 
                  onClick={handleJoinAffiliate}
                  disabled={joiningAffiliate || affiliateStatus === 'suspended' || affiliateStatus === 'rejected'}
                  className="bg-white text-emerald-700 hover:bg-emerald-50 px-8 py-7 font-black rounded-2xl text-lg shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all w-full md:w-auto overflow-hidden group"
                >
                  {joiningAffiliate ? (
                    <span className="flex items-center gap-2"><LoadingSpinner className="h-5 w-5 border-emerald-700" /> Memproses...</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Rocket className="h-6 w-6 group-hover:animate-bounce" /> {affiliateStatus === 'suspended' || affiliateStatus === 'rejected' ? "Pendaftaran Ditutup" : "Bergabung Sekarang"}
                    </span>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Addons Section */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Expand Your Capabilities</h3>
            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 font-bold">Available Now</Badge>
          </div>
          
          {availableAddons.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
              <CardContent className="py-12 text-center text-slate-500">
                <Package className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <p className="font-medium">No additional capabilities available for your plan at this time.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {availableAddons.map((addon) => {
                const installedAddon = myAddons.find(ma => ma.addon_id === addon.id);
                const isInstalled = !!installedAddon;
                const quantity = installedAddon?.quantity || 0;
                
                // Helper to get icon based on code
                const getIcon = (code: string) => {
                  if (code.includes('ai') || code.includes('bot')) return <Bot className="h-5 w-5" />;
                  if (code.includes('wa') || code.includes('whatsapp')) return <MessageCircle className="h-5 w-5" />;
                  if (code.includes('domain') || code.includes('web')) return <Globe className="h-5 w-5" />;
                  return <Zap className="h-5 w-5" />;
                };

                return (
                  <Card key={addon.id} className={cn(
                    "group transition-all overflow-hidden border-slate-200 flex flex-col",
                    isInstalled ? "ring-2 ring-indigo-500 border-indigo-500" : "hover:border-indigo-300"
                  )}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className={cn(
                          "p-2 rounded-lg",
                          isInstalled ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-500"
                        )}>
                          {getIcon(addon.code)}
                        </div>
                        {isInstalled && (
                          <Badge className="bg-indigo-500 hover:bg-indigo-600">Active ({quantity}x)</Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg font-bold mt-4">{addon.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                        {addon.description || "Enhance your business operations with this premium add-on module."}
                      </p>
                    </CardContent>
                    <CardFooter className="pt-2 border-t border-slate-50 bg-slate-50/50 group-hover:bg-white transition-colors">
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Starting from</p>
                          <p className="font-black text-slate-900">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: addon.currency, minimumFractionDigits: 0 }).format(addon.price)}
                            <span className="text-[10px] font-normal text-slate-400">/{addon.billing_cycle === 'monthly' ? 'mo' : addon.billing_cycle}</span>
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {isInstalled && installedAddon?.cancelled_at ? (
                            <Button size="sm" variant="outline" disabled className="text-xs">
                              Renewal Cancelled
                            </Button>
                          ) : isInstalled ? (
                            <Button 
                              size="sm" 
                              variant="destructive"
                              disabled={loading}
                              onClick={() => {
                                if(window.confirm('Apakah Anda yakin ingin membatalkan perpanjangan addon ini?')) {
                                  handleCancelRenewal(addon.id);
                                }
                              }}
                              className="font-bold px-3 text-xs"
                            >
                              Cancel Renewal
                            </Button>
                          ) : null}
                          
                          <Button 
                            size="sm" 
                            variant={isInstalled ? "secondary" : "default"}
                            disabled={loading}
                            onClick={() => handleInstallAddon(addon)}
                            className={cn(
                              "font-bold px-4",
                              !isInstalled && "bg-indigo-600 hover:bg-indigo-700"
                            )}
                          >
                            {loading ? "..." : isInstalled ? "Buy More" : "Install"}
                          </Button>
                        </div>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Billing Instructions */}
          <Card className="lg:col-span-1 border-slate-200 border-t-4 border-t-amber-500 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-amber-500" />
                Payment Portal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-6 border border-slate-100 flex flex-col items-center text-center">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Official Payment Gateway</p>
                <div className="space-y-2 mb-6">
                  <p className="text-xl font-black text-indigo-900">1234 - 5678 - 90</p>
                  <p className="text-sm font-medium text-slate-600 italic">BCA - PT Solusi RT RW Net</p>
                </div>
                <Button 
                  className="w-full bg-slate-900 hover:bg-black font-bold"
                  onClick={() => {
                    const latestPending = invoices.find(inv => inv.status === 'pending' || inv.status === 'overdue');
                    if (latestPending) {
                      handlePayClick(latestPending);
                    }
                  }}
                  disabled={!invoices.some(inv => inv.status === 'pending' || inv.status === 'overdue')}
                >
                  Instant Payment (Xendit)
                </Button>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <AlertCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                  Payments are processed instantly. Please ensure you include your Tenant ID in the transfer remarks for faster verification.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Billing History */}
          <Card className="lg:col-span-2 border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-slate-600" />
                Billing Ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <History className="h-10 w-10 text-slate-200 mx-auto" />
                  <p className="font-medium">No activity yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">Reference</th>
                        <th className="px-6 py-4">Billing Period</th>
                        <th className="px-6 py-4 text-right">Amount</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-5 font-bold text-slate-900">
                            {inv.invoice_number}
                          </td>
                          <td className="px-6 py-5 text-slate-600 font-medium">
                            {format(new Date(inv.period_start), "MMMM yyyy")}
                          </td>
                          <td className="px-6 py-5 text-right">
                            {inv.discount_amount > 0 && (
                              <div className="flex flex-col mb-1 items-end">
                                <span className="text-[10px] text-slate-400 line-through">
                                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: inv.currency, minimumFractionDigits: 0 }).format(inv.subtotal)}
                                </span>
                                <span className="text-[10px] text-emerald-500 font-bold">
                                  -{new Intl.NumberFormat("id-ID", { style: "currency", currency: inv.currency, minimumFractionDigits: 0 }).format(inv.discount_amount)}
                                </span>
                              </div>
                            )}
                            <span className="font-black text-slate-900">
                              {new Intl.NumberFormat("id-ID", {
                                style: "currency",
                                currency: inv.currency,
                                minimumFractionDigits: 0,
                              }).format(inv.amount)}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <Badge className={`${getStatusColor(inv.status)} border-none shadow-none rounded-md px-2 py-0.5 text-[10px] font-bold`}>
                              {inv.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-6 py-5 text-right">
                            {inv.status !== "paid" ? (
                              <Button 
                                size="sm" 
                                className="h-8 bg-indigo-600 hover:bg-indigo-700 text-[11px] shadow-md px-4"
                                onClick={() => handlePayClick(inv)}
                              >
                                PAY NOW
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-8 text-[11px] text-slate-400">
                                DOWNLOAD PDF
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {isPaymentModalOpen && (
        <SubscriptionPaymentModal
          invoice={selectedInvoice || undefined}
          planData={selectedPlanForUpgrade || undefined}
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedInvoice(null);
            setSelectedPlanForUpgrade(null);
          }}
          onSuccess={() => {
            refreshInvoices();
            handlePlanChangeSuccess();
          }}
        />
      )}

      <ChangePlanModal
        isOpen={isChangePlanModalOpen}
        onClose={() => setIsChangePlanModalOpen(false)}
        currentPlanId={plan?.id}
        onSuccess={handlePlanChangeSuccess}
        onWaitPayment={(data: any) => {
          setIsChangePlanModalOpen(false);
          if (data.id && data.invoice_number) {
            // It's an existing invoice (Resume mode)
            setSelectedInvoice(data);
            setSelectedPlanForUpgrade(null);
          } else {
            // It's a plan selection (New Upgrade mode)
            setSelectedPlanForUpgrade({
              id: data.id,
              name: data.name,
              price: data.price_monthly,
              currency: data.currency
            });
            setSelectedInvoice(null);
          }
          setIsPaymentModalOpen(true);
        }}
      />

      {/* Addon Purchase Dialog */}
      {selectedAddonForPurchase && (
        <AddonPurchaseDialog
          addon={selectedAddonForPurchase}
          isOpen={true}
          onClose={() => setSelectedAddonForPurchase(null)}
          onConfirm={handleAddonPurchaseConfirm}
        />
      )}
    </PageLayout>
  );
}
