'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Client } from '@/lib/api/clientService';
import { ClientStatusBadge } from './ClientStatusBadge';
import clientGroupService, { ClientGroup } from '@/lib/api/clientGroupService';
import { CollectorActions } from './CollectorActions';
import { useCollectorStore } from '@/stores/collectorStore';
import { InvoiceStatusBadge } from '@/components/billing/InvoiceStatusBadge';
import { InvoiceStatus } from '@/lib/api/types';
import { format, isAfter, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';

type ColumnKey = 'client' | 'contact' | 'package' | 'group' | 'status' | 'payment_status' | 'due_date' | 'total' | 'actions';
const COLUMNS_STORAGE_KEY = 'clients_table_columns_v1';

import { ClientPaymentHistoryModal } from "./ClientPaymentHistoryModal";
import { ClockIcon } from "@heroicons/react/24/outline";

interface ClientTableProps {
  clients: Client[];
  loading?: boolean;
  onStatusChange?: (client: Client, status: string) => void;
  isCollectorMode?: boolean;
  filters?: any;
  onFilterChange?: (filters: any) => void;
}


export function ClientTable({ clients, loading, onStatusChange, isCollectorMode = false, filters, onFilterChange }: ClientTableProps) {
  const { assignments, paidFullClients, loading: collectorLoading, partialPayments } = useCollectorStore();
  const [selectedHistoryClient, setSelectedHistoryClient] = useState<{ id: string; name: string } | null>(null);
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [auxLoading, setAuxLoading] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    client: true,
    contact: true,
    package: true,
    group: true,
    status: true,
    payment_status: true,
    due_date: true,
    total: true,
    actions: true,
  });

  // Group filter state for collector mode (must be before conditional returns)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [availableGroups, setAvailableGroups] = useState<ClientGroup[]>([]);

  // Load column preferences
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(COLUMNS_STORAGE_KEY) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<ColumnKey, boolean>>;
      setVisibleColumns((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore
    }
  }, []);

  const setColumn = (key: ColumnKey, value: boolean) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Fetch all groups to show group name
  useEffect(() => {
    let alive = true;
    (async () => {
      setAuxLoading(true);
      try {
        const groupList = await clientGroupService.list();
        if (!alive) return;
        setGroups(groupList);
      } catch {
        // ignore error
      } finally {
        if (alive) setAuxLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load groups for collector mode filter
  useEffect(() => {
    if (isCollectorMode && onFilterChange) {
      let alive = true;
      (async () => {
        try {
          const groupList = await clientGroupService.list();
          if (!alive) return;
          setAvailableGroups(groupList);
        } catch {
          // ignore error
        }
      })();
      return () => {
        alive = false;
      };
    }
  }, [isCollectorMode, onFilterChange]);

  // Sync selectedGroupId with filters.group_id (must be before conditional returns)
  useEffect(() => {
    const currentGroupId = filters?.group_id || '';
    // Only update if different to avoid unnecessary re-renders
    if (currentGroupId !== selectedGroupId) {
      setSelectedGroupId(currentGroupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.group_id]); // Only depend on filters.group_id, not selectedGroupId to avoid infinite loop
  
  // Initialize selectedGroupId from filters on mount
  useEffect(() => {
    if (filters?.group_id && !selectedGroupId) {
      setSelectedGroupId(filters.group_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Calculate total billing for a client
  const calculateTotal = (client: Client): number => {
    // Backend already provides monthly_fee as the base price (correctly calculated during creation/update)
    const basePrice = client.monthly_fee || 0;

    // Apply discount if exists
    if (client.discount_type && client.discount_value) {
      if (client.discount_type === 'percent') {
        return basePrice - (basePrice * client.discount_value / 100);
      } else {
        return Math.max(0, basePrice - client.discount_value);
      }
    }

    return basePrice;
  };

  const getGroupName = (groupId?: string | null) => {
    if (!groupId) return '-';
    return groups.find((g) => g.id === groupId)?.name || '-';
  };

  if (loading || auxLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-slate-100 border-b border-slate-200" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b border-slate-100 flex items-center px-4 gap-4">
              <div className="h-4 bg-slate-200 rounded w-1/5" />
              <div className="h-4 bg-slate-200 rounded w-1/5" />
              <div className="h-4 bg-slate-200 rounded w-1/6" />
              <div className="h-4 bg-slate-200 rounded w-1/6" />
              <div className="h-4 bg-slate-200 rounded w-1/6" />
              <div className="h-4 bg-slate-200 rounded w-1/6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <svg
          className="mx-auto h-12 w-12 text-slate-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <h3 className="mt-4 text-sm font-medium text-slate-900">No clients found</h3>
        <p className="mt-1 text-sm text-slate-500">
          Get started by creating a new client.
        </p>
        <Link
          href="/clients/create"
          className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          Add Client
        </Link>
      </div>
    );
  }

  const handleGroupFilterChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    if (onFilterChange) {
      // Always pass current filters and update group_id
      // Use empty string to clear filter, undefined to remove it from params
      const updatedFilters = {
        ...(filters || {}),
        group_id: groupId ? groupId : undefined, // Remove group_id if empty string
        page: 1, // Reset to first page when filter changes
      };
      onFilterChange(updatedFilters);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white rounded-t-xl">
        {/* Left side: Group filter for collector mode only */}
        {isCollectorMode && (
          <div className="flex items-center gap-2">
            <select
              value={selectedGroupId}
              onChange={(e) => handleGroupFilterChange(e.target.value)}
              className="px-3 py-1.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="" className="text-slate-900 bg-white">All Groups</option>
              {availableGroups.map((group) => (
                <option key={group.id} value={group.id} className="text-slate-900 bg-white">
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {/* Right side: Columns button (always on the right) */}
        <div className={isCollectorMode ? '' : 'ml-auto'}>
          <details className="relative">
            <summary className="list-none cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <span className="text-slate-700">Columns</span>
              <svg className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl p-3 z-50">
              <div className="space-y-2.5 text-sm text-slate-900">
                {(
                  [
                    ['client', 'Client'],
                    ['contact', 'Contact'],
                    ['package', 'Package'],
                    ['group', 'Group'],
                    ['status', 'Status'],
                    ['payment_status', 'Payment Status'],
                    ['due_date', 'Due Date'],
                    ['total', 'Total Tagihan'],
                  ] as Array<[ColumnKey, string]>
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group/item text-slate-900">
                    <input
                      type="checkbox"
                      checked={!!visibleColumns[key]}
                      onChange={(e) => setColumn(key, e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-slate-700 group-hover/item:text-slate-900 transition-colors">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>
      <div className="overflow-x-auto rounded-b-xl">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {visibleColumns.client && (
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Client
                </th>
              )}
              {visibleColumns.contact && (
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Contact
                </th>
              )}
              {visibleColumns.package && (
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Package
                </th>
              )}
              {visibleColumns.group && (
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Group
                </th>
              )}
              {visibleColumns.status && (
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
              )}
              {visibleColumns.payment_status && (
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Payment Status
                </th>
              )}
              {visibleColumns.due_date && (
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Due Date
                </th>
              )}
              {visibleColumns.total && (
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Total Tagihan
                </th>
              )}
              {visibleColumns.actions && (
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {clients.map((client) => (
              <tr
                key={client.id}
                className="hover:bg-slate-50 transition-colors border-b border-slate-200"
              >
                {visibleColumns.client && (
                  <td className="px-4 py-4">
                    <Link href={`/clients/${client.id}`} className="block group">
                      <p
                        className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors"
                      >
                        {client.name}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                        <span>{client.phone}</span>
                      </div>
                      {client.pppoe_username && (
                        <p className="text-sm text-slate-500">
                          PPPoE: {client.pppoe_username}
                        </p>
                      )}
                    </Link>
                  </td>
                )}
                {visibleColumns.contact && (
                  <td className="px-4 py-4">
                    <p className="text-sm text-slate-900">{client.email}</p>
                    <p className="text-sm text-slate-500">{client.phone}</p>
                  </td>
                )}
                {visibleColumns.package && (
                  <td className="px-4 py-4">
                    <p className="text-sm text-slate-900">
                      {client.service_plan || '-'}
                    </p>
                    {client.category === 'lite' && client.device_count ? (
                      <p className="text-sm text-slate-500">{client.device_count} device(s)</p>
                    ) : null}
                  </td>
                )}
                {visibleColumns.group && (
                  <td className="px-4 py-4">
                    <p className="text-sm text-slate-900">{getGroupName(client.group_id)}</p>
                  </td>
                )}
                {visibleColumns.status && (
                  <td className="px-4 py-4">
                    <ClientStatusBadge status={client.status} size="sm" />
                  </td>
                )}
                 {visibleColumns.payment_status && (
                  <td className="px-4 py-4">
                    {isCollectorMode ? (() => {
                      const isPaidToday = paidFullClients.has(client.id);
                      if (isPaidToday) return <InvoiceStatusBadge status="paid" />;

                      const partialAmount = partialPayments.get(client.id) || 0;
                      if (partialAmount > 0) {
                        return (
                          <div className="flex flex-col gap-1">
                            <InvoiceStatusBadge status="pending" />
                            <span className="text-[10px] font-bold text-blue-600 uppercase">
                              Partial: {new Intl.NumberFormat("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                minimumFractionDigits: 0,
                              }).format(partialAmount)}
                            </span>
                          </div>
                        );
                      }

                      const assignment = assignments.find((a) => a.invoice.client_id === client.id);
                      
                      // If we found an actual assignment, use it
                      if (assignment) {
                        return <InvoiceStatusBadge status={assignment.invoice.status} />;
                      }

                      // If NOT found and we are still loading, show a subtle pulse instead of assuming "paid"
                      if (collectorLoading) {
                        return (
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-16 animate-pulse bg-slate-100 rounded border border-slate-200" />
                          </div>
                        );
                      }
                      
                      // Final fallback: use client object status or default to paid
                      const status = (client.payment_status as InvoiceStatus) || "paid";
                      return <InvoiceStatusBadge status={status} />;
                    })() : (
                      client.payment_status ? (
                        <InvoiceStatusBadge status={client.payment_status as InvoiceStatus} />
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )
                    )}
                  </td>
                )}
                {visibleColumns.due_date && (
                  <td className="px-4 py-4 text-center sm:text-left">
                    {(() => {
                      const assignment = isCollectorMode ? assignments.find((a) => a.invoice.client_id === client.id) : null;
                      const dueDate = assignment ? assignment.invoice.due_date : client.payment_due_date;
                      const status = assignment ? assignment.invoice.status : client.payment_status;

                      if (dueDate) {
                        return (
                          <div className="flex flex-col">
                            <p className="text-sm font-medium text-slate-900">
                              {format(new Date(dueDate), 'dd MMM yyyy', { locale: id })}
                            </p>
                            {isAfter(startOfDay(new Date()), startOfDay(new Date(dueDate))) && status !== 'paid' && (
                              <div className="mt-1">
                                <span className="inline-flex items-center text-[10px] font-bold text-red-600 uppercase tracking-tight bg-red-50 px-1.5 py-0.5 rounded border border-red-100 italic whitespace-nowrap">
                                  Terlambat
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return <span className="text-slate-400 text-sm">-</span>;
                    })()}
                  </td>
                )}
                {visibleColumns.total && (
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-col items-end gap-1">
                      {isCollectorMode ? (() => {
                        const assignment = assignments.find((a) => a.invoice.client_id === client.id);
                        const isPaidFullToday = paidFullClients.has(client.id);
                        
                        let total = 0;
                        let remaining = 0;
                        
                        if (assignment) {
                          total = assignment.invoice.total_amount;
                          // invoice.paid_amount from backend already includes today's partial payment
                          // (backend updates it immediately when payment is recorded).
                          // Adding partialPaidToday on top would double-count it.
                          const alreadyPaid = assignment.invoice.paid_amount;
                          remaining = isPaidFullToday ? 0 : Math.max(0, total - alreadyPaid);
                        } else {
                          total = calculateTotal(client);
                          remaining = isPaidFullToday ? 0 : total;
                        }
                        return (
                          <>
                            <p className="text-sm font-bold text-slate-900">
                              {remaining === 0 ? (
                                <span className="text-green-600">Lunas</span>
                              ) : (
                                `Rp ${remaining.toLocaleString('id-ID')}`
                              )}
                            </p>
                            {remaining < total && remaining > 0 && (
                              <span className="text-[10px] text-slate-500 italic">
                                Sisa dari Rp {total.toLocaleString('id-ID')}
                              </span>
                            )}
                          </>
                        );
                      })() : (
                        <>
                          <p className="text-sm font-medium text-slate-900">
                            Rp {calculateTotal(client).toLocaleString('id-ID')}
                          </p>
                          {client.discount_type && client.discount_value && (
                            <p className="text-xs text-slate-500">
                              {client.discount_type === 'percent'
                                ? `Disc: ${client.discount_value}%`
                                : `Disc: Rp ${client.discount_value.toLocaleString('id-ID')}`}
                            </p>
                          )}
                        </>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHistoryClient({ id: client.id, name: client.name });
                        }}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 bg-indigo-50 rounded"
                      >
                        <ClockIcon className="w-3.5 h-3.5" />
                        Histori
                      </button>
                    </div>
                  </td>
                )}
                {visibleColumns.actions && (
                  <td className="px-4 py-4 text-right">
                  {isCollectorMode ? (
                    <CollectorActions 
                      client={client} 
                      invoiceId={assignments.find(a => a.invoice.client_id === client.id)?.invoice.id}
                      paymentStatus={(() => {
                        if (paidFullClients.has(client.id)) return "paid";
                        const assignment = assignments.find((a) => a.invoice.client_id === client.id);
                        if (assignment) return assignment.invoice.status;
                        
                        // Treat as pending during loading to keep buttons enabled
                        if (collectorLoading) return "pending";
                        
                        return client.payment_status || "paid";
                      })()}
                    />
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/clients/${client.id}`}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="View"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      <Link
                        href={`/clients/${client.id}/edit`}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      {onStatusChange && client.status === 'pending' && (
                        <>
                          <button
                            onClick={() => onStatusChange(client, 'active')}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Accept (Activate)"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onStatusChange(client, 'terminated')}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Reject"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      )}
                      {onStatusChange && client.status === 'active' && (
                        <button
                          onClick={() => onStatusChange(client, 'isolir')}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                          title="Isolate"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </button>
                      )}
                      {onStatusChange && client.status === 'isolir' && (
                        <button
                          onClick={() => onStatusChange(client, 'active')}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                          title="Activate"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {/* Modals */}
        {selectedHistoryClient && (
          <ClientPaymentHistoryModal
            isOpen={!!selectedHistoryClient}
            onClose={() => setSelectedHistoryClient(null)}
            clientId={selectedHistoryClient.id}
            clientName={selectedHistoryClient.name}
          />
        )}
      </div>
    </div>
  );
}


