'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { portalService, PortalDashboardData } from '@/lib/api/portalService';
import { toast } from 'sonner';

export default function PortalDashboardPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PortalDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await portalService.getDashboardData();
        console.log('[PortalDashboard] Fetched data:', res);
        setData(res);
      } catch (err: any) {
        console.error('[PortalDashboard] Fetch error:', err);
        
        // Force logout if client data not found (happens when admin/owner tries to access portal)
        if (err?.statusCode === 403) {
          toast.error('Akun Anda tidak terhubung dengan data pelanggan. Mengeluarkan sesi...', {
            duration: 3000
          });
          setTimeout(() => {
            useAuthStore.getState().logout();
          }, 2000);
        }
        
        setError(err?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 mb-4">{error || 'Something went wrong'}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const billAmount = data.bill_amount ?? (data as any).billAmount ?? 0;
  const unpaidCount = data.unpaid_count ?? (data as any).unpaidCount ?? 0;
  const packageName = data.package_name ?? (data as any).packageName ?? 'No Package';
  const clientName = data.client_name ?? (data as any).clientName ?? user?.name ?? 'Pelanggan';
  const clientCode = data.client_code ?? (data as any).clientCode ?? '-';
  const isOverdue = data.due_date ? new Date(data.due_date) < new Date() : false;

  console.log('[PortalDashboard] Mapping Check:', {
    billAmount,
    unpaidCount,
    packageName,
    clientName,
    clientCode,
    dueDate: data.due_date,
    status: data.status
  });

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
            Halo, {clientName}! 👋
        </h1>
        <p className="text-sm text-slate-500">ID Pelanggan: {clientCode}</p>
      </div>

      {/* Status Card */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
        
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-indigo-100 text-sm font-medium">Paket Saat Ini</p>
                    <h2 className="text-xl font-bold mt-1">{packageName}</h2>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    data.status === 'active' ? 'bg-emerald-400/20 text-emerald-100 border border-emerald-400/30' : 'bg-red-400/20 text-red-100 border border-red-400/30'
                }`}>
                    {data.status === 'active' ? 'AKTIF' : (data.status === 'isolir' ? 'TERISOLIR' : data.status)}
                </span>
            </div>
            
            <div className="pt-4 border-t border-white/20">
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-indigo-100 text-xs mb-1">Tagihan Berikutnya</p>
                        <p className="text-2xl font-bold">Rp {billAmount.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-indigo-100 text-xs mb-1">Jatuh Tempo</p>
                        <p className={`font-medium ${isOverdue ? 'text-red-200' : 'text-white'}`}>
                            {data.due_date 
                              ? new Date(data.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric'}) 
                              : (data as any).payment_due_day 
                                ? `Setiap tanggal ${(data as any).payment_due_day}` 
                                : '-'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/portal/billing" className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center gap-2">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            </div>
            <span className="text-sm font-medium text-slate-700">Bayar Tagihan</span>
            {unpaidCount > 0 && (
                <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">
                    {unpaidCount} Pending
                </span>
            )}
        </Link>
        <Link href="/portal/reseller" className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center gap-2">
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <span className="text-sm font-medium text-slate-700">Jadi Reseller</span>
            <span className="text-xs text-purple-500 font-medium">Dapat Cuan!</span>
        </Link>
      </div>

      {/* Recent Activity / Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Informasi Penting</h3>
        <ul className="space-y-3">
             <li className="flex gap-3 text-sm">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5" />
                <span className="text-slate-600">
                    Jaringan sedang dalam maintenance rutin setiap bulan. Simak info di grup WA.
                </span>
             </li>
             <li className="flex gap-3 text-sm">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5" />
                <span className="text-slate-600">
                    Silakan lakukan pembayaran sebelum jatuh tempo untuk menghindari isolir otomatis.
                </span>
             </li>
        </ul>
      </div>
    </div>
  );
}

