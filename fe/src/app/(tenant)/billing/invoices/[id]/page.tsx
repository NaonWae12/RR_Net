"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBillingStore } from "@/stores/billingStore";
import { InvoiceDetail, PaymentForm } from "@/components/billing";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { RecordPaymentRequest } from "@/lib/api/types";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { invoice, loading, error, fetchInvoice, recordPayment, fetchInvoicePayments, clearInvoice } = useBillingStore();
  const { showToast } = useNotificationStore();
  const [payments, setPayments] = useState<any[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchInvoice(id);
    }
    return () => {
      clearInvoice();
    };
  }, [id, fetchInvoice, clearInvoice]);

  useEffect(() => {
    if (invoice?.id) {
      fetchInvoicePayments(invoice.id)
        .then((data) => setPayments(data ?? []))
        .catch((err) => {
          console.error(err);
          setPayments([]);
        });
    }
  }, [invoice?.id, fetchInvoicePayments]);

  const handleRecordPayment = async (data: RecordPaymentRequest) => {
    setPaymentLoading(true);
    try {
      await recordPayment(data);
      showToast({
        title: "Payment recorded",
        description: "Payment has been successfully recorded.",
        variant: "success",
      });
      setShowPaymentForm(false);
      // Refresh invoice and payments
      if (id) {
        await fetchInvoice(id);
        const updatedPayments = await fetchInvoicePayments(id);
        setPayments(updatedPayments ?? []);
      }
    } catch (err: any) {
      showToast({
        title: "Failed to record payment",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading invoice: {error}
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6 text-slate-500">
        Invoice not found.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Invoices
        </Button>
      </div>

      <InvoiceDetail
        invoice={invoice}
        payments={payments}
        onRecordPayment={() => setShowPaymentForm(true)}
      />

      {showPaymentForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Record Payment</h2>
          <PaymentForm
            invoiceId={invoice.id}
            maxAmount={invoice.total_amount - invoice.paid_amount}
            onSubmit={handleRecordPayment}
            onCancel={() => setShowPaymentForm(false)}
            isLoading={paymentLoading}
          />
        </div>
      )}
    </div>
  );
}

