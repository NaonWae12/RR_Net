'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { 
  Users, 
  ShoppingBag, 
  Settings, 
  Plus, 
  Search,
  ArrowRight,
  TrendingUp,
  Package,
  History,
  Tag,
  Ticket,
  Percent,
  Calendar,
  Sparkles,
  Layers,
  Phone,
  Trash2,
  AlertTriangle,
  Eye,
  Columns,
  TableProperties,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Printer,
  Clock 
} from 'lucide-react';
import { LimitWarningBanner } from '@/components/dashboard/LimitWarningBanner';

import resellerService from '@/lib/api/resellerService';
import clientService from '@/lib/api/clientService';
import { voucherService } from '@/lib/api/voucherService';
import { networkService } from '@/lib/api/networkService';
import { paymentMethodService, PaymentMethod } from '@/lib/api/paymentMethodService';
import portalService from '@/lib/api/portalService';
import { 
  Reseller, 
  ResellerPurchase, 
  ResellerDiscount, 
  Client, 
  ResellerPrice,
  Router,
  Voucher
} from '@/lib/api/types';
import { discountService, Discount } from '@/lib/api/discountService';

// Constants - Fallback if no routers found
const DEFAULT_ROUTERS = ['RB4011-Main', 'CCR-Core', 'Tower-A']; 

