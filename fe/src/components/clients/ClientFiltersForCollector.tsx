'use client';

import React, { useEffect } from 'react';
import { ClientFilters as IClientFilters } from '@/lib/api/clientService';
import { useCollectorStore } from '@/stores/collectorStore';
import { format } from 'date-fns';

interface ClientFiltersForCollectorProps {
  filters: IClientFilters;
  onFilterChange: (filters: IClientFilters) => void;
}

export function ClientFiltersForCollector({ filters, onFilterChange }: ClientFiltersForCollectorProps) {
  const { selectedDate, setSelectedDate, fetchPaymentsForDate } = useCollectorStore();

  // API syncing is handled centrally in clients/page.tsx

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [year, month] = e.target.value.split('-');
    const newDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    setSelectedDate(newDate);
  };

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
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Month Picker */}
      <div className="flex items-center gap-2">
        <input
          type="month"
          value={format(selectedDate, 'yyyy-MM')}
          onChange={handleDateChange}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        
        {/* Quick date buttons */}
        <button
          onClick={() => {
            const prevDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
            setSelectedDate(prevDate);
          }}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Previous month"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <button
          onClick={() => setSelectedDate(new Date())}
          className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="This Month"
        >
          This Month
        </button>
        
        <button
          onClick={() => {
            const nextDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
            setSelectedDate(nextDate);
          }}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Next month"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Clear Filters */}
      {filters.search && (
        <button
          onClick={() => onFilterChange({ ...filters, search: undefined })}
          className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}

