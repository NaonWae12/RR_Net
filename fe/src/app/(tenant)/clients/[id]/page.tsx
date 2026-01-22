'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useClientStore } from '@/stores/clientStore';
import { clientService } from '@/lib/api/clientService';
import { ClientStatusBadge } from '@/components/clients';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';
import { useNotificationStore } from '@/stores/notificationStore';
import { useRole } from '@/lib/hooks/useRole';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { selectedClient: client, loading, error, fetchClient, clearSelectedClient } = useClientStore();
  const { showToast } = useNotificationStore();
  const { isTechnician } = useRole();
  const [statusLoading, setStatusLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchClient(id);
    }
    return () => clearSelectedClient();
  }, [id, fetchClient, clearSelectedClient]);

  const handleStatusChange = async (newStatus: string) => {
    if (!client) return;
    setStatusLoading(true);
    try {
      await clientService.updateStatus(client.id, newStatus);
      showToast({
        title: 'Status updated',
        description: `Client is now ${newStatus}`,
        variant: 'success',
      });
      fetchClient(id);
    } catch (err: any) {
      showToast({
        title: 'Failed to update status',
        description: err.response?.data?.error || 'An error occurred',
        variant: 'error',
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!client) return;
    if (!confirm('Are you sure you want to delete this client?')) return;

    setDeleteLoading(true);
    try {
      await clientService.deleteClient(client.id);
      showToast({
        title: 'Client deleted',
        variant: 'success',
      });
      router.push('/clients');
    } catch (err: any) {
      showToast({
        title: 'Failed to delete client',
        description: err.response?.data?.error || 'An error occurred',
        variant: 'error',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Client not found</p>
        <Link href="/clients" className="text-indigo-600 hover:text-indigo-700 hover:underline mt-2 inline-block">
          Back to clients
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/clients" className="text-slate-500 hover:text-indigo-600">
              Clients
            </Link>
            <span className="text-slate-500">/</span>
            <span className="text-slate-500">{client.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
            <ClientStatusBadge status={client.status} />
          </div>
        </div>
        {!isTechnician && (
          <div className="flex items-center gap-2">
            <Link
              href={`/clients/${client.id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {deleteLoading ? <LoadingSpinner size={16} /> : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              Delete
            </button>
          </div>
        )}
        {isTechnician && (
          <div className="flex items-center gap-2">
            {/* Technician: Read-only view, no collector-specific actions */}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {!isTechnician && (
        <div className="flex flex-wrap gap-2">
          {client.status === 'active' && (
            <button
              onClick={() => handleStatusChange('isolir')}
              disabled={statusLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50"
            >
              {statusLoading ? <LoadingSpinner size={14} /> : null}
              Isolate Client
            </button>
          )}
          {client.status === 'isolir' && (
            <button
              onClick={() => handleStatusChange('active')}
              disabled={statusLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
            >
              {statusLoading ? <LoadingSpinner size={14} /> : null}
              Activate Client
            </button>
          )}
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-slate-500">Name</dt>
              <dd className="text-sm text-slate-900 mt-1">{client.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Email</dt>
              <dd className="text-sm text-slate-900 mt-1">{client.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Phone</dt>
              <dd className="text-sm text-slate-900 mt-1">{client.phone}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Address</dt>
              <dd className="text-sm text-slate-900 mt-1">{client.address}</dd>
            </div>
            {client.category && (
              <div>
                <dt className="text-sm font-medium text-slate-500">Category</dt>
                <dd className="text-sm text-slate-900 mt-1">{client.category}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Service Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Service Information</h2>
          <dl className="space-y-4">
            {client.pppoe_username && (
              <div>
                <dt className="text-sm font-medium text-slate-500">PPPoE Username</dt>
                <dd className="text-sm text-slate-900 mt-1 font-mono">{client.pppoe_username}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-slate-500">Package</dt>
              <dd className="text-sm text-slate-900 mt-1">{client.package_name || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Monthly Fee</dt>
              <dd className="text-sm text-slate-900 mt-1">
                {client.monthly_fee
                  ? `Rp ${client.monthly_fee.toLocaleString('id-ID')}`
                  : '-'}
              </dd>
            </div>
            {client.billing_cycle_day && (
              <div>
                <dt className="text-sm font-medium text-slate-500">Billing Day</dt>
                <dd className="text-sm text-slate-900 mt-1">Day {client.billing_cycle_day}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Notes */}
        {client.notes && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Notes</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Metadata</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <dt className="text-sm font-medium text-slate-500">ID</dt>
              <dd className="text-slate-900 mt-1 font-mono text-xs">{client.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Created</dt>
              <dd className="text-sm text-slate-900 mt-1">
                {new Date(client.created_at).toLocaleDateString('id-ID')}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Updated</dt>
              <dd className="text-sm text-slate-900 mt-1">
                {new Date(client.updated_at).toLocaleDateString('id-ID')}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-500">Status</dt>
              <dd className="mt-1">
                <ClientStatusBadge status={client.status} size="sm" />
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}


