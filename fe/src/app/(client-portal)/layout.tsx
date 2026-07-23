'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { portalService } from '@/lib/api/portalService';

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, isAuthenticated, isHydrated } = useAuthStore();
  const router = useRouter();
  const [portalBlocked, setPortalBlocked] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    const checkPortalAccess = async () => {
      try {
        await portalService.getDashboardData();
        setPortalBlocked(false);
      } catch (err: any) {
        const status = err?.response?.status ?? err?.statusCode;
        const features = err?.response?.data?.features ?? [];
        const message = String(err?.response?.data?.message ?? '');
        if (status === 403 && (features.includes('client_portal') || message.includes('Client Portal'))) {
          setPortalBlocked(true);
        }
      } finally {
        setCheckingAccess(false);
      }
    };
    if (isHydrated) {
      checkPortalAccess();
    }
  }, [isHydrated]);

  // Mobile Bottom Navigation Items
  const navItems = [
    {
      label: 'Home',
      href: '/portal/dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: 'Billing',
      href: '/portal/billing',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      label: 'Reseller',
      href: '/portal/reseller',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Profile',
      href: '/portal/profile',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  if (!isHydrated || checkingAccess) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  // ─── Plan-gated: Basic plan → show upgrade screen ────────────────────────
  if (portalBlocked) {
    return (
      <AuthGuard>
        <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
          {/* Background Orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative w-full max-w-md text-center">
            {/* Lock Icon */}
            <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            {/* Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-amber-400/10 text-amber-300 border border-amber-400/20 mb-4">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Fitur Premium
            </span>

            <h1 className="text-3xl font-extrabold text-white mb-3 leading-tight">
              Client Portal Tidak Tersedia
            </h1>
            <p className="text-slate-400 leading-relaxed mb-8">
              Fitur{' '}
              <span className="text-indigo-300 font-semibold">Client Portal</span> hanya tersedia
              untuk paket{' '}
              <span className="text-white font-semibold">Pro, Business,</span> dan{' '}
              <span className="text-white font-semibold">Enterprise</span>.
              <br />
              <span className="text-sm mt-2 block">
                Hubungi penyedia layanan internet Anda untuk upgrade paket.
              </span>
            </p>

            {/* Plan comparison mini */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-left space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className="text-sm text-slate-400">
                  Paket <strong className="text-slate-300">Basic</strong> — Tanpa akses Client Portal
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm text-slate-300">
                  Paket <strong className="text-white">Pro, Business, Enterprise</strong> — Client Portal aktif ✓
                </span>
              </div>
            </div>

            <button
              onClick={() => logout().then(() => router.push('/login'))}
              className="w-full py-3 px-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-sm font-medium transition-all"
            >
              Keluar dari Portal
            </button>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between md:hidden">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                    CP
                </div>
                <h1 className="font-semibold text-slate-900">Client Portal</h1>
            </div>
            <button 
                onClick={() => logout().then(() => router.push('/login'))}
                className="text-slate-500 hover:text-red-600"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
            </button>
        </header>

        {/* Desktop Sidebar */}
        <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
          <div className="flex min-h-0 flex-1 flex-col border-r border-slate-200 bg-white">
            <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
              <div className="flex shrink-0 items-center px-4 mb-5">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold mr-2">
                    CP
                </div>
                <h1 className="text-xl font-bold text-slate-900">Client Portal</h1>
              </div>
              <nav className="mt-5 flex-1 space-y-1 px-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                        ${isActive 
                          ? 'bg-indigo-50 text-indigo-600' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                      `}
                    >
                      <div className={`mr-3 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'}`}>
                        {item.icon}
                      </div>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex shrink-0 border-t border-slate-200 p-4">
              <div className="flex items-center w-full">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
                <button
                    onClick={() => logout().then(() => router.push('/login'))}
                    className="ml-2 p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-slate-100"
                    title="Logout"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="md:pl-64">
          <div className="px-4 py-6 md:px-8">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 md:hidden">
            <div className="grid grid-cols-4 h-16">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center space-y-1 ${
                                isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            <div className={`${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                                {item.icon}
                            </div>
                            <span className="text-xs font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
      </div>
    </AuthGuard>
  );
}
