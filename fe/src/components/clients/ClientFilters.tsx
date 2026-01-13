'use client';

import React from 'react';
import { ClientFilters as IClientFilters } from '@/lib/api/clientService';

interface ClientFiltersProps {
  filters: IClientFilters;
  onFilterChange: (filters: IClientFilters) => void;
}

export function ClientFilters({ filters, onFilterChange }: ClientFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search clients..."
          value={filters.search || ''}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Status Filter */}
      <select
        value={filters.status || ''}
        onChange={(e) => onFilterChange({ ...filters, status: e.target.value || undefined })}
        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
      >
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="isolir">Isolir</option>
        <option value="suspended">Suspended</option>
        <option value="terminated">Terminated</option>
      </select>

      {/* Clear Filters */}
      {(filters.search || filters.status) && (
        <button
          onClick={() => onFilterChange({})}
          className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}


