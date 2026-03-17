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
import { BillingTempoTemplates } from "@/components/billing/BillingTempoTemplates";
import ManualInvoiceModal from '@/components/billing/ManualInvoiceModal';
import { useState } from 'react';
import { RoleGuard } from "@/components/guards/RoleGuard";
import { useAuth } from "@/lib/hooks/useAuth";
import { financeService } from "@/lib/api/financeService";
import type { PaymentMethodAccount } from "@/lib/api/types";
import { TrashIcon, PencilIcon, BanknotesIcon, ClockIcon } from "@heroicons/react/24/outline";
import { useNotificationStore } from "@/stores/notificationStore";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

export default function FinanceBillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const defaultTab =
    tabParam === "payments" || tabParam === "invoices" || tabParam === "settings" || tabParam === "payment_accounts"
      ? tabParam
      : "invoices";

  return (
    <RoleGuard allowedRoles={["owner", "admin", "finance"]} redirectTo="/dashboard">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Billing Management</h1>
          <p className="text-slate-500">Kelola tagihan (invoices) dan pembayaran client dalam satu tempat.</p>
        </div>
        
        <TabLayout
          defaultTab={defaultTab}
          onTabChange={(tabId) => router.replace(`/finance/billing?tab=${encodeURIComponent(tabId)}`)}
          tabs={[
            { id: "invoices", label: "Client Invoices", content: <InvoicesTabContent /> },
            { id: "payments", label: "Payments", content: <PaymentsTabContent /> },
            { id: "settings", label: "Setup & Templates", content: <SettingsTabContent /> },
            { id: "payment_accounts", label: "Payment Accounts", content: <PaymentMethodSetup /> },
          ]}
        />
      </div>
    </RoleGuard>
  );
}

function InvoicesTabContent() {
  const [isManualInvoiceOpen, setIsManualInvoiceOpen] = useState(false);
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

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchInvoices();
    fetchBillingSummary();
    fetchOverdueInvoices();
  }, [fetchInvoices, fetchBillingSummary, fetchOverdueInvoices, invoicePagination.page, invoicePagination.page_size, invoiceFilters, isAuthenticated]);

  if (error) return <div className="p-6 text-red-500">Error loading invoices: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Invoices</h2>
        <Button onClick={() => setIsManualInvoiceOpen(true)}>
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

      <ManualInvoiceModal 
        isOpen={isManualInvoiceOpen} 
        onClose={() => setIsManualInvoiceOpen(false)} 
        onSuccess={() => {
          fetchInvoices();
          fetchBillingSummary();
        }} 
      />
    </div>
  );
}

