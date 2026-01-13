'use client';

import React from 'react';

interface ClientPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function ClientPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: ClientPaginationProps) {
  // Ensure totalPages is a valid number
  const safeTotalPages = Math.max(0, Math.floor(totalPages || 0));
  const safePage = Math.max(1, Math.floor(page || 1));
  const safeTotal = Math.max(0, Math.floor(total || 0));
  const safePageSize = Math.max(1, Math.floor(pageSize || 10));

  const start = (safePage - 1) * safePageSize + 1;
  const end = Math.min(safePage * safePageSize, safeTotal);

  if (safeTotalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
      <p className="text-sm text-slate-600">
        Showing <span className="font-medium">{start}</span> to{' '}
        <span className="font-medium">{end}</span> of{' '}
        <span className="font-medium">{total}</span> results
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage === 1}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {[...Array(Math.min(5, safeTotalPages))].map((_, i) => {
          let pageNum: number;
          if (safeTotalPages <= 5) {
            pageNum = i + 1;
          } else if (safePage <= 3) {
            pageNum = i + 1;
          } else if (safePage >= safeTotalPages - 2) {
            pageNum = safeTotalPages - 4 + i;
          } else {
            pageNum = safePage - 2 + i;
          }

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`
                w-10 h-10 text-sm font-medium rounded-lg
                ${safePage === pageNum
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
                }
              `}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage === safeTotalPages}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}


