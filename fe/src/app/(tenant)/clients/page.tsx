'use client';

import React, { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useClientStore } from '@/stores/clientStore';
import { ClientTable, ClientFilters, ClientPagination } from '@/components/clients';
import { clientService, Client } from '@/lib/api/clientService';
import { useNotificationStore } from '@/stores/notificationStore';

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

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    fetchClients({ ...newFilters, page: 1 });
  }, [setFilters, fetchClients]);

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
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-500 mt-1">
            Manage your subscriber clients
          </p>
        </div>
        <Link
          href="/clients/create"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Client
        </Link>
      </div>

      {/* Filters */}
      <ClientFilters filters={filters} onFilterChange={handleFilterChange} />

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      <ClientTable
        clients={clients}
        loading={loading}
        onStatusChange={handleStatusChange}
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


