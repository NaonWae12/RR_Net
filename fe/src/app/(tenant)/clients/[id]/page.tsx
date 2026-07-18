'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useClientStore } from '@/stores/clientStore';
import clientService, { PackageChangeLog } from '@/lib/api/clientService';
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
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [packageHistory, setPackageHistory] = useState<PackageChangeLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    if (id) {
      fetchClient(id);
      // Fetch package change history
      setHistoryLoading(true);
      clientService.getPackageHistory(id)
        .then(setPackageHistory)
        .catch(() => setPackageHistory([]))
        .finally(() => setHistoryLoading(false));
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
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col gap-4">
        <nav className="flex items-center gap-2 text-sm font-medium">
          <Link href="/clients" className="text-slate-500 hover:text-indigo-600 transition-colors">
            Clients
          </Link>
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-900">{client.name}</span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shadow-slate-100/50">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner ${
              client.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 
              client.status === 'isolir' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
            }`}>
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{client.name}</h1>
                <ClientStatusBadge status={client.status} />
              </div>
              <p className="text-slate-500 font-medium flex items-center gap-2">
                <span className="px-2 py-0.5 bg-slate-100 rounded text-xs uppercase tracking-wider font-bold">{client.client_code}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span>{client.category?.toUpperCase() || 'REGULAR'} CUSTOMER</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isTechnician && (
              <>
                <Link
                  href={`/clients/${client.id}/edit`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Profile
                </Link>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-all active:scale-95 shadow-sm disabled:opacity-50"
                >
                  {deleteLoading ? <LoadingSpinner size={16} /> : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Bulanan</p>
          <p className="text-2xl font-black text-slate-900">
            {(() => {
              const base = client.monthly_fee || 0;
              let discount = 0;
              if (client.discount_type === 'percent') {
                discount = base * (client.discount_value / 100);
              } else {
                discount = client.discount_value || 0;
              }
              const total = Math.max(0, base - discount);
              return `Rp ${total.toLocaleString('id-ID')}`;
            })()}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Jatuh Tempo Bulanan</p>
          <p className="text-2xl font-black text-indigo-600">
            Tanggal {client.payment_due_day || '-'}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status Pembayaran</p>
          <div className="mt-1">
            {client.payment_status === 'overdue' ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-600">Terlambat</span>
            ) : client.payment_status === 'pending' ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-600">Belum Bayar</span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-600">Lunas</span>
            )}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tgl Join</p>
          <p className="text-2xl font-black text-slate-900">
            {new Date(client.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Client & Service Info */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Actions Bar */}
          {!isTechnician && (
            <div className="bg-slate-900 p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-slate-200">
              <span className="text-white text-sm font-medium ml-2">Quick Management :</span>
              <div className="flex gap-2">
                {client.status === 'active' && (
                  <button
                    onClick={() => handleStatusChange('isolir')}
                    disabled={statusLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-amber-400 bg-white/10 hover:bg-white/20 rounded-xl transition-all disabled:opacity-50"
                  >
                    {statusLoading ? <LoadingSpinner size={14} /> : null}
                    Isolate Account
                  </button>
                )}
                {client.status === 'isolir' && (
                  <button
                    onClick={() => handleStatusChange('active')}
                    disabled={statusLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-emerald-400 bg-white/10 hover:bg-white/20 rounded-xl transition-all disabled:opacity-50"
                  >
                    {statusLoading ? <LoadingSpinner size={14} /> : null}
                    Activate Account
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Detailed Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                Contact Information
              </h3>
              <dl className="space-y-4">
                <div className="flex flex-col">
                  <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</dt>
                  <dd className="text-slate-900 font-medium">{client.email || '-'}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone Number</dt>
                  <dd className="text-slate-900 font-medium">{client.phone || '-'}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">Installation Address</dt>
                  <dd className="text-slate-900 font-medium leading-relaxed">{client.address || '-'}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 16.5c0 .38-.21.71-.53.88l-7.97 4.44c-.31.17-.69.17-1 .01l-7.97-4.44c-.32-.17-.53-.5-.53-.88v-9c0-.38.21-.71.53-.88l7.97-4.44c.31-.17.69-.17 1-.01l7.97 4.44c.32.17.53.5.53.88v9z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                Service Details
              </h3>
              <dl className="space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <dt className="text-sm font-bold text-slate-500 uppercase">Connection</dt>
                  <dd className="text-sm font-black text-indigo-600 text-right">
                    {client.connection_type === 'none' ? (
                      <>
                        <span className="block">Billing Only</span>
                        <span className="text-[10px] font-medium text-slate-400">(Tanpa Koneksi)</span>
                      </>
                    ) : (
                      client.connection_type?.toUpperCase() || 'PPPoE'
                    )}
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">Package / Plan</dt>
                  <dd className="text-slate-900 font-black">{client.package_name || client.service_plan || '-'}</dd>
                </div>
                {client.connection_type !== 'none' && (
                  <div className="flex flex-col gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center">
                      <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {client.connection_type === 'hotspot' ? 'Hotspot Identity' : 'PPPoE Identity'}
                      </dt>
                      <button 
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        {showPassword ? (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                            </svg>
                            Hide
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Show
                          </>
                        )}
                      </button>
                    </div>
                    
                    <div className="space-y-3 mt-2">
                      <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Username / Code</label>
                        <div className="flex items-center justify-between group">
                          <span className="text-sm font-black text-slate-900 font-mono italic">
                            {client.pppoe_username || 'Belum diatur'}
                          </span>
                          {client.pppoe_username && (
                            <button 
                              onClick={() => handleCopy(client.pppoe_username!, 'user')}
                              className="p-1 hover:bg-white rounded transition-colors text-slate-400 hover:text-indigo-600"
                            >
                              {copiedField === 'user' ? (
                                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col border-t border-slate-200/50 pt-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Password</label>
                        <div className="flex items-center justify-between group">
                          <span className="text-sm font-black text-slate-900 font-mono">
                            {showPassword ? (client.pppoe_password || '********') : '••••••••'}
                          </span>
                          <div className="flex items-center gap-1">
                            {client.pppoe_password && (
                              <button 
                                onClick={() => handleCopy(client.pppoe_password!, 'pass')}
                                className="p-1 hover:bg-white rounded transition-colors text-slate-400 hover:text-indigo-600"
                              >
                                {copiedField === 'pass' ? (
                                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {(client.connection_type === 'hotspot' || client.category === 'lite') && (
                  <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                    <dt className="text-xs font-bold text-indigo-400 uppercase">
                      {client.category === 'lite' ? 'Jumlah Device' : 'Device Limit'}
                    </dt>
                    <dd className="text-sm font-black text-indigo-700">{client.device_count || '1'} Device</dd>
                  </div>
                )}
                {client.router_name && (
                  <div className="flex flex-col border-t border-slate-100 pt-3">
                    <dt className="text-xs font-bold text-slate-400 uppercase tracking-wider">Router / Mikrotik</dt>
                    <dd className="text-slate-900 font-medium">{client.router_name}</dd>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                  {client.ip_address && (
                    <div className="flex flex-col">
                      <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IP Address</dt>
                      <dd className="text-sm font-black text-slate-900 font-mono">{client.ip_address}</dd>
                    </div>
                  )}
                  {client.mac_address && (
                    <div className="flex flex-col border-l border-slate-100 pl-4">
                      <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MAC Address</dt>
                      <dd className="text-sm font-black text-slate-900 font-mono">{client.mac_address}</dd>
                    </div>
                  )}
                </div>
                {client.connection_type === 'pppoe' && client.category !== 'lite' && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-slate-100">
                    <div className="flex flex-col">
                      <dt className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Local IP</dt>
                      <dd className="text-sm font-black text-slate-700 font-mono italic">{client.pppoe_local_address || '---'}</dd>
                    </div>
                    <div className="flex flex-col border-l border-slate-200 pl-4">
                      <dt className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Remote IP</dt>
                      <dd className="text-sm font-black text-slate-700 font-mono italic">{client.pppoe_remote_address || '---'}</dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* Notes Card */}
          {client.notes && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden">
               <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Administrator Notes
              </h3>
              <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 leading-relaxed border border-slate-100 italic">
                {client.notes}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Billing & Metadata */}
        <div className="space-y-6">
          {/* Billing & Tempo Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
              </svg>
            </div>
            
            <h3 className="text-xl font-black mb-6 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Billing & Tempo
            </h3>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 mb-5">
              <div className="flex flex-col mb-4">
                <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest leading-none mb-2">Aturan Jatuh Tempo</span>
                <span className="text-2xl font-black">Tanggal {client.payment_due_day || '-'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest leading-none mb-2">Metode Penentuan</span>
                <span className="text-lg font-bold capitalize">{client.payment_tempo_option || 'Default'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-indigo-100 font-medium">
                  {client.category === 'lite'
                    ? `Biaya / Device (×${client.device_count || 1})`
                    : 'Biaya Dasar'}
                </span>
                <span className="font-bold">Rp {client.monthly_fee?.toLocaleString('id-ID') || '0'}</span>
              </div>
              {client.discount_value && client.discount_value > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-emerald-300 font-medium whitespace-nowrap">Diskon 
                    {client.discount_type === 'percent' ? ` (${client.discount_value}%)` : ''}
                  </span>
                  <span className="font-bold text-emerald-300">
                    - Rp {(() => {
                      if (client.discount_type === 'percent') {
                        return ((client.monthly_fee || 0) * (client.discount_value || 0) / 100).toLocaleString('id-ID');
                      }
                      return client.discount_value?.toLocaleString('id-ID');
                    })()}
                  </span>
                </div>
              )}
              <div className="pt-3 border-t border-white/20 flex justify-between items-center">
                <span className="text-lg font-bold">Total Bulanan</span>
                <span className="text-2xl font-black">
                  {(() => {
                    const base = client.monthly_fee || 0;
                    let discount = 0;
                    if (client.discount_type === 'percent') {
                      discount = base * ((client.discount_value || 0) / 100);
                    } else {
                      discount = client.discount_value || 0;
                    }
                    return `Rp ${Math.max(0, base - discount).toLocaleString('id-ID')}`;
                  })()}
                </span>
              </div>
            </div>
            
            <p className="mt-6 text-[10px] text-indigo-200 leading-tight italic opacity-80">
              *Data ini adalah Master Data Tempo. Tanggal jatuh tempo invoice akan mengikuti aturan di atas saat terbit otomatis.
            </p>
          </div>

          {/* System Info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden">
            <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">System Information</h3>
            <dl className="space-y-4">
              <div className="flex justify-between items-center">
                <dt className="text-xs font-bold text-slate-400 uppercase">Registered</dt>
                <dd className="text-sm text-slate-900 font-medium">{new Date(client.created_at).toLocaleDateString('id-ID')}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-xs font-bold text-slate-400 uppercase">Last Sync</dt>
                <dd className="text-sm text-slate-900 font-medium">{new Date(client.updated_at).toLocaleDateString('id-ID')}</dd>
              </div>
              {client.created_by_name && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <dt className="text-xs font-bold text-slate-400 uppercase">Added By</dt>
                  <dd className="text-sm font-bold text-indigo-600">{client.created_by_name}</dd>
                </div>
              )}
              <div className="flex flex-col pt-2 bg-slate-50 p-3 rounded-xl">
                 <dt className="text-[10px] font-bold text-slate-400 uppercase mb-1">Database Resource ID</dt>
                 <dd className="text-[10px] font-mono text-slate-500 break-all">{client.id}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Package Change History */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-50 rounded-xl">
            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Riwayat Perubahan Paket</h2>
            <p className="text-xs text-slate-500">History upgrade & downgrade paket pelanggan</p>
          </div>
        </div>
        <span className="text-xs font-semibold bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full">
          {packageHistory.length} entri
        </span>
      </div>

      {historyLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size={28} />
        </div>
      ) : packageHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
          </svg>
          <p className="text-sm font-medium">Belum ada riwayat perubahan paket</p>
          <p className="text-xs mt-1">History akan muncul saat paket pelanggan diubah</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {packageHistory.map((log) => {
            const badge =
              log.change_type === 'upgrade'
                ? { label: 'Upgrade', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' }
                : log.change_type === 'downgrade'
                ? { label: 'Downgrade', bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' }
                : { label: 'Perubahan', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' };

            const feeChange = log.new_monthly_fee - log.old_monthly_fee;

            return (
              <div key={log.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${badge.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(log.created_at).toLocaleString('id-ID', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        {log.changed_by_name && (
                          <span className="text-xs text-indigo-600 font-medium">oleh {log.changed_by_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700 flex-wrap">
                        <span className="font-medium text-slate-500">{log.old_package_name ?? 'Tanpa paket'}</span>
                        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="font-semibold text-slate-900">{log.new_package_name ?? 'Tanpa paket'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900">
                      Rp {log.new_monthly_fee.toLocaleString('id-ID')}
                    </p>
                    {feeChange !== 0 && (
                      <p className={`text-xs font-semibold mt-0.5 ${feeChange > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {feeChange > 0 ? '+' : ''}Rp {feeChange.toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
  );
}


