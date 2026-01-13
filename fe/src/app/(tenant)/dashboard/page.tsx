'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { MetricCard, PlanCard, LimitsCard, FeaturesCard, QuickActions } from '@/components/dashboard';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, tenant } = useAuthStore();
  const { data, loading, error, fetchDashboardData, lastUpdated } = useDashboardStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchDashboardData();
  }, [isAuthenticated, router, fetchDashboardData]);

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

  return (
    <div className="space-y-6">
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
          {error}
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
    </div>
  );
}

