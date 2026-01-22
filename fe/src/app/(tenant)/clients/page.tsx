'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useClientStore } from '@/stores/clientStore';
import { useCollectorStore } from '@/stores/collectorStore';
import { ClientTable, ClientFilters, ClientPagination, ClientFiltersForCollector } from '@/components/clients';
import { clientService, Client } from '@/lib/api/clientService';
import { useNotificationStore } from '@/stores/notificationStore';
import { useRole } from '@/lib/hooks/useRole';
import { useAuth } from '@/lib/hooks/useAuth';

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

  // Sync collector store date with clients page and fetch payments when date changes
  useEffect(() => {
    if (isTechnician) {
      const { selectedDate, fetchPaymentsForDate } = useCollectorStore.getState();
      fetchPaymentsForDate(selectedDate);
    }
  }, [isTechnician]);

  // Sync collector store date with clients page
  useEffect(() => {
    if (isTechnician) {
      const { selectedDate, fetchPaymentsForDate } = useCollectorStore.getState();
      fetchPaymentsForDate(selectedDate);
    }
  }, [isTechnician]);

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
        {!isTechnician && (
          <Link
            href="/clients/create"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client
          </Link>
        )}
      </div>

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


