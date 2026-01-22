"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TabLayout } from "@/components/layouts/TabLayout";
import { useBillingStore } from "@/stores/billingStore";
import { InvoiceFilters, InvoiceTable, BillingSummaryCard, OverdueInvoicesAlert, PaymentsMatrixView } from "@/components/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format } from "date-fns";
import { PlusIcon } from "@heroicons/react/20/solid";
import { SubscriptionTab } from "@/components/billing/SubscriptionTab";
import { BillingTempoTemplates } from "@/components/billing/BillingTempoTemplates";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { useAuth } from "@/lib/hooks/useAuth";

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const defaultTab =
    tabParam === "payments" || tabParam === "subscription" || tabParam === "invoices" || tabParam === "settings"
      ? tabParam
      : "invoices";

  return (
    <RoleGuard allowedRoles={["owner", "admin", "finance", "collector"]} redirectTo="/dashboard">
    <div className="p-6">
      <TabLayout
        defaultTab={defaultTab}
        onTabChange={(tabId) => router.replace(`/billing?tab=${encodeURIComponent(tabId)}`)}
        tabs={[
          { id: "invoices", label: "Client Invoices", content: <InvoicesTabContent /> },
          { id: "payments", label: "Payments", content: <PaymentsTabContent /> },
          { id: "subscription", label: "Subscription", content: <SubscriptionTab /> },
          { id: "settings", label: "Settings", content: <SettingsTabContent /> },
        ]}
      />
    </div>
    </RoleGuard>
  );
}

function InvoicesTabContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
    invoiceFilters,
    setInvoiceFilters,
  } = useBillingStore();
  const { isAuthenticated } = useAuth();

  // Read status filter from URL query parameter and apply it
  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam && statusParam !== invoiceFilters.status) {
      // Apply status filter from URL
      setInvoiceFilters({ ...invoiceFilters, status: statusParam });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    // Only fetch if authenticated
    if (!isAuthenticated) return;
    fetchInvoices();
    fetchBillingSummary();
    fetchOverdueInvoices();
  }, [fetchInvoices, fetchBillingSummary, fetchOverdueInvoices, invoicePagination.page, invoicePagination.page_size, invoiceFilters, isAuthenticated]);

  if (error) {
    return <div className="p-6 text-red-500">Error loading invoices: {error}</div>;
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

function PaymentsTabContent() {
  return (
    <div className="space-y-4">
      <TabLayout
        defaultTab="detail"
        tabs={[
          { id: "detail", label: "Detail", content: <PaymentsDetailTab /> },
          { id: "matrix", label: "Matrix (12 bulan)", content: <PaymentsMatrixView /> },
        ]}
      />
    </div>
  );
}

function PaymentsDetailTab() {
  const router = useRouter();
  const {
    payments,
    loading,
    error,
    fetchPayments,
    paymentPagination,
    paymentFilters,
    setPaymentFilters,
    setPaymentPagination,
  } = useBillingStore();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Only fetch if authenticated
    if (!isAuthenticated) return;
    fetchPayments();
  }, [fetchPayments, paymentPagination.page, paymentPagination.page_size, paymentFilters, isAuthenticated]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (error) {
    return <div className="p-6 text-red-500">Error loading payments: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Payments</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
        <Input
          placeholder="Client ID (optional)"
          value={paymentFilters.client_id || ""}
          onChange={(e) => setPaymentFilters({ client_id: e.target.value || undefined })}
          className="w-full sm:max-w-xs"
        />
        <SimpleSelect
          value={paymentFilters.method || ""}
          onValueChange={(value) => setPaymentFilters({ method: value || undefined })}
          placeholder="Filter by Method"
          className="w-full sm:max-w-[180px]"
        >
          <option value="">All Methods</option>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="e_wallet">E-Wallet</option>
          <option value="qris">QRIS</option>
          <option value="virtual_account">Virtual Account</option>
          <option value="collector">Collector</option>
        </SimpleSelect>
        <Button onClick={() => setPaymentFilters({})} variant="outline">
          Reset Filters
        </Button>
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      ) : !payments || payments.length === 0 ? (
        <div className="text-center py-8 text-slate-500">No payments found. Try adjusting your filters.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase border-r border-slate-200">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase border-r border-slate-200">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase border-r border-slate-200">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase border-r border-slate-200">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase border-r border-slate-200">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase border-r border-slate-200">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50 border-b border-slate-200">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {format(new Date(payment.received_at), "MMM d, yyyy HH:mm")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => router.push(`/billing/invoices/${payment.invoice_id}`)}
                      className="text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      View Invoice
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {payment.client_name || payment.client_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{formatCurrency(payment.amount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      {payment.method}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{payment.reference || "-"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    <Button variant="outline" size="sm" onClick={() => router.push(`/billing/payments/${payment.id}`)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setPaymentPagination({ page: paymentPagination.page - 1 })}
            disabled={paymentPagination.page === 1 || loading}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-slate-600">
            Page {paymentPagination.page} of {Math.ceil(paymentPagination.total / paymentPagination.page_size) || 1}
          </span>
          <Button
            variant="outline"
            onClick={() => setPaymentPagination({ page: paymentPagination.page + 1 })}
            disabled={paymentPagination.page >= Math.ceil(paymentPagination.total / paymentPagination.page_size) || loading}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function SettingsTabContent() {
  return (
    <div className="space-y-6">
      <BillingTempoTemplates />
    </div>
  );
}
