"use client";

import { BillingSummary } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";

interface BillingSummaryCardProps {
  summary: BillingSummary | null;
  loading: boolean;
}

export function BillingSummaryCard({ summary, loading }: BillingSummaryCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (!summary) {
    return <div className="text-center py-8 text-slate-500">No summary data available.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-slate-500">Total Invoices</h3>
        <p className="text-2xl font-bold text-slate-900 mt-2">{summary.total_invoices}</p>
        <p className="text-xs text-slate-400 mt-1">
          {summary.paid_invoices} paid, {summary.pending_invoices} pending
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-slate-500">Total Revenue</h3>
        <p className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(summary.total_revenue)}</p>
        <p className="text-xs text-slate-400 mt-1">Collected this month: {formatCurrency(summary.collected_this_month)}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-slate-500">Pending Amount</h3>
        <p className="text-2xl font-bold text-yellow-600 mt-2">{formatCurrency(summary.pending_amount)}</p>
        <p className="text-xs text-slate-400 mt-1">{summary.pending_invoices} invoices</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-medium text-slate-500">Overdue Amount</h3>
        <p className="text-2xl font-bold text-red-600 mt-2">{formatCurrency(summary.overdue_amount)}</p>
        <p className="text-xs text-slate-400 mt-1">{summary.overdue_invoices} invoices</p>
      </div>
    </div>
  );
}

