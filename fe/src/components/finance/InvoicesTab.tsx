"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InvoiceFilters, InvoiceTable, BillingSummaryCard, OverdueInvoicesAlert } from "@/components/billing";
import { useBillingStore } from "@/stores/billingStore";
import { PlusIcon } from "@heroicons/react/20/solid";
import { useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";

export function InvoicesTab() {
  const router = useRouter();
  const {
    invoices,
    summary,
    overdueInvoices,
    loading,
    error,
    fetchInvoices,
    fetchBillingSummary,
    fetchOverdueInvoices,
    invoicePagination,
    setInvoicePagination,
  } = useBillingStore();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchInvoices();
    fetchBillingSummary();
    fetchOverdueInvoices();
  }, [fetchInvoices, fetchBillingSummary, fetchOverdueInvoices, invoicePagination.page, invoicePagination.page_size, isAuthenticated]);

  if (error) {
    return <div className="p-6 text-red-600 text-slate-900">Error loading invoices: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <Button onClick={() => router.push("/billing/invoices/create")}>
          <PlusIcon className="h-5 w-5 mr-2" /> Create Invoice
        </Button>
      </div>

      <BillingSummaryCard summary={summary} loading={loading} />

      <OverdueInvoicesAlert invoices={overdueInvoices} />

      <InvoiceFilters />

      <InvoiceTable invoices={invoices} loading={loading} />

      <div className="flex justify-center">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setInvoicePagination({ page: invoicePagination.page - 1 })}
            disabled={invoicePagination.page === 1 || loading}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-slate-600">
            Page {invoicePagination.page} of {Math.ceil(invoicePagination.total / invoicePagination.page_size) || 1}
          </span>
          <Button
            variant="outline"
            onClick={() => setInvoicePagination({ page: invoicePagination.page + 1 })}
            disabled={invoicePagination.page >= Math.ceil(invoicePagination.total / invoicePagination.page_size) || loading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

