'use client';

import React from 'react';

type ClientStatus = 'active' | 'isolir' | 'suspended' | 'terminated';

interface ClientStatusBadgeProps {
  status: ClientStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<ClientStatus, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  isolir: {
    label: 'Isolir',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  suspended: {
    label: 'Suspended',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  terminated: {
    label: 'Terminated',
    className: 'bg-slate-900 text-white border-slate-900',
  },
};

export function ClientStatusBadge({ status, size = 'md' }: ClientStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.active;
  
  return (
    <span
      className={`
        inline-flex items-center rounded-full border font-medium
        ${config.className}
        ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}
      `}
    >
      <span
        className={`
          mr-1.5 rounded-full
          ${size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'}
          ${status === 'active' ? 'bg-emerald-500' : ''}
          ${status === 'isolir' ? 'bg-amber-500' : ''}
          ${status === 'suspended' ? 'bg-red-500' : ''}
          ${status === 'terminated' ? 'bg-slate-900' : ''}
        `}
      />
      {config.label}
    </span>
  );
}


