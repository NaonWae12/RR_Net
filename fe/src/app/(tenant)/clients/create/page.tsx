'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClientForm } from '@/components/clients/ClientForm';
import { clientService, CreateClientRequest, UpdateClientRequest } from '@/lib/api/clientService';
import { useNotificationStore } from '@/stores/notificationStore';

export default function CreateClientPage() {
  const router = useRouter();
  const { showToast } = useNotificationStore();

  const handleSubmit = async (data: CreateClientRequest | UpdateClientRequest) => {
    try {
      const client = await clientService.createClient(data as CreateClientRequest);
      showToast({
        title: 'Client created',
        description: `${client.name} has been created successfully`,
        variant: 'success',
      });
      router.push(`/clients/${client.id}`);
    } catch (error: any) {
      showToast({
        title: 'Failed to create client',
        description: error.response?.data?.error || 'An error occurred',
        variant: 'error',
      });
      throw error;
    }
  };

  const handleCancel = () => {
    router.push('/clients');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/clients" className="hover:text-indigo-600">
            Clients
          </Link>
          <span>/</span>
          <span>New Client</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Create New Client</h1>
        <p className="text-slate-500 mt-1">
          Add a new subscriber to your network
        </p>
      </div>

      {/* Form */}
      <ClientForm onSubmit={handleSubmit} onCancel={handleCancel} />
    </div>
  );
}