export default function ResellerPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'list' | 'purchases' | 'pricing' | 'discounts' | 'generate'>('list');
  const [search, setSearch] = useState('');

  // Main Data States
  const [resellersList, setResellersList] = useState<Reseller[]>([]);
  const [purchasesList, setPurchasesList] = useState<ResellerPurchase[]>([]);
  const [routersList, setRoutersList] = useState<Router[]>([]);
  const [loading, setLoading] = useState(false);

  // Column Filter States
  type PurchaseColumnKey = 'date' | 'reseller' | 'package' | 'qty' | 'discount' | 'payment' | 'total' | 'status' | 'actions';
  const PURCHASES_COLUMNS_STORAGE_KEY = 'reseller_purchases_table_columns_v1';

  const [visibleColumnsPurchases, setVisibleColumnsPurchases] = useState<Record<PurchaseColumnKey, boolean>>({
    date: true,
    reseller: true,
    package: true,
    qty: true,
    discount: true,
    payment: true,
    total: true,
    status: true,
    actions: true,
  });

  const [viewingPurchase, setViewingPurchase] = useState<ResellerPurchase | null>(null);
  const [isDeletingPurchase, setIsDeletingPurchase] = useState(false);
  const [isConfirmingDeletePurchase, setIsConfirmingDeletePurchase] = useState(false);

  // Load preferences
  useEffect(() => {
    const raw = localStorage.getItem(PURCHASES_COLUMNS_STORAGE_KEY);
    if (raw) {
      try {
        setVisibleColumnsPurchases(JSON.parse(raw));
      } catch (e) {}
    }
  }, []);

  const setPurchaseColumn = (key: PurchaseColumnKey, val: boolean) => {
    setVisibleColumnsPurchases(prev => {
      const next = { ...prev, [key]: val };
      localStorage.setItem(PURCHASES_COLUMNS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // State for Price Settings
  const [pricingData, setPricingData] = useState<any[]>([]); 
  const [editingPrice, setEditingPrice] = useState<any | null>(null);
  const [tempResellerPrice, setTempResellerPrice] = useState<number>(0);
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [profileSearch, setProfileSearch] = useState('');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [newResellerPrice, setNewResellerPrice] = useState<number>(0);
  const [voucherProfiles, setVoucherProfiles] = useState<any[]>([]);

  // State for Add Reseller Modal
  const [isAddingReseller, setIsAddingReseller] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [clientSearchResults, setClientSearchResults] = useState<Client[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('All Status');

  // State for Generate Voucher Modal
  const [isGeneratingVoucher, setIsGeneratingVoucher] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<any | null>(null);
  const [voucherQty, setVoucherQty] = useState(10);
  const [selectedResellerId, setSelectedResellerId] = useState('');
  const [selectedRouterId, setSelectedRouterId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [appliedPromoId, setAppliedPromoId] = useState('');
  const [step, setStep] = useState<'input' | 'processing' | 'success'>('input');
  const [currentGeneratedPurchase, setCurrentGeneratedPurchase] = useState<ResellerPurchase | null>(null);
  const [generatedVouchers, setGeneratedVouchers] = useState<any[]>([]);

  // State for Discounts Tab
  const [generatedDiscounts, setGeneratedDiscounts] = useState<ResellerDiscount[]>([]);
  const [isCreatingDiscount, setIsCreatingDiscount] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [newPromoCode, setNewPromoCode] = useState('');
  const [discountRules, setDiscountRules] = useState<Discount[]>([]);
  const [promoToDelete, setPromoToDelete] = useState<ResellerDiscount | null>(null);



  // State for Reseller Detail View
  const [viewingReseller, setViewingReseller] = useState<Reseller | null>(null);

  // Status Action States
  const [resellerToApprove, setResellerToApprove] = useState<Reseller | null>(null);
  const [resellerToReject, setResellerToReject] = useState<Reseller | null>(null);
  const [resellerToSuspend, setResellerToSuspend] = useState<Reseller | null>(null);
  const [resellerToActivate, setResellerToActivate] = useState<Reseller | null>(null);
  const [resellerToDelete, setResellerToDelete] = useState<Reseller | null>(null);
  const [activeVoucherCount, setActiveVoucherCount] = useState<number>(0);
  const [isCheckingVouchers, setIsCheckingVouchers] = useState(false);
  const [isDeletingReseller, setIsDeletingReseller] = useState(false);
  const [isProcessingStatus, setIsProcessingStatus] = useState(false);
  const [purchaseToConfirm, setPurchaseToConfirm] = useState<ResellerPurchase | null>(null);
  const [isProcessingConfirm, setIsProcessingConfirm] = useState(false);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');
  const [isMidtransEnabled, setIsMidtransEnabled] = useState(false);
  const [isProcessingSnap, setIsProcessingSnap] = useState(false);
  const [midtransScriptUrl, setMidtransScriptUrl] = useState('');
  const [midtransClientKey, setMidtransClientKey] = useState('');
  const [isSnapReady, setIsSnapReady] = useState(false);

  // Pagination States for Purchase History
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [isLoadingMorePurchases, setIsLoadingMorePurchases] = useState(false);

  // --- Data Fetching ---

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Resellers
      const resellersData = await resellerService.getResellers({ search: search });
      setResellersList(resellersData.data || []);

      // Fetch Purchases (Initial Load, 100 rows)
      const purchasesData = await resellerService.getPurchaseHistory({ page: 1, page_size: 100 });
      setPurchasesList(purchasesData.data || []);
      setPurchaseTotal(purchasesData.total || 0);
      setPurchasePage(1);

      // Fetch Promos
      const promosData = await resellerService.getPromos();
      setGeneratedDiscounts(Array.isArray(promosData) ? promosData : []);

      // Fetch Base Discount Rules from Service Setup
      try {
        const rules = await discountService.getDiscounts(false, true); // only valid
        setDiscountRules(rules);
      } catch (e) {
        console.warn("Failed to fetch discount rules", e);
      }

      // Fetch Voucher Profiles
      const profiles = await voucherService.listPackages();
      setVoucherProfiles(profiles);
      
      // Fetch Routers
      try {
        const routers = await networkService.getRouters();
        setRoutersList(routers);
        if (routers.length > 0) setSelectedRouterId(routers[0].id);
      } catch (e) {
        console.warn("Failed to fetch routers", e);
      }

      // Fetch Global Reseller Prices from BE (Service now returns all packages with fallback prices)
      try {
        const globalPrices = await resellerService.getGlobalPrices();
        setPricingData(globalPrices.map(gp => ({
          id: gp.id || gp.voucher_package_id,
          package_id: gp.voucher_package_id,
          name: gp.voucher_package_name || 'Voucher',
          retail_price: gp.retail_price,
          reseller_price: gp.reseller_price,
          margin: gp.margin
        })));
      } catch (e) {
        console.warn("Failed to fetch global prices", e);
      }

      // Fetch Payment Methods
      try {
        const pmData = await paymentMethodService.list();
        setAvailablePaymentMethods(pmData.filter(pm => pm.is_active));
        if (pmData.length > 0) setSelectedPaymentMethodId(pmData[0].id);
      } catch (e) {
        console.warn("Failed to fetch payment methods", e);
      }

    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkMidtrans = async () => {
      try {
        const config = await portalService.getMidtransConfig();
        console.log('[Midtrans] Config response:', config);
        if (config && config.enabled) {
          setIsMidtransEnabled(true);
          setMidtransClientKey(config.client_key);
          setMidtransScriptUrl(
            config.is_production 
              ? 'https://app.midtrans.com/snap/snap.js' 
              : 'https://app.sandbox.midtrans.com/snap/snap.js'
          );
        }
      } catch (e) {
        console.error('[Midtrans] Failed to check config', e);
      }
    };
    checkMidtrans();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab]); 

  const handleLoadMorePurchases = async () => {
    try {
      setIsLoadingMorePurchases(true);
      const nextPage = purchasePage + 1;
      const data = await resellerService.getPurchaseHistory({ page: nextPage, page_size: 100 });
      const newItems = data.data || [];
      setPurchasesList(prev => [...prev, ...newItems]);
      setPurchasePage(nextPage);
    } catch(err) {
      console.error("Failed to load more purchases", err);
    } finally {
      setIsLoadingMorePurchases(false);
    }
  };

  // Client Search Effect
  useEffect(() => {
    const searchClients = async () => {
      if (clientSearch.trim().length > 1) {
        try {
          const res = await clientService.getClients({ search: clientSearch, page_size: 5 });
          setClientSearchResults(res.data);
        } catch (err) {
          console.error(err);
        }
      } else {
        setClientSearchResults([]);
      }
    };
    
    const timeout = setTimeout(searchClients, 300);
    return () => clearTimeout(timeout);
  }, [clientSearch]);

  const formatIDR = (val: number) => {
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseIDR = (str: string) => {
    return Number(str.replace(/\./g, "").replace(/[^0-9]/g, ""));
  };

  const handleEditPrice = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    setEditingPrice(item);
    setTempResellerPrice(item.reseller_price);
  };

  const handleOpenGenerate = (item: any) => {
    setSelectedPkg(item);
    setStep('input');
    setIsGeneratingVoucher(true);
    setAppliedPromoId(''); // Reset promo
  };

  const handleAddReseller = async () => {
    const client = clientSearchResults.find(c => c.id === selectedClientId);
    if (!client) return;

    try {
      const newReseller = await resellerService.upgradeClient({ client_id: client.id });
      setResellersList([newReseller, ...resellersList]);
      setIsAddingReseller(false);
      setSelectedClientId('');
      setClientSearch('');
    } catch (error) {
      console.error("Failed to add reseller", error);
      alert("Failed to add reseller. They might already be registered.");
    }
  };

  // No need for local filtering as we fetch from API
  const filteredClients = clientSearchResults;

  const handleAddPackage = async () => {
    const profile = voucherProfiles.find(vp => vp.id === selectedProfileId);
    if (!profile) return;

    try {
      await resellerService.setGlobalPrice({
        voucher_package_id: profile.id,
        reseller_price: newResellerPrice,
        retail_price: (profile as any).price || profile.default_price || 0
      });
      
      await fetchData(); // Refresh data
      setIsAddingPackage(false);
      setSelectedProfileId('');
      setNewResellerPrice(0);
    } catch (error) {
      console.error("Failed to add global price", error);
      alert("Failed to save price setting.");
    }
  };

  const calculateDiscount = () => {
    if (!selectedPkg || !appliedPromoId) return 0;
    const promo = generatedDiscounts.find(d => d.id === appliedPromoId);
    if (!promo) return 0;

    const basePrice = selectedPkg.reseller_price * voucherQty;
    if (promo.discount_type === 'fixed') {
      return promo.discount_value;
    } else {
      return (basePrice * promo.discount_value) / 100;
    }
  };

  const handleProcessGenerate = async () => {
    if (!selectedResellerId) {
      alert('Please select a reseller first!');
      return;
    }
    setStep('processing');
    
    try {
      const promoCode = appliedPromoId ? generatedDiscounts.find(d => d.id === appliedPromoId)?.code : undefined;
      
      let finalPaymentMethod = paymentMethod;
      if (paymentMethod !== 'balance' && paymentMethod !== 'midtrans' && selectedPaymentMethodId) {
        const pm = availablePaymentMethods.find(m => m.id === selectedPaymentMethodId);
        if (pm) {
          finalPaymentMethod = pm.category === 'pay later' ? `PayLater - ${pm.name}` : (pm.name || pm.provider || paymentMethod);
        }
      }

      // Call API
      const purchase = await resellerService.processPurchase(selectedResellerId, {
        voucher_package_id: selectedPkg.package_id || selectedPkg.id, 
        quantity: voucherQty,
        payment_method: finalPaymentMethod, 
        promo_code: promoCode,
        router_id: selectedRouterId || undefined
      });
      
      if ((purchase as any).vouchers) {
        setGeneratedVouchers((purchase as any).vouchers);
      }
      
      setCurrentGeneratedPurchase(purchase);
      
      // If payment method is Midtrans, trigger Snap immediately
      if (paymentMethod === 'midtrans') {
        const token = purchase.snap_token;
        console.log('[Midtrans] Purchase created, snap_token:', token, 'isSnapReady:', isSnapReady, 'window.snap:', !!(window as any).snap);
        
        if (token) {
          // Close generator modal so Snap popup is clearly visible
          setStep('input');
          setIsGeneratingVoucher(false);
          
          // Small delay to let React re-render (close modal) before opening Snap
          setTimeout(() => {
            if ((window as any).snap) {
              console.log('[Midtrans] Calling snap.pay() with token:', token);
              (window as any).snap.pay(token, {
                onSuccess: (result: any) => {
                  console.log('[Midtrans] Payment success', result);
                  fetchData();
                },
                onPending: (result: any) => {
                  console.log('[Midtrans] Payment pending', result);
                  fetchData();
                  setViewingPurchase(purchase);
                },
                onError: (err: any) => {
                  console.error('[Midtrans] Payment error', err);
                  setViewingPurchase(purchase);
                },
                onClose: () => {
                  console.log('[Midtrans] Snap popup closed');
                  fetchData();
                  setViewingPurchase(purchase);
                }
              });
            } else {
              // Fallback: open redirect URL in new tab
              console.error('[Midtrans] window.snap not available, using redirect fallback');
              const redirectUrl = `https://app.sandbox.midtrans.com/snap/v4/redirection/${token}`;
              window.open(redirectUrl, '_blank');
              fetchData();
              setViewingPurchase(purchase);
            }
          }, 300);
        } else {
          console.warn('[Midtrans] No snap_token in server response');
          setStep('success');
        }
      } else {
        setStep('success');
      }
      
      // Update list
      setPurchasesList([purchase, ...purchasesList]);
    } catch (error) {
      console.error("Purchase failed", error);
      alert("Failed to process purchase. Please check logs.");
      setStep('input');
    }
  };

  const handleDeletePurchase = async () => {
    if (!viewingPurchase) return;
    
    setIsDeletingPurchase(true);
    try {
      await resellerService.deletePurchase(viewingPurchase.id);
      setPurchasesList(prev => prev.filter(p => p.id !== viewingPurchase.id));
      setViewingPurchase(null);
    } catch (err) {
      console.error(err);
      alert("Failed to delete purchase record");
    } finally {
      setIsDeletingPurchase(false);
    }
  };

  const handleGenerateDiscount = async () => {
    const rule = discountRules.find(r => r.id === selectedRuleId);
    if (!rule || !newPromoCode) {
      alert("Please select a rule and enter a promo code.");
      return;
    }

    try {
      const newDisc = await resellerService.createPromo({
        code: newPromoCode,
        rule_name: rule.name,
        discount_type: rule.type === 'nominal' ? 'fixed' : 'percentage',
        discount_value: rule.value,
        discount_id: rule.id,
        expires_at: rule.expires_at || undefined
      });

      setGeneratedDiscounts([...generatedDiscounts, newDisc]);
      setIsCreatingDiscount(false);
      setSelectedRuleId('');
      setNewPromoCode('');
    } catch (error) {
       console.error("Failed to create promo", error);
       alert("Failed to create promo code.");
    }
  };

  const handleToggleDiscountStatus = async (id: string) => {
    try {
      await resellerService.togglePromoStatus(id);
      setGeneratedDiscounts(prev => prev.map(d => 
        d.id === id ? { ...d, status: d.status === 'active' ? 'inactive' : 'active' } : d
      ));
    } catch (error) {
      console.error("Failed to toggle status", error);
    }
  };

  const confirmDeletePromo = async () => {
    if (!promoToDelete) return;
    try {
      await resellerService.deletePromo(promoToDelete.id);
      setGeneratedDiscounts(prev => prev.filter(d => d.id !== promoToDelete.id));
      setPromoToDelete(null);
    } catch (error) {
      console.error("Failed to delete promo", error);
      alert("Failed to delete promo code.");
    }
  };

  const handleSavePrice = async () => {
    if (!editingPrice) return;
    
    try {
      await resellerService.setGlobalPrice({
        voucher_package_id: editingPrice.package_id || editingPrice.id,
        reseller_price: tempResellerPrice,
        retail_price: editingPrice.retail_price
      });
      
      await fetchData(); // Refresh list
      setEditingPrice(null);
    } catch (error) {
      console.error("Failed to update global price", error);
      alert("Failed to update price.");
    }
  };

  const activeReseller = resellersList.find(r => r.id === selectedResellerId);
  const discountAmount = calculateDiscount();
  const totalPrice = selectedPkg ? (selectedPkg.reseller_price * voucherQty) - discountAmount : 0;

  const handleUpdateStatus = async (resellerId: string, status: any) => {
    setIsProcessingStatus(true);
    try {
      await resellerService.updateStatus(resellerId, status);
      setResellersList(prev => prev.map(r => r.id === resellerId ? { ...r, status } : r));
      if (viewingReseller?.id === resellerId) {
        setViewingReseller(prev => prev ? { ...prev, status } : null);
      }
      setResellerToApprove(null);
      setResellerToReject(null);
      setResellerToSuspend(null);
    setResellerToActivate(null);
    } catch (err) {
      console.error(err);
      alert(`Failed to update status to ${status}`);
    } finally {
      setIsProcessingStatus(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!purchaseToConfirm) return;
    setIsProcessingConfirm(true);
    try {
      const updated = await resellerService.confirmPurchase(purchaseToConfirm.id);
      setPurchasesList(prev => prev.map(p => p.id === updated.id ? updated : p));
      setPurchaseToConfirm(null);
      
      // Auto-view the success with vouchers
      setViewingPurchase(updated);
    } catch (err) {
      console.error(err);
      alert("Failed to confirm payment");
    } finally {
      setIsProcessingConfirm(false);
    }
  };

  const handleMidtransPay = async (purchase: ResellerPurchase) => {
    setIsProcessingSnap(true);
    try {
      const token = await resellerService.getSnapToken(purchase.id);
      console.log('Manual pay triggering Snap with token:', token);
      if ((window as any).snap) {
        (window as any).snap.pay(token, {
          onSuccess: (result: any) => {
            console.log('Payment success', result);
            fetchData();
            setViewingPurchase(null);
          },
          onPending: (result: any) => {
            console.log('Payment pending', result);
            setViewingPurchase(null);
          },
          onClose: () => {
            console.log('Snap closed');
          }
        });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to initiate online payment");
    } finally {
      setIsProcessingSnap(false);
    }
  };

  const checkVouchersAndDelete = async (reseller: Reseller) => {
    setIsCheckingVouchers(true);
    try {
      const count = await resellerService.countActiveVouchers(reseller.id);
      setActiveVoucherCount(count);
      setResellerToDelete(reseller);
    } catch (err) {
      console.error(err);
      alert("Failed to check active vouchers");
    } finally {
      setIsCheckingVouchers(false);
    }
  };

  const handleDeleteReseller = async () => {
    if (!resellerToDelete) return;
    setIsDeletingReseller(true);
    try {
      await resellerService.deleteReseller(resellerToDelete.id);
      setResellersList(prev => prev.filter(r => r.id !== resellerToDelete.id));
      if (viewingReseller?.id === resellerToDelete.id) {
        setViewingReseller(null);
      }
      setResellerToDelete(null);
    } catch (err) {
      console.error(err);
      alert("Failed to delete reseller");
    } finally {
      setIsDeletingReseller(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Midtrans Snap SDK - loaded via Next.js Script component */}
      {midtransScriptUrl && (
        <Script
          src={midtransScriptUrl}
          data-client-key={midtransClientKey}
          strategy="afterInteractive"
          onReady={() => {
            console.log('[Midtrans] Snap SDK loaded and ready! window.snap:', !!(window as any).snap);
            setIsSnapReady(true);
          }}
          onError={(e) => {
            console.error('[Midtrans] Failed to load Snap SDK:', e);
          }}
        />
      )}
      {/* Reseller Detail Modal */}
      {viewingReseller && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl">
                  {(viewingReseller.client_name || 'R').charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">{viewingReseller.client_name || 'Reseller'}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      viewingReseller.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {viewingReseller.status}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">Joined: {viewingReseller.join_date}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setViewingReseller(null)} 
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Stats Card */}
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Monthly Revenue</span>
                    <span className="text-2xl font-black text-indigo-700">Rp {(viewingReseller.monthly_revenue || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Orders</span>
                    <span className="text-2xl font-black text-slate-700">{(viewingReseller.total_purchases || 0)} Purchases</span>
                  </div>
                </div>

                {/* Actions Card */}
                <div className="bg-slate-50 p-6 rounded-2xl flex flex-col justify-center gap-4">
                   <button 
                     onClick={() => {/* Navigate or show more profile details if needed */}}
                     className="w-full bg-white border border-slate-200 py-3 rounded-xl font-bold text-sm text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                   >
                      <Eye size={16} /> View Profile
                   </button>
                   {viewingReseller.status === 'active' ? (
                     <button 
                       onClick={() => setResellerToSuspend(viewingReseller)}
                       className="w-full bg-red-50 text-red-600 border border-red-100 py-3 rounded-xl font-bold text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" /></svg> Suspend Account
                     </button>
                   ) : viewingReseller.status === 'suspended' ? (
                     <button 
                       onClick={() => setResellerToActivate(viewingReseller)}
                       className="w-full bg-emerald-50 text-emerald-600 border border-emerald-100 py-3 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Active Account
                     </button>
                   ) : null}
                   
                   <button 
                     onClick={() => checkVouchersAndDelete(viewingReseller)}
                     disabled={isCheckingVouchers}
                     className="w-full bg-white text-red-500 border border-red-100 py-3 rounded-xl font-bold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                   >
                      {isCheckingVouchers ? <History className="animate-spin" size={16} /> : <Trash2 size={16} />} 
                      Delete Reseller
                   </button>
                </div>
              </div>

              {/* Minimal Recent History */}
              <div>
                <h4 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                  <History size={16} className="text-indigo-600" /> Recent Purchase History
                </h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                   {purchasesList.filter(p => p.reseller_id === viewingReseller.id).map(p => (
                     <div key={p.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                        <div>
                          <div className="text-xs font-bold text-slate-800">{p.voucher_package_name || 'Voucher'}</div>
                          <div className="text-[10px] text-slate-400">{new Date(p.created_at).toLocaleString('id-ID')} • {p.quantity} pcs</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-slate-900">Rp {p.total_amount.toLocaleString('id-ID')}</div>
                          <div className="text-[10px] text-emerald-600 font-bold uppercase">
                            {p.payment_method} {p.promo_code && <span className="text-indigo-600 ml-1">• {p.promo_code}</span>}
                          </div>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Voucher Modal (Hybrid Concept) */}
      {isGeneratingVoucher && selectedPkg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Generate Reseller Voucher</h3>
                  <p className="text-xs text-indigo-100 font-bold uppercase tracking-wider">{selectedPkg.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsGeneratingVoucher(false)} 
                className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              {step === 'input' && (
                <div className="space-y-6">
                  {/* Step 1: Select Reseller & Router */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Select Buyer (Reseller)</label>
                      <select 
                        value={selectedResellerId}
                        onChange={(e) => setSelectedResellerId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">-- Choose Reseller --</option>
                        {resellersList.filter(r => r.status === 'active').map(r => (
                          <option key={r.id} value={r.id}>{r.client_name || 'Reseller'}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Target Router</label>
                      <select 
                        value={selectedRouterId}
                        onChange={(e) => setSelectedRouterId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                      >
                        {routersList.length > 0 ? (
                          routersList.map(router => (
                            <option key={router.id} value={router.id}>{router.name}</option>
                          ))
                        ) : (
                          DEFAULT_ROUTERS.map(r => <option key={r} value={r}>{r}</option>)
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Payment & Discount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Payment Method</label>
                       <select 
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                       >
                         <option value="Transfer">Manual Transfer / Cash</option>
                         <option value="balance">Deduct Reseller Balance</option>
                         {isMidtransEnabled && (
                           <option value="midtrans">Online Payment (Midtrans)</option>
                         )}
                       </select>
                    </div>
                    {paymentMethod !== 'balance' && paymentMethod !== 'midtrans' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Account / Bank</label>
                        <select 
                          value={selectedPaymentMethodId}
                          onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                          className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">-- Select Account --</option>
                          {availablePaymentMethods.map(pm => (
                            <option key={pm.id} value={pm.id}>
                              {pm.category.toUpperCase()} - {pm.name || pm.provider}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
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
                          {generatedDiscounts.filter(d => {
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

                  {/* Step 2: Quantity & Calculation */}
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
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1">Total Payment</span>
                        <span className="text-2xl font-black text-slate-900">Rp {totalPrice.toLocaleString('id-ID')}</span>
                        {discountAmount > 0 && (
                          <div className="text-[10px] text-red-500 font-bold mt-1 uppercase">
                            Promo: {generatedDiscounts.find(d => d.id === appliedPromoId)?.code} (-Rp {discountAmount.toLocaleString('id-ID')})
                          </div>
                        )}
                        <div className="text-[10px] text-emerald-600 font-bold mt-1">
                          Est. Margin: Rp {(selectedPkg.margin * voucherQty).toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit button */}
                  <button 
                    disabled={!selectedResellerId}
                    onClick={handleProcessGenerate}
                    className="w-full bg-indigo-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3 uppercase tracking-tighter"
                  >
                    <Plus size={24} />
                    Confirm & Generate 
                  </button>
                </div>
              )}

              {step === 'processing' && (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="relative">
                    <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ShoppingBag className="text-indigo-600 opacity-50" size={32} />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900">Provisioning Vouchers</h4>
                    <p className="text-slate-500 text-sm font-medium mt-1">Connecting to Mikrotik {routersList.find(r => r.id === selectedRouterId)?.name || 'Router'}...</p>
                  </div>
                </div>
              )}

              {step === 'success' && currentGeneratedPurchase && (
                <div className="py-10 text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto scale-110 shadow-lg shadow-emerald-50">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-900">Generation Complete!</h4>
                    <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-xs">{voucherQty} Vouchers created successfully</p>
                  </div>
                  
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-3 text-left">
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>Transaction ID</span>
                      <span className="text-slate-900 font-black">#{currentGeneratedPurchase.id.split('-')[0].toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>Reseller</span>
                      <span className="text-slate-900 font-black">{activeReseller?.client_name}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>Package</span>
                      <span className="text-slate-900 font-black">{selectedPkg.voucher_package_name || selectedPkg.name}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-400">
                      <span>Total Paid</span>
                      <span className="text-slate-900 font-black text-base">Rp {totalPrice.toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setIsGeneratingVoucher(false)}
                      className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Close
                    </button>
                    <button 
                      onClick={() => router.push(`/reseller/print?purchase_id=${currentGeneratedPurchase.id}`)}
                      className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Printer className="w-5 h-5" />
                      Cetak Voucher
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Reseller Modal */}
      {isAddingReseller && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
                 <h3 className="text-lg font-black text-slate-900">Register New Reseller</h3>
                 <button onClick={() => setIsAddingReseller(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="space-y-4">
                    <div className="space-y-1.5 relative">
                       <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Search Client (Name/Phone/Email)</label>
                       <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                          <input 
                             type="text" 
                             value={clientSearch}
                             onChange={(e) => {
                               setClientSearch(e.target.value);
                               setIsClientDropdownOpen(true);
                             }}
                             onFocus={() => setIsClientDropdownOpen(true)}
                             placeholder="Search..."
                             className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 transition-all"
                          />
                       </div>

                       {/* Search Results Dropdown */}
                       {isClientDropdownOpen && clientSearch.length > 0 && (
                          <div className="mt-4 bg-white border border-slate-100 rounded-2xl shadow-sm max-h-60 overflow-y-auto p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                             {filteredClients.length > 0 ? (
                                filteredClients.map(c => (
                                   <button
                                      key={c.id}
                                      onClick={() => {
                                         setSelectedClientId(c.id);
                                         setClientSearch(c.name);
                                         setIsClientDropdownOpen(false);
                                      }}
                                      className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-0.5 ${selectedClientId === c.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                   >
                                      <span className="font-black text-slate-900 text-sm tracking-tight">{c.name}</span>
                                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                         <span className="flex items-center gap-0.5"><Phone size={10} /> {c.phone}</span>
                                         <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                         <span>{c.email}</span>
                                      </div>
                                   </button>
                                ))
                             ) : (
                                <div className="p-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">No clients found</div>
                             )}
                          </div>
                       )}

                       {/* Selected Client Badge */}
                       {selectedClientId && !isClientDropdownOpen && (
                          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between animate-in zoom-in duration-200">
                             <div>
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block leading-none mb-1">Target Client</span>
                                <span className="text-sm font-black text-slate-900">{clientSearchResults.find(c => c.id === selectedClientId)?.name}</span>
                             </div>
                             <button 
                                onClick={() => {
                                   setSelectedClientId('');
                                   setClientSearch('');
                                }}
                                className="text-emerald-600 hover:text-emerald-700 p-1"
                             >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                          </div>
                       )}
                    </div>
                 </div>
                 <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl">
                    <p className="text-[10px] text-indigo-700 font-bold uppercase leading-tight">
                       By registering as a reseller, this client will gain access to specialized voucher pricing and bulk generation tools.
                    </p>
                 </div>
                 <button 
                  disabled={!selectedClientId}
                  onClick={handleAddReseller}
                  className="w-full bg-indigo-600 disabled:bg-slate-200 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                 >
                    <Plus size={20} /> Upgrade to Reseller
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Add Package Modal */}
      {isAddingPackage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl animate-in fade-in zoom-in duration-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
                 <h3 className="text-lg font-black text-slate-900">Add Reseller Package</h3>
                 <button onClick={() => setIsAddingPackage(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="space-y-4">
                    <div className="space-y-1.5 relative">
                       <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Search Voucher Profile</label>
                       <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                          <input 
                              type="text" 
                              value={profileSearch}
                              onChange={(e) => {
                                setProfileSearch(e.target.value);
                                setIsProfileDropdownOpen(true);
                              }}
                              onFocus={() => setIsProfileDropdownOpen(true)}
                              placeholder="Type to search packages..."
                              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 transition-all"
                          />
                       </div>

                       {/* Profile Search List - Expanding Style */}
                       {isProfileDropdownOpen && (
                          <div className="mt-4 bg-white border border-slate-100 rounded-2xl shadow-sm max-h-60 overflow-y-auto p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                             {voucherProfiles.filter(p => p.name.toLowerCase().includes(profileSearch.toLowerCase())).filter(p => !pricingData.some(pd => pd.package_id === p.id)).length > 0 ? (
                                voucherProfiles
                                  .filter(p => p.name.toLowerCase().includes(profileSearch.toLowerCase()))
                                   .filter(p => !pricingData.some(pd => pd.package_id === p.id))
                                  .map(vp => (
                                   <button
                                      key={vp.id}
                                      onClick={() => {
                                         setSelectedProfileId(vp.id);
                                         setProfileSearch(vp.name);
                                         setIsProfileDropdownOpen(false);
                                         setNewResellerPrice(vp.price || vp.default_price || 0);
                                      }}
                                      className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-0.5 ${selectedProfileId === vp.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                   >
                                      <span className="font-black text-slate-900 text-sm tracking-tight">{vp.name}</span>
                                      <span className="text-[10px] font-bold text-slate-400">Retail Price: Rp {formatIDR(vp.price || vp.default_price || 0)}</span>
                                   </button>
                                ))
                             ) : (
                                <div className="p-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">No available profiles found</div>
                             )}
                          </div>
                       )}

                       {/* Selected Profile Detail */}
                       {selectedProfileId && !isProfileDropdownOpen && (
                          <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3 animate-in zoom-in duration-200">
                            <div className="flex justify-between items-start">
                               <div>
                                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block leading-none mb-1">Target Package</span>
                                  <span className="text-sm font-black text-slate-900">{voucherProfiles.find(p => p.id === selectedProfileId)?.name}</span>
                               </div>
                               <button 
                                  onClick={() => {
                                     setSelectedProfileId('');
                                     setProfileSearch('');
                                  }}
                                  className="text-indigo-400 hover:text-indigo-600 p-1"
                               >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                               </button>
                            </div>
                            
                            <div className="space-y-1.5">
                              <label className="text-xs font-black text-indigo-600 uppercase tracking-widest ml-1">Set Reseller Price</label>
                              <div className="relative">
                                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                                 <input 
                                    type="text" 
                                    value={formatIDR(newResellerPrice)}
                                    onChange={(e) => setNewResellerPrice(parseIDR(e.target.value))}
                                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:border-indigo-500 transition-all"
                                 />
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold ml-1">
                                Retail: Rp {formatIDR(voucherProfiles.find(p => p.id === selectedProfileId)?.price || 0)}
                              </p>
                            </div>
                          </div>
                       )}
                    </div>
                 </div>
                 <button 
                  disabled={!selectedProfileId || newResellerPrice <= 0}
                  onClick={handleAddPackage}
                  className="w-full bg-indigo-600 disabled:bg-slate-200 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                 >
                    Confirm & Add Package
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Create Discount Modal */}
      {isCreatingDiscount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
                 <h3 className="text-lg font-black text-slate-900">Generate Promo Code</h3>
                 <button onClick={() => setIsCreatingDiscount(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="space-y-4">
                    <div className="space-y-1.5">
                       <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Select Rule (from Service Setup)</label>
                       <select 
                         value={selectedRuleId}
                         onChange={(e) => setSelectedRuleId(e.target.value)}
                         className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500 transition-all"
                       >
                          <option value="">-- Select Rule --</option>
                           {discountRules.map(r => (
                             <option key={r.id} value={r.id}>
                               {r.name} ({r.type === 'nominal' ? `Rp ${r.value.toLocaleString('id-ID')}` : `${r.value}%`}) 
                               {r.expires_at ? ` - Exp: ${new Date(r.expires_at).toLocaleDateString('id-ID')}` : ' - No Exp'}
                             </option>
                           ))}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Promo Code Name</label>
                       <div className="relative group">
                          <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                          <input 
                             type="text" 
                             value={newPromoCode}
                             onChange={(e) => setNewPromoCode(e.target.value)}
                             placeholder="e.g. MANTAPJAYA"
                             className="w-full pl-12 pr-14 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:border-indigo-500 transition-all uppercase"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                              let code = '';
                              for (let i = 0; i < 5; i++) {
                                code += chars.charAt(Math.floor(Math.random() * chars.length));
                              }
                              setNewPromoCode(code);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all group/btn"
                            title="Auto Generate"
                          >
                             <Sparkles size={16} className="group-hover/btn:animate-pulse" />
                          </button>
                       </div>
                       <p className="text-[10px] text-slate-400 font-bold ml-1 uppercase tracking-tight">Enter manually or click sparkles to auto-generate</p>
                    </div>
                 </div>
                 <button 
                  disabled={!selectedRuleId || !newPromoCode}
                  onClick={handleGenerateDiscount}
                  className="w-full bg-indigo-600 disabled:bg-slate-200 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                 >
                    Generate & Add to List
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Edit Price Modal (UI Only) */}
      {editingPrice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
              <div>
                <h3 className="text-lg font-black text-slate-900">Adjust Reseller Price</h3>
                <p className="text-xs text-slate-500 font-bold uppercase">{editingPrice.name}</p>
              </div>
              <button onClick={() => setEditingPrice(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-bold">Standard Retail Price</span>
                  <span className="text-slate-900 font-black">Rp {editingPrice.retail_price.toLocaleString('id-ID')}</span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-black text-indigo-600 uppercase tracking-wider">Reseller Price</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                    <input 
                      type="text" 
                      value={formatIDR(tempResellerPrice)}
                      onChange={(e) => {
                        const raw = parseIDR(e.target.value);
                        setTempResellerPrice(raw);
                      }}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xl font-black text-slate-900 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center">Your Estimated Margin</span>
                    <span className="block text-2xl font-black text-emerald-700">Rp {(editingPrice.retail_price - tempResellerPrice).toLocaleString('id-ID')}</span>
                  </div>
                  <TrendingUp className="text-emerald-500" size={32} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setEditingPrice(null)}
                  className="flex-1 px-6 py-3 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSavePrice}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  Apply Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Promo Confirmation Modal */}
      {promoToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Delete Promo Code?</h3>
              <p className="text-slate-500 text-sm font-medium mb-8">
                Are you sure you want to delete <span className="font-black text-slate-900">{promoToDelete.code}</span>? 
                This action cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setPromoToDelete(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeletePromo}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-all"
                >
                  Delete Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Dialog */}
      {purchaseToConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${purchaseToConfirm.status === 'verifying' ? 'bg-indigo-50 text-indigo-500' : 'bg-emerald-50 text-emerald-500'}`}>
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">
                {purchaseToConfirm.status === 'verifying' ? 'Settle Payment?' : 'Confirm Order?'}
              </h3>
              <p className="text-slate-500 text-sm font-medium mb-8">
                {purchaseToConfirm.status === 'verifying' ? (
                  <>Settle the total payment of <span className="font-black text-slate-900">Rp {purchaseToConfirm.total_amount.toLocaleString('id-ID')}</span> from <span className="font-black text-slate-900">{purchaseToConfirm.reseller_name}</span>?</>
                ) : (
                  <>Confirm the purchase of <span className="font-black text-slate-900">{purchaseToConfirm.voucher_package_name}</span> by <span className="font-black text-slate-900">{purchaseToConfirm.reseller_name}</span>?</>
                )}
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setPurchaseToConfirm(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmPayment}
                  disabled={isProcessingConfirm}
                  className={`flex-1 px-6 py-3 text-white rounded-2xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${purchaseToConfirm.status === 'paylater' ? 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700' : 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700'}`}
                >
                  {isProcessingConfirm ? <History className="animate-spin" size={16} /> : (purchaseToConfirm.status === 'paylater' ? "Settle Now" : "Confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Purchase Detail Modal */}
      {viewingPurchase && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 text-slate-900">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div>
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <History className="text-indigo-500" size={24} />
                    Purchase Details
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-wider">Transaction ID: {viewingPurchase.id}</p>
               </div>
               <button 
                onClick={() => {
                  setViewingPurchase(null);
                  setIsConfirmingDeletePurchase(false);
                }}
                className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-200"
               >
                  <Plus size={24} className="rotate-45" />
               </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Reseller</span>
                  <div className="text-slate-900 font-extrabold">{viewingPurchase.reseller_name}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Package</span>
                  <div className="text-slate-900 font-extrabold">{viewingPurchase.voucher_package_name}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Amount</span>
                  <div className="text-slate-900 font-extrabold">Rp {viewingPurchase.total_amount.toLocaleString('id-ID')}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Date</span>
                  <div className="text-slate-900 font-extrabold">{new Date(viewingPurchase.created_at).toLocaleString('id-ID')}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Method</span>
                  <div className="text-slate-900 font-extrabold uppercase">{viewingPurchase.payment_method === 'balance' ? 'Potong Saldo' : viewingPurchase.payment_method}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</span>
                  <div className={`font-black uppercase tracking-tight ${
                    viewingPurchase.status === 'success' ? 'text-emerald-600' : 
                    viewingPurchase.status === 'paylater' ? 'text-indigo-600' : 
                    viewingPurchase.status === 'verifying' ? 'text-blue-600' :
                    'text-amber-600'
                  }`}>{viewingPurchase.status}</div>
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Ticket size={18} className="text-indigo-500" />
                  Generated Vouchers ({viewingPurchase.quantity})
                </h4>
              </div>

              <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr className="text-slate-500 font-black uppercase tracking-widest">
                      <th className="px-6 py-3 text-slate-500">Username</th>
                      <th className="px-6 py-3 text-slate-500">Password</th>
                      <th className="px-6 py-3 text-slate-500">Price</th>
                      <th className="px-6 py-3 text-slate-500">Package</th>
                      <th className="px-6 py-3 text-slate-500">Router</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 scrollbar-hide">
                    {viewingPurchase.vouchers && viewingPurchase.vouchers.length > 0 ? (
                      viewingPurchase.vouchers.map((v, i) => (
                        <tr key={v.id || i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3 font-black text-slate-900 select-all">{v.code}</td>
                          <td className="px-6 py-3 font-bold text-slate-600 select-all">{v.password}</td>
                          <td className="px-6 py-3 font-bold text-emerald-600">
                            Rp {(v.package_price || viewingPurchase.unit_price).toLocaleString('id-ID')}
                          </td>
                          <td className="px-6 py-3 font-medium text-slate-500">{v.package_name || viewingPurchase.voucher_package_name}</td>
                          <td className="px-6 py-3">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase">{v.router_name || 'All Routers'}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold italic">
                          No voucher details available for this purchase record.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex justify-between items-center">
              <div>
                {isConfirmingDeletePurchase ? (
                  <div className="flex items-center gap-3 animate-in slide-in-from-left-2 transition-all">
                    <span className="text-xs font-black text-red-600 uppercase tracking-widest animate-pulse">Confirm Delete?</span>
                    <button 
                      onClick={handleDeletePurchase}
                      disabled={isDeletingPurchase}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black shadow-lg shadow-red-100 hover:bg-red-700 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isDeletingPurchase ? <Sparkles className="animate-spin" size={14} /> : <Trash2 size={14} />}
                      YES, DELETE ALL
                    </button>
                    <button 
                      onClick={() => setIsConfirmingDeletePurchase(false)}
                      className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-300 transition-all text-slate-600"
                    >
                      NO
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsConfirmingDeletePurchase(true)}
                    className="px-4 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-black hover:bg-red-100 transition-all flex items-center gap-2 border border-red-100"
                  >
                    <Trash2 size={14} />
                    Delete History & Vouchers
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => router.push(`/reseller/print?purchase_id=${viewingPurchase.id}`)}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
                >
                  <Printer size={18} />
                  Cetak Voucher
                </button>
                {viewingPurchase.status !== 'success' && isMidtransEnabled && (
                  <button 
                    onClick={() => handleMidtransPay(viewingPurchase)}
                    disabled={isProcessingSnap}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isProcessingSnap ? (
                      <Clock className="animate-spin" size={18} />
                    ) : (
                      <ShoppingBag size={18} />
                    )}
                    Pay Online
                  </button>
                )}
                <button 
                  onClick={() => setViewingPurchase(null)}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header & Stats Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Reseller Management</h1>
          <p className="text-slate-500 mt-1">Manage your voucher distribution partnership network</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end px-4 border-r border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Resellers</span>
            <span className="text-xl font-bold text-indigo-600">{resellersList.length}</span>
          </div>
          <div className="flex flex-col items-end px-4 border-r border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Revenue</span>
            <span className="text-xl font-bold text-emerald-600">
              Rp {purchasesList
                .filter(p => {
                  const date = new Date(p.created_at);
                  const now = new Date();
                  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() && p.status === 'success';
                })
                .reduce((acc, p) => acc + (p.margin || 0), 0)
                .toLocaleString('id-ID')}
            </span>
          </div>
          
          {activeTab === 'pricing' ? (
            <button 
              onClick={() => setIsAddingPackage(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
            >
              <Package size={18} />
              Add Package
            </button>
          ) : activeTab === 'discounts' ? (
            <button 
              onClick={() => setIsCreatingDiscount(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
            >
              <Tag size={18} />
              New Promo
            </button>
          ) : (
            <button 
              onClick={() => setIsAddingReseller(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-100 flex items-center gap-2"
            >
              <Plus size={18} />
              Add Reseller
            </button>
          )}
        </div>
      </div>

      <LimitWarningBanner resource="vouchers" />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users size={18} />
          Reseller List
        </button>
        <button 
          onClick={() => setActiveTab('purchases')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'purchases' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <History size={18} />
          Purchase History
        </button>
        <button 
          onClick={() => setActiveTab('generate')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'generate' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Ticket size={18} />
          Generate Voucher
        </button>
        <button 
          onClick={() => setActiveTab('discounts')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'discounts' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Tag size={18} />
          Discount Promo
        </button>
        <button 
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'pricing' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Settings size={18} />
          Price Settings
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
        {/* Search & Filters */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search data..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm bg-white border border-slate-200 rounded-xl px-4 py-2 focus:outline-none"
            >
              <option value="All Status">All Status</option>
              {activeTab === 'purchases' ? (
                 <>
                   <option value="success">Success</option>
                   <option value="pending">Pending</option>
                   <option value="paylater">Pay Later</option>
                   <option value="verifying">Verifying</option>
                   <option value="failed">Failed</option>
                 </>
              ) : (
                 <>
                   <option value="active">Active</option>
                   <option value="pending">Pending</option>
                   <option value="suspended">Suspended</option>
                 </>
              )}
            </select>
            {activeTab === 'purchases' && (
              <details className="relative">
                <summary className="list-none cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                  <Columns size={16} />
                  <span>Columns</span>
                </summary>
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                    <TableProperties size={14} className="text-indigo-500" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">Display Columns</span>
                  </div>
                  <div className="space-y-2.5">
                    {(Object.entries({
                      date: 'Date',
                      reseller: 'Reseller',
                      package: 'Package',
                      qty: 'QTY',
                      discount: 'Discount',
                      payment: 'Payment',
                      total: 'Total',
                      status: 'Status',
                      actions: 'Actions'
                    }) as [PurchaseColumnKey, string][]).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer group/col">
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={visibleColumnsPurchases[key]}
                            onChange={(e) => setPurchaseColumn(key, e.target.checked)}
                            className="peer w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-600 group-hover/col:text-indigo-600 transition-colors uppercase tracking-tight text-[11px]">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>

        {/* --- Content Views --- */}
        <div className="p-0">
          {activeTab === 'discounts' && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {Array.isArray(generatedDiscounts) && generatedDiscounts.map((d) => (
                  <div key={d.id} className={`p-6 bg-slate-50 border rounded-3xl relative overflow-hidden group transition-all ${d.status === 'active' ? 'border-slate-200 hover:border-indigo-300' : 'opacity-60 border-slate-100'}`}>
                     <div className="absolute top-0 right-0 p-3">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-bl-xl ${d.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                           {d.status}
                        </span>
                     </div>
                     <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.status === 'active' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                           {d.discount_type === 'fixed' ? <Ticket size={20} /> : <Percent size={20} />}
                        </div>
                        <div>
                           <h4 className="font-black text-slate-900 uppercase tracking-tighter text-lg">{d.code}</h4>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{d.rule_name}</p>
                        </div>
                     </div>
                     
                     <div className="space-y-3">
                        <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100">
                           <span className="text-xs font-bold text-slate-400">Value</span>
                           <span className="text-sm font-black text-slate-900">
                              {d.discount_type === 'fixed' ? `Rp ${d.discount_value.toLocaleString('id-ID')}` : `${d.discount_value}% Off`}
                           </span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-400 px-1">
                           <div className="flex items-center gap-1">
                              <Calendar size={12} /> Expiry: {d.expires_at ? new Date(d.expires_at).toLocaleDateString('id-ID') : 'Never'}
                           </div>
                        </div>
                     </div>

                     <div className="mt-6 flex gap-2">
                        <button 
                          onClick={() => handleToggleDiscountStatus(d.id)}
                          className="flex-1 bg-white border border-slate-200 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                           {d.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button 
                          onClick={() => setPromoToDelete(d)}
                          className="p-2 border border-slate-200 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
                        >
                           <Trash2 size={16} />
                        </button>
                     </div>
                  </div>
               ))}
            </div>
          )}
          {activeTab === 'list' && (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Join Date</th>
                  <th className="px-6 py-4">Monthly Revenue</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.isArray(resellersList) && resellersList
                  .filter(r => (r.client_name || '').toLowerCase().includes(search.toLowerCase()))
                  .filter(r => filterStatus === 'All Status' || r.status === filterStatus)
                  .map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{r.client_name || 'Reseller'}</div>
                      <div className="text-xs text-slate-400 font-medium">ID: RES-{r.id.substring(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{r.client_phone}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        r.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        r.status === 'suspended' ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700 text-sm">
                      {new Date(r.join_date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-bold">
                      Rp {(r.monthly_revenue || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {r.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => setResellerToApprove(r)}
                              className="text-emerald-500 hover:text-emerald-700 p-2 rounded-lg border border-transparent hover:border-emerald-200 hover:bg-emerald-50 transition-all flex items-center gap-1 text-xs font-bold"
                              title="Approve"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button 
                              onClick={() => setResellerToReject(r)}
                              className="text-red-400 hover:text-red-600 p-2 rounded-lg border border-transparent hover:border-red-200 hover:bg-red-50 transition-all flex items-center gap-1 text-xs font-bold"
                              title="Reject"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => setViewingReseller(r)}
                          className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white transition-all flex items-center gap-1 text-xs font-bold"
                        >
                          <Search size={16} /> View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'purchases' && (
            <>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  {visibleColumnsPurchases.date && <th className="px-6 py-4">Date</th>}
                  {visibleColumnsPurchases.reseller && <th className="px-6 py-4">Reseller</th>}
                  {visibleColumnsPurchases.package && <th className="px-6 py-4">Package</th>}
                  {visibleColumnsPurchases.qty && <th className="px-6 py-4">QTY</th>}
                  {visibleColumnsPurchases.discount && <th className="px-6 py-4">Discount</th>}
                  {visibleColumnsPurchases.payment && <th className="px-6 py-4">Payment</th>}
                  {visibleColumnsPurchases.total && <th className="px-6 py-4">Total</th>}
                  {visibleColumnsPurchases.status && <th className="px-6 py-4">Status</th>}
                  {visibleColumnsPurchases.actions && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.isArray(purchasesList) && purchasesList
                  .filter(p => (p.reseller_name || '').toLowerCase().includes(search.toLowerCase()) || (p.voucher_package_name || '').toLowerCase().includes(search.toLowerCase()))
                  .filter(p => filterStatus === 'All Status' || p.status === filterStatus)
                  .map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors text-sm group">
                    {visibleColumnsPurchases.date && (
                      <td className="px-6 py-4 text-slate-600 font-medium">{new Date(p.created_at).toLocaleString('id-ID')}</td>
                    )}
                    {visibleColumnsPurchases.reseller && (
                      <td className="px-6 py-4 font-bold text-slate-900">{p.reseller_name || 'Reseller'}</td>
                    )}
                    {visibleColumnsPurchases.package && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                          <span className="font-semibold text-slate-700">{p.voucher_package_name || 'Voucher'}</span>
                        </div>
                      </td>
                    )}
                    {visibleColumnsPurchases.qty && (
                      <td className="px-6 py-4 font-bold text-slate-600">{p.quantity} pcs</td>
                    )}
                    {visibleColumnsPurchases.discount && (
                      <td className="px-6 py-4 font-bold text-red-500">
                        {(p.discount_amount || 0) > 0 ? `-Rp ${p.discount_amount.toLocaleString('id-ID')}` : '-'}
                      </td>
                    )}
                    {visibleColumnsPurchases.payment && (
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 rounded-md text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          {p.payment_method}
                        </span>
                      </td>
                    )}
                    {visibleColumnsPurchases.total && (
                      <td className="px-6 py-4 font-extrabold text-slate-900">
                        Rp {p.total_amount.toLocaleString('id-ID')}
                      </td>
                    )}
                    {visibleColumnsPurchases.status && (
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          p.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 
                          p.status === 'paylater' ? 'bg-indigo-100 text-indigo-700' :
                          p.status === 'verifying' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    )}
                    {visibleColumnsPurchases.actions && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {(p.status === 'pending' || p.status === 'verifying') && (
                            <button 
                              onClick={() => setPurchaseToConfirm(p)}
                              className={`${p.status === 'verifying' ? 'text-indigo-500 hover:text-indigo-700 hover:border-indigo-200 hover:bg-indigo-50' : 'text-emerald-500 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50'} p-2 rounded-lg border border-transparent transition-all flex items-center gap-1 text-xs font-bold`}
                              title={p.status === 'verifying' ? "Settle Payment" : "Confirm Order"}
                            >
                              <CheckCircle size={16} /> {p.status === 'verifying' ? 'Settle' : 'Confirm'}
                            </button>
                          )}
                          <button 
                            onClick={async () => {
                              try {
                                setLoading(true);
                                const details = await resellerService.getPurchase(p.id);
                                setViewingPurchase(details);
                              } catch (err) {
                                console.error("Failed to load purchase details", err);
                                setViewingPurchase(p);
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white transition-all flex items-center gap-1 text-xs font-bold"
                          >
                            <Eye size={16} /> View
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            
            {purchasesList.length < purchaseTotal && (
              <div className="p-6 flex justify-center border-t border-slate-100 bg-white items-center gap-3">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                   Showing {purchasesList.length} of {purchaseTotal}
                 </span>
                 <button 
                   onClick={handleLoadMorePurchases}
                   disabled={isLoadingMorePurchases}
                   className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                 >
                   {isLoadingMorePurchases ? <Loader2 className="animate-spin" size={16} /> : <History size={16} />}
                   View More
                 </button>
              </div>
            )}
            </>
          )}

          {activeTab === 'pricing' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pricingData.map((sp) => (
                  <div 
                    key={sp.id} 
                    onClick={() => handleOpenGenerate(sp)}
                    className="p-6 bg-slate-50 border border-slate-200 rounded-2xl relative group hover:border-indigo-300 transition-all cursor-pointer hover:shadow-xl hover:shadow-indigo-50 hover:-translate-y-1"
                  >
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button 
                        onClick={(e) => handleEditPrice(e, sp)}
                        className="bg-white p-2 rounded-xl border border-slate-100 text-slate-400 hover:text-indigo-600 shadow-sm transition-all hover:scale-110 active:scale-95 z-10"
                      >
                        <Settings size={18} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if(confirm('Remove this package from reseller list?')) {
                            setPricingData(prev => prev.filter(item => item.id !== sp.id));
                          }
                        }}
                        className="bg-white p-2 rounded-xl border border-slate-100 text-slate-400 hover:text-red-500 shadow-sm transition-all hover:scale-110 active:scale-95 z-10"
                      >
                        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <Package size={22} />
                      </div>
                      <h3 className="font-extrabold text-slate-900">{sp.name}</h3>
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
                ))}
               </div>
            </div>
          )}

          {activeTab === 'generate' && (
            <div className="p-6">
              <div className="mb-8">
                <h3 className="text-xl font-black text-slate-900">Beli Voucher (Untuk Reseller)</h3>
                <p className="text-sm text-slate-500 font-medium">Pilih paket voucher untuk dieksekusi atas nama reseller.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pricingData.length > 0 ? (
                  pricingData.map((sp) => (
                    <div 
                      key={sp.id} 
                      onClick={() => handleOpenGenerate(sp)}
                      className="group p-6 bg-white border border-slate-200 rounded-[32px] hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
                    >
                      <div className="absolute top-0 right-0 p-4">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          <ShoppingBag size={20} />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles size={14} className="text-amber-400 fill-amber-400" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reseller Package</span>
                        </div>
                        <h4 className="text-xl font-black text-slate-900 mb-4">{sp.name}</h4>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-medium italic">Retail Price</span>
                            <span className="text-slate-400 font-bold line-through ml-2">Rp {sp.retail_price.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">Your Price</span>
                            <span className="text-xl font-black text-indigo-600">Rp {sp.reseller_price.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="pt-2 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Est. Margin</span>
                            <span className="text-emerald-600 font-extrabold text-lg">Rp {sp.margin.toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-center gap-2 text-indigo-600 font-black text-sm group-hover:gap-4 transition-all uppercase tracking-tighter">
                        Generate Vouchers <ArrowRight size={18} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px]">
                    <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4" />
                    <h4 className="text-lg font-black text-slate-400 uppercase">Belum Ada Paket</h4>
                    <p className="text-slate-400 text-sm font-medium">Daftarkan paket voucher di tab Price Settings terlebih dahulu.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Approval Alert Dialog */}
      {resellerToApprove && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Approve Reseller?</h3>
              <p className="text-slate-500 text-sm font-medium mb-8">
                Are you sure you want to approve <span className="font-black text-slate-900">{resellerToApprove.client_name}</span> as a reseller? 
                This will grant them access to reseller tools.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setResellerToApprove(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleUpdateStatus(resellerToApprove.id, 'active')}
                  disabled={isProcessingStatus}
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessingStatus ? <History size={16} className="animate-spin" /> : "Approve"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Alert Dialog */}
      {resellerToReject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Reject Application?</h3>
              <p className="text-slate-500 text-sm font-medium mb-8">
                Do you want to reject the reseller application from <span className="font-black text-slate-900">{resellerToReject.client_name}</span>?
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setResellerToReject(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleUpdateStatus(resellerToReject.id, 'rejected')}
                  disabled={isProcessingStatus}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessingStatus ? <History size={16} className="animate-spin" /> : "Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suspension Alert Dialog */}
      {resellerToSuspend && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Suspend Account?</h3>
              <p className="text-slate-500 text-sm font-medium mb-8">
                Temporarily suspend <span className="font-black text-slate-900">{resellerToSuspend.client_name}</span>? 
                They won't be able to generate new vouchers.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setResellerToSuspend(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleUpdateStatus(resellerToSuspend.id, 'suspended')}
                  disabled={isProcessingStatus}
                  className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessingStatus ? <History size={16} className="animate-spin" /> : "Suspend"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activation Alert Dialog */}
      {resellerToActivate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Activate Account?</h3>
              <p className="text-slate-500 text-sm font-medium mb-8">
                Re-activate <span className="font-black text-slate-900">{resellerToActivate.client_name}</span> account?
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setResellerToActivate(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleUpdateStatus(resellerToActivate.id, 'active')}
                  disabled={isProcessingStatus}
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessingStatus ? <History size={16} className="animate-spin" /> : "Activate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Alert Dialog */}
      {resellerToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Delete Reseller Account?</h3>
              
              {activeVoucherCount > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-left">
                  <AlertTriangle className="text-red-500 shrink-0" size={20} />
                  <div>
                    <span className="block text-sm font-black text-red-800 uppercase tracking-tight">Active Vouchers Warning</span>
                    <p className="text-xs font-bold text-red-600/80 leading-relaxed">
                      This reseller still has <span className="font-black underline">{activeVoucherCount} active vouchers</span>! 
                      Deleting this account will also permanently delete these vouchers and all purchase history.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-slate-500 text-sm font-medium mb-8">
                Are you sure you want to delete <span className="font-black text-slate-900">{resellerToDelete.client_name}</span>? 
                This action is destructive and cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setResellerToDelete(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteReseller}
                  disabled={isDeletingReseller}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                >
                  {isDeletingReseller ? <History size={16} className="animate-spin" /> : "Delete PERMANENTLY"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