function PaymentsTabContent() {
  return (
    <div className="space-y-4">
      <TabLayout
        defaultTab="detail"
        tabs={[
          { id: "detail", label: "Detail Payments", content: <PaymentsDetailTab /> },
          { id: "matrix", label: "Billing Matrix", content: <PaymentsMatrixView /> },
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

  if (error) return <div className="p-6 text-red-500">Error loading payments: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 py-2">
        <Input
          placeholder="Search Client ID..."
          value={paymentFilters.client_id || ""}
          onChange={(e) => setPaymentFilters({ client_id: e.target.value || undefined })}
          className="w-full sm:max-w-xs"
        />
        <SimpleSelect
          value={paymentFilters.method || ""}
          onValueChange={(value) => setPaymentFilters({ method: value || undefined })}
          placeholder="All Payment Methods"
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
        <Button onClick={() => setPaymentFilters({})} variant="outline">Reset</Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48"><LoadingSpinner size={40} /></div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm">{format(new Date(payment.received_at), "MMM d, yyyy")}</td>
                  <td className="px-6 py-4 text-sm font-medium">{payment.client_name || payment.client_id}</td>
                  <td className="px-6 py-4 text-sm font-bold">{formatCurrency(payment.amount)}</td>
                  <td className="px-6 py-4 text-sm"><span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{payment.method}</span></td>
                  <td className="px-6 py-4 text-sm">
                    <Button variant="outline" size="sm" onClick={() => router.push(`/billing/payments/${payment.id}`)}>Detail</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-center">
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setPaymentPagination({ page: paymentPagination.page - 1 })} disabled={paymentPagination.page === 1 || loading}>Previous</Button>
          <span className="flex items-center px-4 text-sm">Page {paymentPagination.page}</span>
          <Button variant="outline" onClick={() => setPaymentPagination({ page: paymentPagination.page + 1 })} disabled={paymentPagination.page >= Math.ceil(paymentPagination.total / paymentPagination.page_size) || loading}>Next</Button>
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



function PaymentMethodSetup() {
  const [methods, setMethods] = useState<PaymentMethodAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodAccount | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useNotificationStore();

  const fetchMethods = async () => {
    try {
      setLoading(true);
      const data = await financeService.getPaymentMethods();
      setMethods(data);
    } catch (err) {
      showToast({ title: "Error", description: "Failed to load payment methods", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleDelete = async () => {
    if (!methodToDelete) return;
    
    try {
      setIsDeleting(true);
      await financeService.deletePaymentMethod(methodToDelete);
      showToast({ title: "Success", description: "Payment account deleted", variant: "success" });
      fetchMethods();
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to delete payment account";
      showToast({ 
        title: "Error", 
        description: errorMessage, 
        variant: "error" 
      });
    } finally {
      setIsDeleting(false);
      setMethodToDelete(null);
    }
  };

  const confirmDelete = (id: string) => {
    setMethodToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const toggleActive = async (method: PaymentMethodAccount) => {
    try {
      await financeService.updatePaymentMethod(method.id, { is_active: !method.is_active });
      showToast({ 
        title: "Success", 
        description: `Account ${!method.is_active ? 'activated' : 'deactivated'}`, 
        variant: "success" 
      });
      fetchMethods();
    } catch (err) {
      showToast({ title: "Error", description: "Failed to update account status", variant: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900 font-outfit">Payment Accounts</h3>
          <p className="text-sm text-slate-500">Daftar rekening bank, kas, atau e-wallet yang digunakan untuk transaksi.</p>
        </div>
        <Button onClick={() => { setEditingMethod(null); setIsModalOpen(true); }}>
          <PlusIcon className="h-5 w-5 mr-2" /> Add Account
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><LoadingSpinner /></div>
      ) : (!methods || methods.length === 0) ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <BanknotesIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Belum ada akun pembayaran</h3>
          <p className="text-slate-500 mb-6">Tambahkan akun bank atau kas untuk mulai mencatat pembayaran.</p>
          <Button onClick={() => { setEditingMethod(null); setIsModalOpen(true); }}>Add Your First Account</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {methods.map((method) => (
            <div key={method.id} className={`bg-white rounded-2xl border p-6 transition-all hover:shadow-lg ${!method.is_active ? 'opacity-60 grayscale' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${
                  method.category === 'bank' ? 'bg-blue-50 text-blue-600' : 
                  method.category === 'e-wallet' ? 'bg-purple-50 text-purple-600' : 
                  method.category === 'pay later' ? 'bg-orange-50 text-orange-600' : 
                  'bg-green-50 text-green-600'
                }`}>
                  {method.category === 'pay later' ? <ClockIcon className="h-6 w-6" /> : <BanknotesIcon className="h-6 w-6" />}
                </div>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => { setEditingMethod(method); setIsModalOpen(true); }}>
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => confirmDelete(method.id)} className="text-red-500 hover:text-red-600">
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 truncate">{method.name}</h4>
                <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  {method.category} {method.provider ? `• ${method.provider}` : ''}
                </p>
              </div>

              {(method.account_number || method.account_name) && (
                <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                  {method.account_number && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Acc. Number</span>
                      <span className="font-mono text-slate-900">{method.account_number}</span>
                    </div>
                  )}
                  {method.account_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Acc. Name</span>
                      <span className="text-slate-900 font-medium">{method.account_name}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  method.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                }`}>
                  {method.is_active ? 'Active' : 'Inactive'}
                </span>
                <Button variant="outline" size="sm" onClick={() => toggleActive(method)}>
                  {method.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <PaymentMethodModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchMethods}
          initialData={editingMethod}
        />
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Payment Account"
        message="Are you sure you want to delete this payment account? This action cannot be undone if there are no transactions linked to it."
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
        loading={isDeleting}
      />
    </div>
  );
}

function PaymentMethodModal({ isOpen, onClose, onSuccess, initialData }) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    category: initialData?.category || "bank",
    provider: initialData?.provider || "",
    account_number: initialData?.account_number || "",
    account_name: initialData?.account_name || "",
  });
  const [loading, setLoading] = useState(false);
  const { showToast } = useNotificationStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const dataToSubmit = { ...formData };
    if (formData.category === 'cash' || formData.category === 'pay later') {
      dataToSubmit.provider = "";
      dataToSubmit.account_number = "";
      dataToSubmit.account_name = "";
    }

    try {
      if (initialData) {
        await financeService.updatePaymentMethod(initialData.id, dataToSubmit);
        showToast({ title: "Success", description: "Account updated successfully", variant: "success" });
      } else {
        await financeService.createPaymentMethod(dataToSubmit);
        showToast({ title: "Success", description: "Account created successfully", variant: "success" });
      }
      onSuccess();
      onClose();
    } catch (err) {
      showToast({ title: "Error", description: "Failed to save account", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 font-outfit">
            {initialData ? 'Edit Payment Account' : 'Add Payment Account'}
          </h2>
          <p className="text-slate-500 mb-8">
            {initialData ? 'Perbarui informasi akun pembayaran Anda.' : 'Tambahkan akun pembayaran baru untuk bisnis Anda.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Account Name</label>
              <Input 
                required
                placeholder="Ex: Bank Mandiri Utama, Kas Kecil" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="rounded-xl border-slate-200 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Category</label>
              <SimpleSelect 
                value={formData.category} 
                onValueChange={v => setFormData({...formData, category: v as any})}
                className="w-full rounded-xl border-slate-200"
              >
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
                <option value="e-wallet">E-Wallet</option>
                <option value="pay later">Pay Later</option>
              </SimpleSelect>
            </div>

            {formData.category !== 'cash' && formData.category !== 'pay later' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Provider / Bank Name</label>
                  <Input 
                    placeholder="Ex: Mandiri, BCA, GoPay" 
                    value={formData.provider}
                    onChange={e => setFormData({...formData, provider: e.target.value})}
                    className="rounded-xl border-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Acc. Number</label>
                    <Input 
                      placeholder="123456789" 
                      value={formData.account_number}
                      onChange={e => setFormData({...formData, account_number: e.target.value})}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Acc. Name</label>
                    <Input 
                      placeholder="Ex: PT Solusi Jaya" 
                      value={formData.account_name}
                      onChange={e => setFormData({...formData, account_name: e.target.value})}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex space-x-3 pt-4">
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700" loading={loading}>
                {initialData ? 'Save Changes' : 'Create Account'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
