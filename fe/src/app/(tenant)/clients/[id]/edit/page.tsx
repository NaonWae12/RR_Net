'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ClientForm } from '@/components/clients/ClientForm';
import { clientService, UpdateClientRequest } from '@/lib/api/clientService';
import { useClientStore } from '@/stores/clientStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';

export default function EditClientPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const { selectedClient: client, loading, error, fetchClient, clearSelectedClient } = useClientStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    if (id) {
      fetchClient(id);
    }
    return () => clearSelectedClient();
  }, [id, fetchClient, clearSelectedClient]);

  const handleSubmit = async (data: UpdateClientRequest) => {
    try {
      const updated = await clientService.updateClient(id, data);
      showToast({
        title: 'Client updated',
        description: `${updated.name} has been updated successfully`,
        variant: 'success',
      });
      router.push(`/clients/${id}`);
    } catch (error: any) {
      showToast({
        title: 'Failed to update client',
        description: error.response?.data?.error || 'An error occurred',
        variant: 'error',
      });
      throw error;
    }
  };

  const handleCancel = () => {
    router.push(`/clients/${id}`);
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
        {error}
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Client not found</p>
        <Link href="/clients" className="text-indigo-600 hover:underline mt-2 inline-block">
          Back to clients
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/clients" className="hover:text-indigo-600">
            Clients
          </Link>
          <span>/</span>
          <Link href={`/clients/${id}`} className="hover:text-indigo-600">
            {client.name}
          </Link>
          <span>/</span>
          <span>Edit</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Edit Client</h1>
        <p className="text-slate-500 mt-1">
          Update client information
        </p>
      </div>

      {/* Form */}
      <ClientForm
        client={client}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}


