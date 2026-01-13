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
  const { cancelInvoice } = useBillingStore();
  const { showToast } = useNotificationStore();

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
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No invoices found. Try adjusting your filters.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="flex items-center justify-end px-4 py-3 border-b border-slate-200 bg-white">
        <details className="relative">
          <summary className="list-none cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
            Columns
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-10">
            <div className="space-y-2 text-sm">
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
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.invoice_number && <TableHead>Invoice Number</TableHead>}
              {visibleColumns.client && <TableHead>Client Name</TableHead>}
              {visibleColumns.contact && <TableHead>Contact</TableHead>}
              {visibleColumns.group && <TableHead>Group</TableHead>}
              {visibleColumns.address && <TableHead>Alamat</TableHead>}
              {visibleColumns.period && <TableHead>Period</TableHead>}
              {visibleColumns.due_date && <TableHead>Due Date</TableHead>}
              {visibleColumns.total_amount && <TableHead>Total Amount</TableHead>}
              {visibleColumns.paid_amount && <TableHead>Paid Amount</TableHead>}
              {visibleColumns.status && <TableHead>Status</TableHead>}
              {visibleColumns.actions && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                {visibleColumns.invoice_number && (
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                )}
                {visibleColumns.client && <TableCell>{invoice.client_name || invoice.client_id}</TableCell>}
                {visibleColumns.contact && <TableCell>{invoice.client_phone || "-"}</TableCell>}
                {visibleColumns.group && <TableCell>{invoice.client_group_name || "-"}</TableCell>}
                {visibleColumns.address && (
                  <TableCell className="max-w-xs truncate" title={invoice.client_address || undefined}>
                    {invoice.client_address || "-"}
                  </TableCell>
                )}
                {visibleColumns.period && (
                  <TableCell>
                    {format(new Date(invoice.period_start), "MMM d")} -{" "}
                    {format(new Date(invoice.period_end), "MMM d, yyyy")}
                  </TableCell>
                )}
                {visibleColumns.due_date && <TableCell>{format(new Date(invoice.due_date), "MMM d, yyyy")}</TableCell>}
                {visibleColumns.total_amount && <TableCell>{formatCurrency(invoice.total_amount)}</TableCell>}
                {visibleColumns.paid_amount && <TableCell>{formatCurrency(invoice.paid_amount)}</TableCell>}
                {visibleColumns.status && (
                  <TableCell>
                    <InvoiceStatusBadge status={invoice.status} />
                  </TableCell>
                )}
                {visibleColumns.actions && (
                  <TableCell className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleView(invoice.id)}>
                      View
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
    </div>
  );
}

