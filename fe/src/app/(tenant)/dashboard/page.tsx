'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useRole } from '@/lib/hooks/useRole';
import { MetricCard, LimitsCard, QuickActions } from '@/components/dashboard';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { clearRoleContext } from '@/lib/utils/roleContext';

import { useTechnicianStore } from '@/stores/technicianStore';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, tenant, ready: authReady } = useAuthStore();
  const { data, loading: dashboardLoading, error, fetchDashboardData, isFullData, lastUpdated } = useDashboardStore();
  const { summary: techSummary, fetchTaskSummary, loading: techLoading } = useTechnicianStore();
  const { role, originalRole, switched, roleContext, isAdmin, isTechnician, userId } = useRole();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Fetch dashboard data for Admin/Owner
    if (isAdmin && authReady) {
      if (!isFullData && !dashboardLoading) {
        fetchDashboardData();
      }
    } else if (isAdmin) {
      const unsubscribe = useAuthStore.subscribe((state) => {
        if (state.ready && !dashboardLoading && !isFullData) {
          fetchDashboardData();
          unsubscribe();
        }
      });
      return () => unsubscribe();
    }

    // Fetch technician summary if role is technician
    if (isTechnician && authReady && userId) {
      fetchTaskSummary(userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authReady, router, isAdmin, isTechnician, userId, fetchDashboardData, fetchTaskSummary]);

  const loading = dashboardLoading || (isTechnician && techLoading && !techSummary);

  if (!isAuthenticated) {
    return null;
  }

  if (isAdmin && loading && !data) {
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

      {/* Conditional Content Based on Role */}
      {isAdmin ? (
        <>
          {/* Admin/Owner Full Dashboard */}
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
              href="/subscription"
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
            <div className="lg:col-span-2">
              <QuickActions />
            </div>
            <div>
              <LimitsCard
                limits={data?.limits || {}}
                clientStats={data?.clientStats}
                resourceUsage={data?.resourceUsage}
              />
            </div>
          </div>

          {/* Employee Features for Admin */}
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
          {/* My Workspace for Other Roles (HR, Finance, Technician, etc) */}
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-[#0f172a]">
              Welcome back, {user?.name || 'User'}! 👋
            </h1>
            <p className="text-[#64748b] text-base">
              {isTechnician 
                ? "Here's your work summary and personal work tools." 
                : "Your personal workspace for attendance, reimbursements, and more."}
            </p>
          </div>

          {isTechnician && techSummary && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#0f172a]">Task Overview</h2>
                <Link href="/technician/tasks" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">View all tasks →</Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Tasks</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{techSummary.total_tasks}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{techSummary.in_progress_tasks}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{techSummary.pending_tasks}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completed</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{techSummary.completed_tasks}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#0f172a]">Quick Access</h2>
              <span className="text-sm text-[#94a3b8]">Manage your personal tasks</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <Link
                href="/attendance"
                className="group bg-[#ffffff] border border-[#e2e8f0] rounded-xl p-6 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:border-[#4f46e5] transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-[#eef2ff] rounded-lg group-hover:bg-[#4f46e5] transition-colors">
                    <svg className="w-6 h-6 text-[#4f46e5] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-[#0f172a] group-hover:text-[#4f46e5] transition-colors">Attendance</h3>
                </div>
                <p className="text-sm text-[#64748b]">Check in/out and view your attendance history</p>
              </Link>

              <Link
                href="/reimbursement"
                className="group bg-[#ffffff] border border-[#e2e8f0] rounded-xl p-6 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:border-[#10b981] transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-[#ecfdf5] rounded-lg group-hover:bg-[#10b981] transition-colors">
                    <svg className="w-6 h-6 text-[#10b981] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-[#0f172a] group-hover:text-[#10b981] transition-colors">Reimbursement</h3>
                </div>
                <p className="text-sm text-[#64748b]">Submit and track your reimbursement requests</p>
              </Link>

              <Link
                href="/time-off"
                className="group bg-[#ffffff] border border-[#e2e8f0] rounded-xl p-6 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:border-[#f59e0b] transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-[#fffbeb] rounded-lg group-hover:bg-[#f59e0b] transition-colors">
                    <svg className="w-6 h-6 text-[#f59e0b] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-[#0f172a] group-hover:text-[#f59e0b] transition-colors">Time Off</h3>
                </div>
                <p className="text-sm text-[#64748b]">Request and manage your leave applications</p>
              </Link>

              <Link
                href="/payslip"
                className="group bg-[#ffffff] border border-[#e2e8f0] rounded-xl p-6 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:border-[#0f172a] transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-[#f8fafc] rounded-lg group-hover:bg-[#0f172a] transition-colors">
                    <svg className="w-6 h-6 text-[#0f172a] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-[#0f172a] group-hover:text-[#0f172a] transition-colors">Payslip</h3>
                </div>
                <p className="text-sm text-[#64748b]">View and download your monthly payslips</p>
              </Link>
            </div>
          </div>

          <div className="bg-gradient-to-r from-[#eef2ff] to-[#f8fafc] border border-[#e2e8f0] rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#4f46e5] rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#0f172a] mb-1">Need Help?</h3>
                <p className="text-sm text-[#64748b] mb-3">
                  If you have questions about attendance, reimbursements, or payroll, please contact the HR department.
                </p>
                <Button className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold">
                  Contact HR
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
