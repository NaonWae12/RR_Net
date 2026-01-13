'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Client } from '@/lib/api/clientService';
import { ClientStatusBadge } from './ClientStatusBadge';
import servicePackageService, { ServicePackage } from '@/lib/api/servicePackageService';
import clientGroupService, { ClientGroup } from '@/lib/api/clientGroupService';

type ColumnKey = 'client' | 'contact' | 'package' | 'group' | 'status' | 'total' | 'actions';
const COLUMNS_STORAGE_KEY = 'clients_table_columns_v1';

interface ClientTableProps {
  clients: Client[];
  loading?: boolean;
  onStatusChange?: (client: Client, status: string) => void;
}

export function ClientTable({ clients, loading, onStatusChange }: ClientTableProps) {
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [auxLoading, setAuxLoading] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    client: true,
    contact: true,
    package: true,
    group: true,
    status: true,
    total: true,
    actions: true,
  });

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

  // Fetch all service packages + groups to calculate totals and show group name
  useEffect(() => {
    let alive = true;
    (async () => {
      setAuxLoading(true);
      try {
        const [pkgList, groupList] = await Promise.all([
          servicePackageService.list(undefined, false),
          clientGroupService.list(),
        ]);
        if (!alive) return;
        setPackages(pkgList);
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

  // Calculate total billing for a client
  const calculateTotal = (client: Client): number => {
    if (!client.service_package_id) return 0;
    
    const pkg = packages.find((p) => p.id === client.service_package_id);
    if (!pkg) return 0;

    let basePrice = 0;
    if (pkg.pricing_model === 'per_device') {
      basePrice = pkg.price_per_device * (client.device_count || 1);
    } else {
      basePrice = pkg.price_monthly;
    }

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

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-end px-4 py-3 border-b border-slate-200 bg-white">
        <details className="relative">
          <summary className="list-none cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
            Columns
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-10">
            <div className="space-y-2 text-sm">
              {(
                [
                  ['client', 'Client'],
                  ['contact', 'Contact'],
                  ['package', 'Package'],
                  ['group', 'Group'],
                  ['status', 'Status'],
                  ['total', 'Total Tagihan'],
                ] as Array<[ColumnKey, string]>
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!visibleColumns[key]}
                    onChange={(e) => setColumn(key, e.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </details>
      </div>
      <div className="overflow-x-auto">
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
          <tbody className="divide-y divide-slate-100">
            {clients.map((client) => (
              <tr
                key={client.id}
                className="hover:bg-slate-50 transition-colors"
              >
                {visibleColumns.client && (
                  <td className="px-4 py-4">
                    <Link href={`/clients/${client.id}`} className="block">
                      <p className="font-medium text-slate-900 hover:text-indigo-600">
                        {client.name}
                      </p>
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
                {visibleColumns.total && (
                  <td className="px-4 py-4 text-right">
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
                  </td>
                )}
                {visibleColumns.actions && (
                  <td className="px-4 py-4 text-right">
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
                </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


