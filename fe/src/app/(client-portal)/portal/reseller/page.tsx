'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import resellerService from '@/lib/api/resellerService';
import { Reseller, ResellerPrice, ResellerPurchase, Voucher, ResellerDiscount } from '@/lib/api/types';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  ShoppingBag, 
  History,
  AlertTriangle,
  ArrowRight,
  Package,
  Plus,
  Ticket,
  Copy,
  Download,
  Search,
  ChevronRight,
  Settings,
  Tag,
  Eye,
  Percent,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { paymentMethodService, PaymentMethod } from '@/lib/api/paymentMethodService';

export default function PortalResellerPage() {
  const router = useRouter();
  const [reseller, setReseller] = useState<Reseller | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'shop' | 'history'>('dashboard');
  
  // Pricing & Shop State (Mirrored from Admin)
  const [pricingData, setPricingData] = useState<ResellerPrice[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<ResellerPrice | null>(null);
  const [voucherQty, setVoucherQty] = useState(1);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<ResellerPurchase | null>(null);
  const [availablePromos, setAvailablePromos] = useState<ResellerDiscount[]>([]);
  const [appliedPromoId, setAppliedPromoId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'transfer'>('balance');
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  
  // Generate Steps (Mirroring Admin Step Logic)
  const [purchaseStep, setPurchaseStep] = useState<'input' | 'processing' | 'success'>('input');
  const [generatedVouchers, setGeneratedVouchers] = useState<Voucher[]>([]);

  // History State
  const [purchaseHistory, setPurchaseHistory] = useState<ResellerPurchase[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<ResellerPurchase | null>(null);
  const [showPayLaterInfo, setShowPayLaterInfo] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);

  // History Pagination
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (reseller?.status === 'active') {
      if (activeTab === 'shop') {
        loadPricing();
        loadPromos();
        loadPaymentMethods();
      } else if (activeTab === 'history') {
        loadHistory();
        loadPaymentMethods();
      }
    }
  }, [activeTab, reseller?.status]);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const data = await resellerService.getMyResellerStatus();
      setReseller(data);
    } catch (err) {
      console.error("Failed to fetch status", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPricing = async () => {
    try {
      const data = await resellerService.getMyPrices();
      setPricingData(data);
    } catch (err) {
      console.error("Failed to load pricing", err);
      toast.error("Gagal memuat data harga");
    }
  };

  const loadPromos = async () => {
    try {
      const data = await resellerService.getPromos();
      setAvailablePromos(data);
    } catch (err) {
      console.error("Failed to load promos", err);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      setPaymentMethodsLoading(true);
      const data = await paymentMethodService.listPortal();
      const activeBanks = data.filter(pm => pm.is_active && pm.category !== 'cash');
      setAvailablePaymentMethods(activeBanks);
      if (activeBanks.length > 0) {
        setSelectedPaymentMethodId(activeBanks[0].id);
      }
    } catch (err) {
      console.error("Failed to load payment methods", err);
    } finally {
      setPaymentMethodsLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!reseller) return;
    try {
      setHistoryLoading(true);
      const data = await resellerService.getPurchaseHistory({ 
        reseller_id: reseller.id,
        page: 1,
        page_size: 100
      });
      setPurchaseHistory(data.data || []);
      setHistoryTotal(data.total || 0);
      setHistoryPage(1);
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleLoadMoreHistory = async () => {
    if (!reseller || isLoadingMoreHistory) return;
    try {
      setIsLoadingMoreHistory(true);
      const nextPage = historyPage + 1;
      const data = await resellerService.getPurchaseHistory({
        reseller_id: reseller.id,
        page: nextPage,
        page_size: 100
      });
      
      const newHistory = data.data || [];
      setPurchaseHistory(prev => [...prev, ...newHistory]);
      setHistoryPage(nextPage);
    } catch (err) {
      console.error("Failed to load more history", err);
    } finally {
      setIsLoadingMoreHistory(false);
    }
  };

  const handleRegister = async () => {
    try {
      setRegistering(true);
      const data = await resellerService.joinReseller();
      setReseller(data);
      toast.success("Pendaftaran berhasil diajukan!");
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error.response?.status === 409) {
          checkStatus();
      } else {
          toast.error("Gagal melakukan pendaftaran");
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleOpenPurchase = (sp: ResellerPrice) => {
    setSelectedPkg(sp);
    setVoucherQty(10); // Standard default
    setAppliedPromoId('');
    setPurchaseStep('input');
    setPurchaseSuccess(null);
  };

  const handleBuyVouchers = async () => {
    if (!selectedPkg) return;
    
    // Client-side balance check for 'Potong Saldo'
    if (paymentMethod === 'balance') {
      const currentBalance = reseller?.balance ?? 0;
      if (currentBalance < totalPrice) {
        setShowInsufficientBalance(true);
        return;
      }
    }
    
    try {
      setPurchaseStep('processing');
      setIsProcessingPurchase(true);
      const selectedPM = availablePaymentMethods.find(m => m.id === selectedPaymentMethodId);
      let finalPaymentMethod = paymentMethod === 'transfer' && selectedPM
        ? (selectedPM.category === 'pay later' ? `PayLater - ${selectedPM.name}` : (selectedPM.provider || selectedPM.name || 'Transfer'))
        : paymentMethod;

      const result = await resellerService.processMyPurchase({
        voucher_package_id: selectedPkg.voucher_package_id,
        quantity: voucherQty,
        payment_method: finalPaymentMethod, 
        promo_code: appliedPromoId ? availablePromos.find(p => p.id === appliedPromoId)?.code : undefined
      });
      
      setPurchaseSuccess(result);
      setGeneratedVouchers(result.vouchers || []);
      setPurchaseStep('success');
      checkStatus(); // Refresh revenue etc
      toast.success("Pembelian voucher berhasil!");
    } catch (err: unknown) {
      console.error("Purchase failed", err);
      setPurchaseStep('input');
      const error = err as { response?: { data?: { error?: string } } };
      const errorMessage = error.response?.data?.error || "Gagal memproses pembelian";
      
      if (errorMessage.includes("Saldo tidak mencukupi")) {
        setShowInsufficientBalance(true);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsProcessingPurchase(false);
    }
  };

  const handleSubmitPayment = async () => {
     if (!viewingPurchase) return;
     
     try {
        setIsSubmittingPayment(true);
        const updated = await resellerService.submitPayment(viewingPurchase.id);
        setViewingPurchase(updated);
        // Also update in list
        setPurchaseHistory(prev => prev.map(p => p.id === updated.id ? updated : p));
        toast.success("Konfirmasi pembayaran berhasil dikirim. Menunggu verifikasi admin.");
     } catch (err) {
        console.error("Failed to submit payment", err);
        toast.error("Gagal mengirim konfirmasi pembayaran");
     } finally {
        setIsSubmittingPayment(false);
     }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Teks disalin!");
  };

  // Helper calculation
  const calculateDiscount = () => {
    if (!selectedPkg || !appliedPromoId) return 0;
    const promo = availablePromos.find(d => d.id === appliedPromoId);
    if (!promo) return 0;

    const basePrice = selectedPkg.reseller_price * voucherQty;
    if (promo.discount_type === 'fixed') {
      return promo.discount_value;
    } else {
      return (basePrice * promo.discount_value) / 100;
    }
  };

  const discountAmount = calculateDiscount();
  const totalPrice = selectedPkg ? (selectedPkg.reseller_price * voucherQty) - discountAmount : 0;

  if (loading && !reseller) {
     return (
        <div className="flex h-96 items-center justify-center">
           <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
     );
  }

  // Case 1: Not Registered -> Landing Page
  if (!reseller) {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
           {/* Hero Section */}
           <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-10 text-white text-center shadow-xl shadow-indigo-200">
                <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Gabung Jadi Reseller Yuk! 🚀</h1>
                <p className="text-indigo-100 mb-8 max-w-lg mx-auto text-lg leading-relaxed">
                    Dapatkan penghasilan tambahan dengan menjual layanan internet kami ke tetangga dan kerabatmu.
                </p>
                <button 
                  onClick={handleRegister}
                  disabled={registering}
                  className="bg-white text-indigo-600 font-black px-8 py-4 rounded-2xl shadow-lg hover:bg-slate-50 transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2 mx-auto"
                >
                    {registering ? <Loader2 className="animate-spin" /> : 'Daftar Sekarang'}
                </button>
           </div>
    
           {/* Benefits Grid */}
           <div>
             <h2 className="text-xl font-bold text-slate-900 mb-6 px-2 text-center md:text-left">Keuntungan Reseller</h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <BenefitCard 
                   icon={<div className="text-emerald-600"><TrendingUp /></div>}
                   color="bg-emerald-100"
                   title="Komisi Menarik"
                   desc="Dapatkan komisi untuk setiap pelanggan baru yang Anda bawa."
                />
                <BenefitCard 
                   icon={<div className="text-blue-600"><ShoppingBag /></div>}
                   color="bg-blue-100"
                   title="Internet Gratis"
                   desc="Capai target tertentu dan nikmati layanan internet gratis!"
                />
                <BenefitCard 
                   icon={<div className="text-purple-600"><CheckCircle /></div>}
                   color="bg-purple-100"
                   title="Support Prioritas"
                   desc="Jalur khusus untuk bantuan teknis dan dukungan pemasaran."
                />
             </div>
           </div>
    
           {/* Info */}
           <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4 text-lg">Cara Kerja</h3>
                <ol className="md:grid md:grid-cols-4 gap-8 space-y-4 md:space-y-0 text-sm">
                    <Step number={1} text="Klik tombol daftar dan tunggu persetujuan." />
                    <Step number={2} text="Topup saldo atau beli voucher paket." />
                    <Step number={3} text="Jual voucher ke pelanggan Anda." />
                    <Step number={4} text="Pantau keuntungan di dashboard!" />
                </ol>
           </div>
        </div>
      );
  }

  // Case 2: Pending
  if (reseller.status === 'pending') {
      return (
        <div className="max-w-xl mx-auto py-20 text-center space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-amber-50">
                <Clock size={48} strokeWidth={2.5} />
            </div>
            <div>
                <h2 className="text-2xl font-black text-slate-900">Menunggu Persetujuan</h2>
                <p className="text-slate-500 font-medium mt-2 max-w-sm mx-auto">
                    Data pendaftaran Anda sedang kami review. Proses ini biasanya memakan waktu 1x24 jam.
                </p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-sm text-slate-600">
                Silakan cek kembali halaman ini secara berkala.
            </div>
            <button onClick={checkStatus} className="text-indigo-600 font-bold hover:underline flex items-center justify-center gap-2 mx-auto">
                <Loader2 size={16} /> Refresh Status
            </button>
        </div>
      );
  }

  // Case 3: Rejected
  if (reseller.status === 'rejected') {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-red-50">
              <XCircle size={48} strokeWidth={2.5} />
          </div>
          <div>
              <h2 className="text-2xl font-black text-slate-900">Mohon Maaf</h2>
              <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto">
                  Akun Anda untuk saat ini belum memenuhi syarat untuk menjadi Reseller. Mungkin dapat dicoba lagi lain hari.
              </p>
          </div>
          {reseller.notes && (
             <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm font-medium">
                Catatan: {reseller.notes}
             </div>
          )}
          <div className="flex gap-4 justify-center pt-4">
             <button onClick={handleRegister} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">
                Ajukan Ulang
             </button>
             <button onClick={() => window.location.href='/portal/dashboard'} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                Kembali ke Dashboard
             </button>
          </div>
      </div>
    );
  }

  // Case 4: Active (Dashboard)
  return (
      <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div>
                  <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    Hi, {reseller.client_name || 'Reseller'}! 
                    <span className="text-emerald-500 text-xs font-black uppercase tracking-widest px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-100">Active Reseller</span>
                  </h1>
                  <p className="text-slate-500 font-medium text-sm">Reseller Dashboard &bull; Bergabung sejak {new Date(reseller.join_date).toLocaleDateString('id-ID')}</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                 <div className="bg-indigo-50 px-5 py-3 rounded-2xl border border-indigo-100 min-w-[140px]">
                    <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest block mb-1">Your Balance</span>
                    <span className="text-xl font-black text-indigo-700">Rp {(reseller.balance || 0).toLocaleString('id-ID')}</span>
                 </div>
                 <div className="bg-emerald-50 px-5 py-3 rounded-2xl border border-emerald-100 min-w-[140px]">
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest block mb-1">Monthly Profit</span>
                    <span className="text-xl font-black text-emerald-700">Rp {(reseller.monthly_revenue || 0).toLocaleString('id-ID')}</span>
                 </div>
                 <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-200 min-w-[140px]">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Total Orders</span>
                    <span className="text-xl font-black text-slate-700">{reseller.total_purchases || 0}</span>
                 </div>
              </div>
          </div>

          {/* Navigation */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 overflow-x-auto scrollbar-hide">
              <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutGridIcon />} label="Overview" />
              <TabButton active={activeTab === 'shop'} onClick={() => setActiveTab('shop')} icon={<ShoppingBag size={18} />} label="Beli Voucher" />
              <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={18} />} label="Riwayat Pembelian" />
          </div>

          {/* Content Area */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              {activeTab === 'dashboard' && <DashboardOverview reseller={reseller} setTab={setActiveTab} />}
              {activeTab === 'shop' && (
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pricingData.length > 0 ? (
                      pricingData.map((sp) => (
                        <div 
                          key={sp.id} 
                          onClick={() => handleOpenPurchase(sp)}
                          className="p-6 bg-slate-50 border border-slate-200 rounded-2xl relative group hover:border-indigo-300 transition-all cursor-pointer hover:shadow-xl hover:shadow-indigo-50 hover:-translate-y-1"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                              <Package size={22} />
                            </div>
                            <h3 className="font-extrabold text-slate-900">{sp.voucher_package_name}</h3>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500 font-medium">Retail Price</span>
                              <span className="text-slate-800 font-bold">Rp {sp.retail_price.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm bg-white p-2.5 rounded-xl border border-slate-100">
                              <span className="text-indigo-600 font-bold">Reseller Price</span>
                              <span className="text-indigo-700 font-black">Rp {sp.reseller_price.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="pt-2 flex justify-between items-center border-t border-slate-200">
                              <span className="text-emerald-600 text-xs font-bold uppercase tracking-wider">Your Margin</span>
                              <span className="text-emerald-600 font-extrabold text-lg">Rp {sp.margin.toLocaleString('id-ID')}</span>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-indigo-600 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                            <ShoppingBag size={14} />
                            Click to Generate Vouchers
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
                         <ShoppingBag size={48} className="mx-auto text-slate-200 mb-4" />
                         <h3 className="text-lg font-bold text-slate-400">Belum ada paket tersedia</h3>
                         <p className="text-slate-400 text-sm">Hubungi admin untuk menambahkan paket voucher khusus Reseller.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'history' && (
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                   <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-extrabold text-slate-900 uppercase tracking-tight text-slate-900">Riwayat Pembelian</h3>
                      <button onClick={loadHistory} className="text-indigo-600 font-bold text-xs flex items-center gap-1">
                        <Loader2 size={14} className={historyLoading ? 'animate-spin' : ''} /> Refresh
                      </button>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                               <th className="px-6 py-4">Tanggal</th>
                               <th className="px-6 py-4">Paket</th>
                               <th className="px-6 py-4">QTY</th>
                               <th className="px-6 py-4">Total</th>
                               <th className="px-6 py-4">Status</th>
                               <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {purchaseHistory.length > 0 ? (
                               purchaseHistory.map((p) => (
                                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors text-sm">
                                     <td className="px-6 py-4 font-bold text-slate-600">
                                        {new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                     </td>
                                     <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                           <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                           <span className="font-black text-slate-700">{p.voucher_package_name}</span>
                                        </div>
                                     </td>
                                     <td className="px-6 py-4 font-bold text-slate-600">{p.quantity} pcs</td>
                                     <td className="px-6 py-4 font-black text-slate-900">Rp {p.total_amount.toLocaleString('id-ID')}</td>
                                     <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                           p.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                        }`}>
                                           {p.status}
                                        </span>
                                     </td>
                                     <td className="px-6 py-4 text-right">
                                        <button 
                                          onClick={() => fetchAndShowPurchase(p.id)}
                                          className="text-indigo-600 p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"
                                        >
                                           <Eye size={18} />
                                        </button>
                                     </td>
                                  </tr>
                               ))
                            ) : (
                               <tr>
                                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold italic">
                                     Belum ada riwayat pembelian.
                                  </td>
                               </tr>
                            )}
                         </tbody>
                      </table>
                   </div>

                    {purchaseHistory.length < historyTotal && (
                       <div className="p-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-4 bg-slate-50/30">
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                             Showing {purchaseHistory.length} of {historyTotal} Transactions
                          </div>
                          <button 
                             onClick={handleLoadMoreHistory}
                             disabled={isLoadingMoreHistory}
                             className="p-3 px-6 bg-white border border-slate-200 text-indigo-600 font-bold rounded-2xl text-xs hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                          >
                             {isLoadingMoreHistory ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />}
                             View More History
                          </button>
                       </div>
                    )}
                </div>
              )}
          </div>

          {/* Insufficient Balance Dialog */}
          {showInsufficientBalance && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
                <div className="p-6 bg-red-500 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Saldo Tidak Mencukupi</h3>
                    <p className="text-xs text-red-100 font-bold">Insufficient Balance</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-slate-600 font-medium text-sm">
                    Saldo reseller Anda tidak mencukupi untuk menyelesaikan pembelian ini.
                  </p>
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-bold">Saldo Anda</span>
                      <span className="font-black text-slate-900">Rp {(reseller?.balance ?? 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-bold">Total Pembelian</span>
                      <span className="font-black text-red-600">Rp {totalPrice.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-3 flex justify-between text-sm">
                      <span className="text-slate-500 font-bold">Kekurangan</span>
                      <span className="font-black text-red-600">Rp {Math.max(0, totalPrice - (reseller?.balance ?? 0)).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Gunakan metode <span className="font-bold">Transfer Bank</span> atau hubungi admin untuk top-up saldo.
                  </p>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowInsufficientBalance(false);
                        setPaymentMethod('transfer');
                      }}
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all"
                    >
                      Ganti ke Transfer
                    </button>
                    <button
                      onClick={() => setShowInsufficientBalance(false)}
                      className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generate Voucher Modal (Copied from Admin Logic) */}
          {selectedPkg && (
             <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    {/* Modal Header (Admin Style) */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                          <ShoppingBag size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-white">Generate Reseller Voucher</h3>
                          <p className="text-xs text-indigo-100 font-bold uppercase tracking-wider">{selectedPkg.voucher_package_name}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedPkg(null)} 
                        className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>

                    {/* Modal Content */}
                    <div className="p-8">
                       {purchaseStep === 'input' && (
                          <div className="space-y-6">
                             {/* Standard Info Row */}
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                   <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Account Info</label>
                                   <div className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-400">
                                      {reseller.client_name} (Reseller)
                                   </div>
                                </div>
                                <div className="space-y-1.5">
                                   <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Apply Promo Code</label>
                                   <div className="relative">
                                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                                      <select 
                                        value={appliedPromoId}
                                        onChange={(e) => setAppliedPromoId(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                      >
                                        <option value="">-- No Discount --</option>
                                        {availablePromos.filter(d => {
                                          if (d.status !== 'active') return false;
                                          if (d.expires_at) {
                                            const now = new Date();
                                            const expiry = new Date(d.expires_at);
                                            expiry.setHours(23, 59, 59, 999);
                                            return now <= expiry;
                                          }
                                          return true;
                                        }).map(d => (
                                          <option key={d.id} value={d.id}>{d.code} ({d.discount_type === 'fixed' ? `Rp ${d.discount_value.toLocaleString('id-ID')}` : `${d.discount_value}%`})</option>
                                        ))}
                                      </select>
                                   </div>
                                </div>
                             </div>

                             {/* Payment Method Selection */}
                             <div className="space-y-4">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block">Metode Pembayaran</label>
                                <div className="grid grid-cols-2 gap-3">
                                   <button 
                                     type="button"
                                     onClick={() => setPaymentMethod('balance')}
                                     className={`p-4 rounded-2xl border-2 transition-all text-left ${paymentMethod === 'balance' ? (reseller.balance >= totalPrice ? 'border-indigo-600 bg-indigo-50' : 'border-red-400 bg-red-50') : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                   >
                                      <div className="font-bold text-slate-900">Potong Saldo</div>
                                      <div className={`text-[10px] font-semibold whitespace-nowrap mt-0.5 ${reseller.balance >= totalPrice ? 'text-emerald-600' : 'text-red-500'}`}>Saldo: Rp {reseller.balance.toLocaleString("id-ID")}</div>
                                   </button>
                                   <button 
                                     type="button"
                                     onClick={() => setPaymentMethod('transfer')}
                                     className={`p-4 rounded-2xl border-2 transition-all text-left ${paymentMethod === 'transfer' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                   >
                                      <div className="font-bold text-slate-900">Transfer Bank</div>
                                      <div className="text-[10px] text-slate-500 font-medium whitespace-nowrap">Konfirmasi Manual</div>
                                    </button>
                                 </div>

                                 {/* Insufficient balance inline warning */}
                                 {paymentMethod === 'balance' && reseller.balance < totalPrice && (
                                   <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-xs text-red-600 font-bold animate-in fade-in duration-200 mt-2">
                                     <AlertTriangle size={14} className="flex-shrink-0" />
                                     <span>Saldo tidak mencukupi. Kurang Rp {(totalPrice - reseller.balance).toLocaleString('id-ID')}</span>
                                   </div>
                                 )}

                                {/* Bank Selector if Transfer */}
                                {paymentMethod === 'transfer' && availablePaymentMethods.length > 0 && (
                                   <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Rekening Tujuan</label>
                                      <select 
                                        value={selectedPaymentMethodId}
                                        onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                                        className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                      >
                                        {availablePaymentMethods.map(pm => (
                                          <option key={pm.id} value={pm.id}>
                                            {pm.provider || pm.name} - {pm.account_number} ({pm.account_name})
                                          </option>
                                        ))}
                                      </select>
                                   </div>
                                )}
                             </div>

                             {/* Quantity & Calculation Area (Copied Admin Style) */}
                             <div className="bg-slate-50 rounded-3xl p-6 border-2 border-dotted border-slate-200">
                                <div className="flex flex-col sm:flex-row items-center gap-6">
                                  <div className="flex-1 space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Amount to Generate</label>
                                    <div className="flex items-center gap-3">
                                      <button 
                                        onClick={() => setVoucherQty(Math.max(1, voucherQty - 10))}
                                        className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center font-black text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-95"
                                      > - </button>
                                      <input 
                                        type="number" 
                                        value={voucherQty}
                                        onChange={(e) => setVoucherQty(Number(e.target.value))}
                                        className="w-20 text-center bg-white border border-slate-200 py-3 rounded-xl font-black text-xl text-slate-900 focus:outline-none"
                                      />
                                      <button 
                                        onClick={() => setVoucherQty(voucherQty + 10)}
                                        className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center font-black text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-95"
                                      > + </button>
                                      <span className="font-bold text-slate-400">PCS</span>
                                    </div>
                                  </div>
                                  
                                  <div className="w-px h-16 bg-slate-200 hidden sm:block"></div>
  
                                  <div className="flex-1 text-right">
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1 text-slate-500">Total Payment</span>
                                    <span className="text-2xl font-black text-slate-900">Rp {totalPrice.toLocaleString('id-ID')}</span>
                                    {discountAmount > 0 && (
                                      <div className="text-[10px] text-red-500 font-bold mt-1 uppercase">
                                        Promo: {availablePromos.find(d => d.id === appliedPromoId)?.code} (-Rp {discountAmount.toLocaleString('id-ID')})
                                      </div>
                                    )}
                                    <div className="text-[10px] text-emerald-600 font-bold mt-1">
                                      Est. Potential Profit: Rp {(selectedPkg.margin * voucherQty).toLocaleString('id-ID')}
                                    </div>
                                  </div>
                                </div>
                             </div>

                             {/* Submit button */}
                             <button 
                               onClick={handleBuyVouchers}
                               disabled={isProcessingPurchase}
                               className="w-full bg-indigo-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3 uppercase tracking-tighter"
                             >
                               {isProcessingPurchase ? <Loader2 className="animate-spin" /> : <Plus size={24} />}
                               Confirm & Generate 
                             </button>
                          </div>
                       )}

                       {purchaseStep === 'processing' && (
                          <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="relative">
                              <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <ShoppingBag className="text-indigo-600 opacity-50" size={32} />
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xl font-black text-slate-900">Provisioning Vouchers</h4>
                              <p className="text-slate-500 text-sm font-medium mt-1">Sedang menghubungkan ke server...</p>
                            </div>
                          </div>
                       )}

                       {purchaseStep === 'success' && purchaseSuccess && (
                          <div className="py-10 text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 print:p-0">
                            {/* CSS for better printing */}
                            <style dangerouslySetInnerHTML={{ __html: `
                              @media print {
                                body * { visibility: hidden; }
                                .print-container, .print-container * { visibility: visible; }
                                .print-container { position: absolute; left: 0; top: 0; width: 100%; }
                                .no-print { display: none !important; }
                                .print-scroll { max-height: none !important; overflow: visible !important; }
                              }
                            `}} />

                            <div className="print-container">
                              {purchaseSuccess.status === 'success' ? (
                                <>
                                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto scale-110 shadow-lg shadow-emerald-50 no-print">
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                  </div>
                                  <div>
                                    <h4 className="text-2xl font-black text-slate-900">Generation Complete!</h4>
                                    <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-xs">{voucherQty} Vouchers created successfully</p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto scale-110 shadow-lg shadow-amber-50 no-print">
                                    <Clock size={32} strokeWidth={3} />
                                  </div>
                                  <div>
                                    <h4 className="text-2xl font-black text-slate-900">Pesanan Dibuat</h4>
                                    <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Silakan selesaikan pembayaran untuk aktivasi voucher</p>
                                  </div>

                                  <div className="bg-indigo-600 p-6 rounded-3xl text-left text-white shadow-xl shadow-indigo-100">
                                     <div className="text-xs font-black uppercase tracking-widest opacity-70 mb-2">Instruksi Pembayaran</div>
                                     <div className="space-y-3">
                                        <div className="flex justify-between items-center py-2 border-b border-indigo-400/30 font-bold">
                                           <span>{availablePaymentMethods.find(m => m.id === selectedPaymentMethodId)?.provider || availablePaymentMethods.find(m => m.id === selectedPaymentMethodId)?.name}</span>
                                           <span>{availablePaymentMethods.find(m => m.id === selectedPaymentMethodId)?.account_number}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-indigo-400/30">
                                           <span>Atas Nama</span>
                                           <span className="font-black">{availablePaymentMethods.find(m => m.id === selectedPaymentMethodId)?.account_name}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2">
                                           <span className="text-sm">Total Transfer</span>
                                           <span className="text-xl font-black">Rp {totalPrice.toLocaleString('id-ID')}</span>
                                        </div>
                                     </div>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-bold uppercase py-2">
                                     Voucher akan otomatis muncul di riwayat setelah dikonfirmasi admin
                                  </div>
                                </>
                              )}
                              
                              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-3 text-left mt-4">
                                <div className="flex justify-between text-xs font-bold text-slate-400">
                                  <span>Transaction ID</span>
                                  <span className="text-slate-900">#{purchaseSuccess.id.split('-')[0].toUpperCase()}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-slate-400">
                                  <span>Package</span>
                                  <span className="text-slate-900 font-black">{selectedPkg.voucher_package_name}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-slate-400">
                                  <span>Total Paid</span>
                                  <span className="text-slate-900 font-black text-base">Rp {totalPrice.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-slate-400">
                                  <span>Status</span>
                                  <span className={`px-2 py-0.5 rounded-lg text-[10px] uppercase ${purchaseSuccess.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {purchaseSuccess.status}
                                  </span>
                                </div>
                              </div>
  
                              {purchaseSuccess.status === 'success' && generatedVouchers.length > 0 && (
                                <div className="mt-4 max-h-40 overflow-y-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2 print-scroll">
                                   <div className="grid grid-cols-2 gap-2">
                                     {generatedVouchers.map((v, i) => (
                                       <div key={v.id || i} className="flex justify-between items-center text-sm font-bold p-2 bg-white rounded-xl border border-slate-100">
                                         <span className="text-slate-400 font-medium no-print">#{i+1}</span>
                                         <code className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg font-mono">{v.code}</code>
                                         <span className="text-slate-900 font-mono">{v.password}</span>
                                         <button onClick={() => copyToClipboard(v.code)} className="text-slate-300 hover:text-indigo-600 no-print"><Copy size={14}/></button>
                                       </div>
                                     ))}
                                   </div>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-4 no-print">
                              <button 
                                onClick={() => setSelectedPkg(null)}
                                className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all text-slate-600"
                              >
                                Close
                              </button>
                              <button 
                                onClick={() => window.print()}
                                className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                              >
                                <Download size={20} />
                                Print Vouchers
                              </button>
                            </div>
                          </div>
                       )}
                    </div>
                </div>
             </div>
          )}

          {/* Viewing Detail Modal (Purchase History) */}
          {viewingPurchase && (
             <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                   <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight text-slate-900">Detail Pembelian</h3>
                        <p className="text-slate-500 font-medium text-xs uppercase tracking-widest mt-1">Transaction ID: {viewingPurchase.id}</p>
                      </div>
                      <button onClick={() => setViewingPurchase(null)} className="p-2 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 text-slate-400">
                         <Plus size={24} className="rotate-45" />
                      </button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                         <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Paket Voucher</span>
                            <span className="font-extrabold text-slate-900">{viewingPurchase.voucher_package_name}</span>
                         </div>
                         <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Status Transaksi</span>                              <span className={`font-extrabold uppercase tracking-tight ${
                                viewingPurchase.status === 'success' ? 'text-emerald-600' : 
                                viewingPurchase.status === 'paylater' ? 'text-indigo-600' : 
                                viewingPurchase.status === 'verifying' ? 'text-blue-600' :
                                'text-amber-600'
                             }`}>{viewingPurchase.status}</span>
                         </div>
                         <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Total Pembayaran</span>
                            <span className="font-extrabold text-slate-900">Rp {viewingPurchase.total_amount.toLocaleString('id-ID')}</span>
                         </div>
                         <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Metode Bayar</span>
                             <span className="font-extrabold text-slate-900 uppercase">{viewingPurchase.payment_method === 'balance' ? 'Potong Saldo' : viewingPurchase.payment_method}</span>
                         </div>
                      </div>                       {/* Payment Information Section */}
                       {(viewingPurchase.status === 'pending' || (viewingPurchase.status === 'paylater' && showPayLaterInfo)) && (
                          <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 mb-6 animate-in slide-in-from-top-2 duration-300">
                             <div className="flex items-center gap-2 text-amber-600 mb-4">
                                <Clock size={20} />
                                <h4 className="font-black">Menunggu Pembayaran</h4>
                             </div>
                             
                             <div className="space-y-4">
                               <p className="text-sm font-medium text-amber-800">
                                  {viewingPurchase.status === 'paylater' 
                                    ? 'Selesaikan pembayaran ke salah satu rekening berikut agar hutang pembayaran segera terlunasi.'
                                    : 'Selesaikan pembayaran ke salah satu rekening berikut agar sistem dapat men-generate voucher pesanan Anda.'}
                               </p>
                               {availablePaymentMethods.filter(pm => pm.category !== 'pay later').length > 0 ? (
                                  <div className="space-y-3">
                                     {availablePaymentMethods.filter(pm => pm.category !== 'pay later').map(pm => (
                                        <div key={pm.id} className="bg-white p-4 rounded-xl border border-amber-100 flex justify-between items-center">
                                           <div>
                                              <div className="font-black text-slate-900">{pm.provider || pm.name}</div>
                                              <div className="text-sm font-bold text-slate-600 mt-0.5">{pm.account_number}</div>
                                              <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">A.N. {pm.account_name}</div>
                                           </div>
                                           <button 
                                              onClick={() => copyToClipboard(pm.account_number || '')}
                                              className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition-colors font-bold text-xs flex gap-1 items-center"
                                           >
                                              <Copy size={14} /> Salin
                                           </button>
                                        </div>
                                     ))}
                              </div>
                               ) : (
                                  <div className="text-sm font-bold text-slate-500 text-center p-4">
                                     Data rekening tidak tersedia. Hubungi admin.
                                  </div>
                                )}
                               <div className="pt-4 flex justify-between items-center border-t border-amber-200">
                                  <span className="text-xs font-black uppercase tracking-widest text-amber-600">Total Tagihan</span>
                                  <span className="font-black text-xl text-amber-700">Rp {viewingPurchase.total_amount.toLocaleString('id-ID')}</span>
                               </div>
                                {(viewingPurchase.status === 'paylater') && (
                                   <div className="pt-4 border-t border-amber-200">
                                      <button 
                                         onClick={handleSubmitPayment}
                                         disabled={isSubmittingPayment}
                                         className="w-full bg-amber-600 text-white font-black py-3 rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                      >
                                         {isSubmittingPayment ? (
                                            <Loader2 className="animate-spin" size={18} />
                                        ) : (
                                            <CheckCircle size={18} />
                                        )}
                                         Konfirmasi Saya Sudah Bayar
                                      </button>
                                   </div>
                                )}
                             </div>
                          </div>
                        )}

                        {viewingPurchase.status === 'verifying' && (
                           <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200 mb-6 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                              <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                                 <Clock className="animate-pulse" size={24} />
                              </div>
                              <div>
                                 <h4 className="font-black text-blue-900">Pembayaran Sedang Diverifikasi</h4>
                                 <p className="text-sm font-bold text-blue-700 mt-0.5">
                                    Admin akan memproses transaksi ini segera setelah data pembayaran divalidasi.
                                 </p>
                              </div>
                           </div>
                        )}

                        {/* PayLater Instructions Toggle */}
                        {viewingPurchase.status === 'paylater' && viewingPurchase.payment_method.toLowerCase().includes('paylater') && (
                           <button 
                             onClick={() => setShowPayLaterInfo(!showPayLaterInfo)}
                             className="w-full py-3 mb-6 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-2xl hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                           >
                             {showPayLaterInfo ? 'Sembunyikan Informasi Bayar' : 'Lihat Rekening Pembayaran'}
                             <ChevronRight size={16} className={`transition-transform ${showPayLaterInfo ? 'rotate-90' : ''}`} />
                           </button>
                        )}

                        {/* Vouchers Section */}
                        {(viewingPurchase.status === 'success' || viewingPurchase.status === 'paylater') ? (
                           <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                 <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2">
                                   <Ticket size={16} className="text-indigo-600" />
                                   Daftar Voucher Generated
                                 </h4>
                                 {viewingPurchase.vouchers && viewingPurchase.vouchers.length > 0 && (
                                    <button 
                                       onClick={() => router.push(`/portal/reseller/print?purchase_id=${viewingPurchase.id}`)}
                                       className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all"
                                     >
                                       <Download size={14} /> Cetak Voucher
                                     </button>
                                 )}
                              </div>
                              {viewingPurchase.vouchers && viewingPurchase.vouchers.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                   {viewingPurchase.vouchers.map((v, i) => (
                                       <div key={v.id || i} className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between group hover:border-indigo-200 transition-all">
                                          <div className="flex flex-col">
                                             <span className="font-mono font-black text-slate-900 text-base">{v.code}</span>
                                             <span className="text-[10px] font-bold text-slate-400">PW: {v.password}</span>
                                          </div>
                                          <button 
                                            onClick={() => copyToClipboard(v.code)}
                                            className="text-slate-300 hover:text-indigo-600 transition-colors"
                                          >
                                            <Copy size={16} />
                                          </button>
                                       </div>
                                   ))}
                                </div>
                              ) : (
                                 <div className="text-sm font-bold text-slate-400 p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-center">
                                    Voucher belum di-generate.
                                 </div>
                              )}
                           </div>
                        ) : (
                           viewingPurchase.status === 'pending' && !viewingPurchase.payment_method.toLowerCase().includes('paylater') && (
                              <div className="text-sm font-bold text-slate-400 p-8 border-2 border-dashed border-slate-100 rounded-3xl text-center">
                                 Voucher akan tersedia setelah pembayaran dikonfirmasi admin.
                              </div>
                            )
                         )}
                    </div>

                   <div className="p-8 border-t border-slate-50 bg-white flex flex-col sm:flex-row gap-3">
                      <button 
                        onClick={() => setViewingPurchase(null)}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                      >
                         Tutup Detail
                      </button>
                      {viewingPurchase.status === 'pending' && (
                        <button 
                          onClick={() => setShowCancelConfirm(true)}
                          className="flex-1 py-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-black hover:bg-red-100 transition-all flex justify-center items-center gap-2"
                        >
                           <XCircle size={20} /> Batalkan Pesanan
                        </button>
                      )}
                   </div>
                </div>



                 {/* Cancel Confirmation Modal / Overlay */}
                {showCancelConfirm && (
                   <div className="absolute inset-0 z-[210] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm rounded-[32px] animate-in fade-in duration-200">
                      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center animate-in zoom-in duration-300">
                         <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <AlertTriangle size={36} strokeWidth={2.5} />
                         </div>
                         <h3 className="text-xl font-black text-slate-900 mb-2">Batalkan Pesanan?</h3>
                         <p className="text-slate-500 text-sm font-medium mb-8">
                            Tindakan ini tidak dapat diurungkan. Pesanan Anda akan dihapus permanen.
                         </p>
                         <div className="flex gap-3">
                            <button 
                              onClick={() => setShowCancelConfirm(false)}
                              disabled={isCancelling}
                              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors disabled:opacity-50"
                            >
                              Kembali
                            </button>
                            <button 
                              onClick={() => handleCancelPurchase(viewingPurchase.id)}
                              disabled={isCancelling}
                              className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {isCancelling ? <Loader2 size={18} className="animate-spin" /> : 'Ya, Batalkan'}
                            </button>
                         </div>
                      </div>
                   </div>
                )}
             </div>
          )}
      </div>
  );

  async function handleCancelPurchase(id: string) {
    setIsCancelling(true);
    try {
      await resellerService.deletePurchase(id);
      setShowCancelConfirm(false);
      setViewingPurchase(null);
      toast.success("Pesanan berhasil dibatalkan");
      loadHistory(); // Refresh the list
    } catch (err) {
      toast.error("Gagal membatalkan pesanan. Silakan coba lagi.");
    } finally {
      setIsCancelling(false);
    }
  }

  async function fetchAndShowPurchase(id: string) {
    try {
      const details = await resellerService.getPurchase(id);
      setViewingPurchase(details);
    } catch (err) {
      toast.error("Gagal memuat detail pembelian");
    }
  }
}

// Sub-components
interface BenefitCardProps {
  icon: React.ReactNode;
  color: string;
  title: string;
  desc: string;
}

function BenefitCard({ icon, color, title, desc }: BenefitCardProps) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
            <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-4`}>
                {icon}
            </div>
            <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
            <p className="text-sm text-slate-500">{desc}</p>
        </div>
    );
}

function Step({ number, text }: { number: number, text: string }) {
    return (
        <div className="flex flex-col gap-2 text-slate-900">
            <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg shadow-indigo-200">
                {number}
            </span>
            <p className="font-medium text-slate-700">{text}</p>
        </div>
    );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
    return (
        <button 
            onClick={onClick}
            className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                active ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
        >
            {icon}
            {label}
        </button>
    );
}

// Icons
const LayoutGridIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
);

function DashboardOverview({ reseller, setTab }: { reseller: Reseller, setTab: (t: 'dashboard' | 'shop' | 'history') => void }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-slate-900">
             <div className="bg-white p-6 rounded-3xl border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                   <TrendingUp className="text-indigo-500" size={18} />
                   Ringkasan Akun
                </h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-slate-50">
                        <span className="text-slate-500 text-sm font-medium">ID Reseller</span>
                        <span className="font-black text-slate-900 text-xs font-mono">{reseller.id.split('-')[0]}...</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-slate-50">
                        <span className="text-slate-500 text-sm font-medium">Status Akun</span>
                        <span className="font-black text-emerald-600 text-xs uppercase tracking-widest">Active</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-slate-50">
                        <span className="text-slate-500 text-sm font-medium">Total Transaksi</span>
                        <span className="font-black text-slate-900">{reseller.total_purchases || 0}</span>
                    </div>
                     <div className="flex justify-between items-center py-3">
                        <span className="text-slate-500 text-sm font-medium">Estimasi Revenue</span>
                        <span className="font-black text-emerald-600">Rp {(reseller.monthly_revenue || 0).toLocaleString('id-ID')}</span>
                    </div>
                </div>
             </div>
             
             <button 
               onClick={() => setTab('shop')}
               className="bg-indigo-600 p-8 rounded-3xl text-left text-white shadow-xl shadow-indigo-100 hover:scale-[1.02] transition-all relative overflow-hidden group"
             >
                <div className="relative z-10 h-full flex flex-col justify-between">
                   <div>
                      <ShoppingBag size={40} className="mb-4 text-indigo-200" />
                      <h3 className="text-2xl font-black mb-2 text-white">Mulai Berjualan Voucher! 💰</h3>
                      <p className="text-indigo-100 font-medium">Beli paket voucher dengan harga reseller dan tingkatkan keuntunganmu.</p>
                   </div>
                   <div className="mt-8 flex items-center gap-2 font-black uppercase tracking-widest text-xs text-white">
                      Buka Toko Voucher <ArrowRight size={16} />
                   </div>
                </div>
                {/* Decorative blob */}
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
             </button>
        </div>
    );
}

