'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useClientStore } from '@/stores/clientStore';
import { useCollectorStore } from '@/stores/collectorStore';
import { ClientTable, ClientFilters, ClientPagination, ClientFiltersForCollector } from '@/components/clients';
import { clientService, Client, ClientStats } from '@/lib/api/clientService';
import { useNotificationStore } from '@/stores/notificationStore';
import { useRole } from '@/lib/hooks/useRole';
import { useAuth } from '@/lib/hooks/useAuth';
import { Sparkles } from 'lucide-react';

export default function ClientsPage() {
  const {
    clients,
    total,
    page,
    pageSize,
    totalPages,
    filters,
    loading,
    error,
    fetchClients,
    setFilters,
    setPage,
  } = useClientStore();

  const { showToast } = useNotificationStore();
  const { isTechnician } = useRole();
  const { isAuthenticated } = useAuth();
  const hasFetchedRef = useRef(false);
  const lastRoleRef = useRef<string | null>(null);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !isTechnician) {
      setStatsLoading(true);
      clientService.getStats()
        .then(setStats)
        .catch(console.error)
        .finally(() => setStatsLoading(false));
    }
  }, [isAuthenticated, isTechnician, clients]);

  useEffect(() => {
    // Only fetch if authenticated
    if (!isAuthenticated) {
      hasFetchedRef.current = false;
      return;
    }
    
    // Only fetch once on mount or when role changes
    // Filter changes are handled by handleFilterChange callback
    const currentRole = isTechnician ? 'technician' : 'other';
    const roleChanged = lastRoleRef.current !== null && lastRoleRef.current !== currentRole;
    
    // Only fetch if we haven't fetched yet, or if role changed
    if (!hasFetchedRef.current || roleChanged) {
      hasFetchedRef.current = true;
      lastRoleRef.current = currentRole;
      
      // For technician: only fetch active clients
      if (isTechnician) {
        const activeFilters = { status: 'active' as string, page: 1, page_size: 10 };
        setFilters(activeFilters);
        fetchClients(activeFilters);
      } else {
        const defaultFilters = { page: 1, page_size: 10 };
        fetchClients(defaultFilters);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isTechnician]); // Only depend on auth and role

  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    // For technician: always force status to 'active'
    // Preserve all filter values including group_id
    const filtersToUse: typeof filters = isTechnician 
      ? { 
          ...newFilters, 
          status: 'active' as string, 
          page: 1, // Always reset to page 1 when filter changes
        }
      : { 
          ...newFilters, 
          page: 1, // Always reset to page 1 when filter changes
        };
    
    // Explicitly preserve group_id if it exists in newFilters
    if (newFilters.group_id !== undefined) {
      filtersToUse.group_id = newFilters.group_id;
    }
    
    setFilters(filtersToUse);
    fetchClients(filtersToUse);
  }, [setFilters, fetchClients, isTechnician]);

  // Sync collector store data when technician is authenticated
  const { user } = useAuth();
  const selectedDate = useCollectorStore(state => state.selectedDate);
  useEffect(() => {
    if (isTechnician && isAuthenticated && user?.id) {
      const { fetchPaymentsForDate, fetchAssignments } = useCollectorStore.getState();
      fetchPaymentsForDate(selectedDate);
      fetchAssignments(selectedDate, user.id);
    }
  }, [isTechnician, isAuthenticated, user?.id, selectedDate]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    fetchClients({ ...filters, page: newPage });
  }, [setPage, fetchClients, filters]);

  const handleStatusChange = useCallback(async (client: Client, status: string) => {
    try {
      await clientService.updateStatus(client.id, status);
      showToast({
        title: 'Status updated',
        description: `${client.name} is now ${status}`,
        variant: 'success',
      });
      fetchClients();
    } catch (err: any) {
      showToast({
        title: 'Failed to update status',
        description: err.response?.data?.error || 'An error occurred',
        variant: 'error',
      });
    }
  }, [fetchClients, showToast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isTechnician ? "Clients" : "Clients"}
          </h1>
          <p className="text-slate-500 mt-1">
            {isTechnician
              ? "View client information (read-only)"
              : "Manage your subscriber clients"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isTechnician && (
            <Link
              href="/clients/migration"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-all shadow-sm hover:shadow-md"
            >
              <Sparkles className="w-4 h-4 fill-indigo-500" />
              AI Migration
            </Link>
          )}
          <Link
            href="/clients/create"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      {!isTechnician && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.04] pointer-events-none group-hover:scale-110 transition-transform duration-300">
              <svg className="w-16 h-16 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pelanggan</p>
            <p className="text-3xl font-black text-slate-900 mt-2">{stats.total}</p>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Pelanggan aktif dalam sistem
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.04] pointer-events-none group-hover:scale-110 transition-transform duration-300">
              <svg className="w-16 h-16 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sisa Kuota Limit</p>
            <p className="text-3xl font-black text-emerald-600 mt-2">
              {stats.unlimited ? '∞' : stats.remaining}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Kuota pendaftaran client baru
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.04] pointer-events-none group-hover:scale-110 transition-transform duration-300">
              <svg className="w-16 h-16 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Batas Maksimal Plan</p>
            <p className="text-3xl font-black text-slate-900 mt-2">
              {stats.unlimited ? 'Tak Terbatas' : stats.limit}
            </p>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              Berdasarkan paket langganan ERP Anda
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      {isTechnician ? (
        <ClientFiltersForCollector filters={filters} onFilterChange={handleFilterChange} />
      ) : (
        <ClientFilters filters={filters} onFilterChange={handleFilterChange} />
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Table */}
      <ClientTable
        clients={clients}
        loading={loading}
        onStatusChange={handleStatusChange}
        isCollectorMode={isTechnician}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Pagination */}
      <ClientPagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />
    </div>
  );
}


