"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Invoice } from "@/lib/api/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useBillingStore } from "@/stores/billingStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format } from "date-fns";
import { Printer, Layers } from "lucide-react";


interface InvoiceTableProps {
  invoices: Invoice[] | null | undefined;
  loading: boolean;
}

type ColumnKey =
  | "invoice_number"
  | "client"
  | "contact"
  | "group"
  | "address"
  | "period"
  | "due_date"
  | "total_amount"
  | "paid_amount"
  | "status"
  | "actions";

const COLUMNS_STORAGE_KEY = "invoices_table_columns_v1";

export function InvoiceTable({ invoices, loading }: InvoiceTableProps) {
  const router = useRouter();
  const { cancelInvoice, invoiceFilters, setInvoiceFilters } = useBillingStore();
  const { showToast } = useNotificationStore();

  // Bulk selection
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allIds = (invoices ?? []).map((inv) => inv.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = allIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const handleBulkPrint = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    router.push(`/billing/invoices/print/bulk?ids=${ids.join(",")}`);
  };

  const [visibleColumns, setVisibleColumns] = React.useState<Record<ColumnKey, boolean>>({
    invoice_number: true,
    client: true,
    contact: true,
    group: true,
    address: true,
    period: true,
    due_date: true,
    total_amount: true,
    paid_amount: true,
    status: true,
    actions: true,
  });

  // Load column preferences
  React.useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(COLUMNS_STORAGE_KEY) : null;
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

  const handleView = (id: string) => {
    router.push(`/billing/invoices/${id}`);
  };

  const handleCancel = async (id: string, invoiceNumber: string) => {
    if (!confirm(`Are you sure you want to cancel invoice ${invoiceNumber}?`)) {
      return;
    }
    try {
      await cancelInvoice(id);
      showToast({
        title: "Invoice cancelled",
        description: `Invoice ${invoiceNumber} has been cancelled.`,
        variant: "success",
      });
    } catch (error: any) {
      showToast({
        title: "Failed to cancel invoice",
        description: error.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48 bg-white rounded-lg border border-slate-200">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden border border-slate-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          {/* Bulk Print Button */}
          {someSelected && (
            <Button
              onClick={handleBulkPrint}
              size="sm"
              className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm text-xs"
            >
              <Layers className="w-3.5 h-3.5" />
              Cetak Semua ({selectedIds.size})
            </Button>
          )}
           <details className="relative group">
              <summary className="list-none cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold border border-slate-200 rounded-lg bg-slate-50 hover:bg-white text-slate-700 transition-all">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {(!invoiceFilters.start_date && !invoiceFilters.end_date) ? 'All Time' : 
                 (invoiceFilters.start_date === invoiceFilters.end_date) ? `Date: ${invoiceFilters.start_date}` :
                 'Custom Range'}
                <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-20 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => setInvoiceFilters({ start_date: undefined, end_date: undefined })}
                  >
                    All Time
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setInvoiceFilters({ start_date: today, end_date: today });
                    }}
                  >
                    Today
                  </Button>
                </div>
                
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Start Date / Per Day</label>
                    <input 
                      type="date" 
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={invoiceFilters.start_date || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInvoiceFilters({ start_date: val || undefined });
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">End Date (Optional Range)</label>
                    <input 
                      type="date" 
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={invoiceFilters.end_date || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInvoiceFilters({ end_date: val || undefined });
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-1"
                    onClick={() => {
                      // Trigger fetch via store effect
                      const details = document.querySelector('details[open]');
                      if (details) details.removeAttribute('open');
                    }}
                  >
                    Apply Filter
                  </Button>
                </div>
              </div>
           </details>
        </div>

        <details className="relative">
          <summary className="list-none cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-900 bg-white">
            Columns
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-10">
            <div className="space-y-2 text-sm text-slate-900">
              {(
                [
                  ["invoice_number", "Invoice Number"],
                  ["client", "Client Name"],
                  ["contact", "Contact (phone)"],
                  ["group", "Group"],
                  ["address", "Alamat"],
                  ["period", "Period"],
                  ["due_date", "Due Date"],
                  ["total_amount", "Total Amount"],
                  ["paid_amount", "Paid Amount"],
                  ["status", "Status"],
                ] as Array<[ColumnKey, string]>
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-slate-900">
                  <input
                    type="checkbox"
                    checked={!!visibleColumns[key]}
                    onChange={(e) => setColumn(key, e.target.checked)}
                    className="text-indigo-600 border-slate-300"
                  />
                  <span className="text-slate-900">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </details>
      </div>

      {(!invoices || invoices.length === 0) ? (
        <div className="text-center py-20 bg-slate-50/50">
          <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
             <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
             </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">No invoices found</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">Try adjusting your time filters or searching for specific client details.</p>
          <Button 
            variant="link" 
            className="mt-4 text-indigo-600 font-bold"
            onClick={() => setInvoiceFilters({})}
          >
            Clear All Filters
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200">
              {/* Select All Checkbox */}
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  title="Pilih semua"
                />
              </TableHead>
              {visibleColumns.invoice_number && <TableHead className="text-slate-700">Invoice Number</TableHead>}
              {visibleColumns.client && <TableHead className="text-slate-700">Client Name</TableHead>}
              {visibleColumns.contact && <TableHead className="text-slate-700">Contact</TableHead>}
              {visibleColumns.group && <TableHead className="text-slate-700">Group</TableHead>}
              {visibleColumns.address && <TableHead className="text-slate-700">Alamat</TableHead>}
              {visibleColumns.period && <TableHead className="text-slate-700">Period</TableHead>}
              {visibleColumns.due_date && <TableHead className="text-slate-700">Due Date</TableHead>}
              {visibleColumns.total_amount && <TableHead className="text-slate-700">Total Amount</TableHead>}
              {visibleColumns.paid_amount && <TableHead className="text-slate-700">Paid Amount</TableHead>}
              {visibleColumns.status && <TableHead className="text-slate-700">Status</TableHead>}
              {visibleColumns.actions && <TableHead className="text-slate-700">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow
                key={invoice.id}
                className={`border-slate-200 transition-colors ${selectedIds.has(invoice.id) ? "bg-indigo-50/60" : ""}`}
              >
                {/* Row Checkbox */}
                <TableCell className="w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                    checked={selectedIds.has(invoice.id)}
                    onChange={() => toggleSelect(invoice.id)}
                  />
                </TableCell>
                {visibleColumns.invoice_number && (
                  <TableCell className="font-medium text-slate-900">{invoice.invoice_number}</TableCell>
                )}
                {visibleColumns.client && <TableCell className="text-slate-900">{invoice.client_name || invoice.client_id}</TableCell>}
                {visibleColumns.contact && <TableCell className="text-slate-700">{invoice.client_phone || "-"}</TableCell>}
                {visibleColumns.group && <TableCell className="text-slate-700">{invoice.client_group_name || "-"}</TableCell>}
                {visibleColumns.address && (
                  <TableCell className="max-w-xs truncate text-slate-700" title={invoice.client_address || undefined}>
                    {invoice.client_address || "-"}
                  </TableCell>
                )}
                {visibleColumns.period && (
                  <TableCell className="text-slate-700">
                    {format(new Date(invoice.period_start), "MMM d")} -{" "}
                    {format(new Date(invoice.period_end), "MMM d, yyyy")}
                  </TableCell>
                )}
                {visibleColumns.due_date && <TableCell className="text-slate-700">{format(new Date(invoice.due_date), "MMM d, yyyy")}</TableCell>}
                {visibleColumns.total_amount && <TableCell className="text-slate-900 font-medium">{formatCurrency(invoice.total_amount)}</TableCell>}
                {visibleColumns.paid_amount && <TableCell className="text-slate-900 font-medium">{formatCurrency(invoice.paid_amount)}</TableCell>}
                {visibleColumns.status && (
                  <TableCell className="text-slate-900">
                    <InvoiceStatusBadge status={invoice.status} />
                  </TableCell>
                )}
                {visibleColumns.actions && (
                  <TableCell className="flex space-x-2 text-slate-900">
                    <Button variant="outline" size="sm" onClick={() => handleView(invoice.id)}>
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/billing/invoices/${invoice.id}/print`)}
                      title="Print Invoice"
                      className="p-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    {invoice.status === "pending" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancel(invoice.id, invoice.invoice_number)}
                      >
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  );
}

