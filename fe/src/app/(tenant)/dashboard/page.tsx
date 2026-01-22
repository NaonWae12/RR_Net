'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useRole } from '@/lib/hooks/useRole';
import { MetricCard, PlanCard, LimitsCard, FeaturesCard, QuickActions } from '@/components/dashboard';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { clearRoleContext } from '@/lib/utils/roleContext';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, tenant, ready: authReady } = useAuthStore();
  const { data, loading, error, fetchDashboardData, lastUpdated } = useDashboardStore();
  const { role, originalRole, switched, roleContext, isAdmin, isTechnician, isFinance, isHR } = useRole();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Wait for authStore.ready before fetching - consistent with Employees page pattern
    // This ensures token is fully synced to apiClient before making requests
    // Also check if data already exists or is loading to prevent duplicate calls
    if (authReady) {
      // Auth is ready, but only fetch if data doesn't exist and not already loading
      // Layout.tsx also calls fetchDashboardData, so we need to coordinate
      if (!data && !loading) {
        fetchDashboardData();
      }
    } else {
      // Wait for auth ready using subscribe pattern
      const unsubscribe = useAuthStore.subscribe((state) => {
        // Only fetch if ready, not loading, and no data yet
        if (state.ready && !loading && !data) {
          fetchDashboardData();
          unsubscribe(); // Clean up after first ready signal
        }
      });
      
      // Cleanup on unmount
      return () => {
        unsubscribe();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authReady, router, fetchDashboardData, data, loading]);

  if (!isAuthenticated) {
    return null;
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  const handleReturnToOriginalRole = () => {
    clearRoleContext();
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Role Switch Indicator */}
      {switched && roleContext && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Working as: <span className="capitalize">{roleContext.activeRole}</span>
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  You are viewing the dashboard as {roleContext.activeRole}. All UI and menus will reflect this role.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReturnToOriginalRole}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Return to {originalRole === 'owner' ? 'Owner' : 'Admin'} Mode
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {user?.name || 'User'}!
          </h1>
          <p className="text-slate-500 mt-1">
            {tenant?.name || 'Your ISP Dashboard'} Overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-sm text-slate-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchDashboardData()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <LoadingSpinner size={16} />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Dashboard Content Based on Effective Role */}
      {isAdmin ? (
        <>
          {/* Admin/Owner Full Dashboard */}
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Clients"
              value={data?.clientStats?.total || 0}
              subtitle={data?.clientStats?.unlimited ? 'Unlimited' : `of ${data?.clientStats?.limit || 0} limit`}
              variant={
                data?.clientStats?.unlimited ? 'success' :
                  (data?.clientStats?.remaining || 0) < 10 ? 'warning' : 'default'
              }
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <MetricCard
              title="Remaining Slots"
              value={data?.clientStats?.unlimited ? '∞' : data?.clientStats?.remaining || 0}
              subtitle="Available client slots"
              variant={
                data?.clientStats?.unlimited ? 'success' :
                  (data?.clientStats?.remaining || 0) < 10 ? 'danger' : 'info'
              }
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            />
            <MetricCard
              title="Plan"
              value={data?.plan?.name || 'No Plan'}
              subtitle={data?.plan ? `${new Intl.NumberFormat('id-ID').format(data.plan.price_monthly)} ${data.plan.currency}/mo` : 'Contact admin'}
              variant="info"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              }
            />
            <MetricCard
              title="Features"
              value={Object.values(data?.features || {}).filter(Boolean).length}
              subtitle="Active features"
              variant="success"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - 2/3 */}
            <div className="lg:col-span-2 space-y-6">
              <PlanCard plan={data?.plan || null} />
              <FeaturesCard features={data?.features || {}} />
            </div>

            {/* Right Column - 1/3 */}
            <div className="space-y-6">
              <QuickActions />
              <LimitsCard
                limits={data?.limits || {}}
                clientStats={data?.clientStats}
              />
            </div>
          </div>

          {/* Employee Features */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Employee Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/attendance"
                className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900">Attendance</h3>
                </div>
                <p className="text-sm text-slate-600">Check in/out and view attendance history</p>
              </Link>
              <Link
                href="/reimbursement"
                className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900">Reimbursement</h3>
                </div>
                <p className="text-sm text-slate-600">Submit and track reimbursement requests</p>
              </Link>
              <Link
                href="/time-off"
                className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900">Time Off</h3>
                </div>
                <p className="text-sm text-slate-600">Request and manage time off</p>
              </Link>
              <Link
                href="/payslip"
                className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900">Payslip</h3>
                </div>
                <p className="text-sm text-slate-600">View and download your payslips</p>
              </Link>
            </div>
          </div>
        </>
      ) : isTechnician ? (
        <>
          {/* Technician Dashboard - Simplified */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="My Tasks"
              value="View Tasks"
              subtitle="Manage your assigned tasks"
              variant="info"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
            <MetricCard
              title="Activities"
              value="Log Activity"
              subtitle="Record your field activities"
              variant="default"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>

          {/* Employee Features */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Employee Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/attendance"
                className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900">Attendance</h3>
                </div>
                <p className="text-sm text-slate-600">Check in/out and view attendance history</p>
              </Link>
              <Link
                href="/reimbursement"
                className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900">Reimbursement</h3>
                </div>
                <p className="text-sm text-slate-600">Submit and track reimbursement requests</p>
              </Link>
              <Link
                href="/time-off"
                className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900">Time Off</h3>
                </div>
                <p className="text-sm text-slate-600">Request and manage time off</p>
              </Link>
              <Link
                href="/payslip"
                className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900">Payslip</h3>
                </div>
                <p className="text-sm text-slate-600">View and download your payslips</p>
              </Link>
            </div>
          </div>

          {/* Quick Links for Technician */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/technician/tasks"
              className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-2">My Tasks</h3>
              <p className="text-sm text-slate-600">View and manage your assigned tasks</p>
            </Link>
          </div>
        </>
      ) : isFinance || isHR ? (
        <>
          {/* Finance/HR Dashboard - Limited Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricCard
              title="Plan"
              value={data?.plan?.name || 'No Plan'}
              subtitle={data?.plan ? `${new Intl.NumberFormat('id-ID').format(data.plan.price_monthly)} ${data.plan.currency}/mo` : 'Contact admin'}
              variant="info"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              }
            />
            <MetricCard
              title="Features"
              value={Object.values(data?.features || {}).filter(Boolean).length}
              subtitle="Active features"
              variant="success"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
            />
          </div>

          {/* Employee Features */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Employee Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/attendance"
                className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900">Attendance</h3>
                </div>
                <p className="text-sm text-slate-600">Check in/out and view attendance history</p>
              </Link>
              <Link
                href="/reimbursement"
                className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900">Reimbursement</h3>
                </div>
                <p className="text-sm text-slate-600">Submit and track reimbursement requests</p>
              </Link>
              <Link
                href="/time-off"
                className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900">Time Off</h3>
                </div>
                <p className="text-sm text-slate-600">Request and manage time off</p>
              </Link>
              <Link
                href="/payslip"
                className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-slate-900">Payslip</h3>
                </div>
                <p className="text-sm text-slate-600">View and download your payslips</p>
              </Link>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Other Roles - Minimal Dashboard */}
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Dashboard</h3>
            <p className="text-sm text-slate-600">
              Welcome to your dashboard. Use the navigation menu to access available features.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

