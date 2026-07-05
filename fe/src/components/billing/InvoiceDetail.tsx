"use client";

import { Invoice, Payment } from "@/lib/api/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";


interface InvoiceDetailProps {
  invoice: Invoice;
  payments?: Payment[];
  onRecordPayment?: () => void;
}

export function InvoiceDetail({ invoice, payments = [], onRecordPayment }: InvoiceDetailProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const remainingAmount = invoice.total_amount - invoice.paid_amount;
  const isFullyPaid = invoice.paid_amount >= invoice.total_amount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{invoice.invoice_number}</h2>
          <p className="text-sm text-slate-500 mt-1">Created: {format(new Date(invoice.created_at), "PPp")}</p>
        </div>
        <InvoiceStatusBadge status={invoice.status} className="text-sm" />
      </div>

      {/* Invoice Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-lg shadow p-6">
        <div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Client ID</p>
          <p className="text-sm font-medium text-slate-400 mt-1 break-all">{invoice.client_id}</p>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Period</p>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {format(new Date(invoice.period_start), "MMM d, yyyy")} -{" "}
            {format(new Date(invoice.period_end), "MMM d, yyyy")}
          </p>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Due Date</p>
          <p className="text-lg font-bold text-slate-900 mt-1">{format(new Date(invoice.due_date), "PPp")}</p>
        </div>
        {invoice.paid_at && (
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Paid At</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{format(new Date(invoice.paid_at), "PPp")}</p>
          </div>
        )}
      </div>

      {/* Items */}
      {invoice.items && invoice.items.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="h-2 w-2 bg-indigo-500 rounded-full"></div>
            Invoice Items
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Unit Price</th>
                  <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4 text-sm font-semibold text-slate-700">{item.description}</td>
                    <td className="text-right py-4 px-4 text-sm font-bold text-slate-600">{item.quantity}</td>
                    <td className="text-right py-4 px-4 text-sm font-bold text-slate-600">{formatCurrency(item.unit_price)}</td>
                    <td className="text-right py-4 px-4 text-sm font-black text-slate-900">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
          Summary
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Subtotal</span>
            <span className="font-bold text-slate-900">{formatCurrency(invoice.subtotal)}</span>
          </div>
          {invoice.tax_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">Tax</span>
              <span className="font-medium">{formatCurrency(invoice.tax_amount)}</span>
            </div>
          )}
          {invoice.discount_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">Discount</span>
              <span className="font-medium text-green-600">-{formatCurrency(invoice.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-4 mt-4">
            <span className="font-bold text-slate-900">Total Amount</span>
            <span className="font-black text-2xl text-slate-900">{formatCurrency(invoice.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Paid Amount</span>
            <span className="font-medium text-green-600">{formatCurrency(invoice.paid_amount)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-4 mt-4">
            <span className="font-bold text-slate-900">Remaining Amount</span>
            <span className={`font-black text-2xl ${isFullyPaid ? "text-emerald-600" : "text-rose-600"}`}>
              {formatCurrency(remainingAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Payments */}
      {payments && payments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="h-2 w-2 bg-emerald-500 rounded-full"></div>
            Payment History
          </h3>
          <div className="space-y-3">
            {payments.map((payment) => (
              <div key={payment.id} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
                    <p className="text-sm font-medium text-slate-600">
                      {payment.method} • {format(new Date(payment.received_at), "PPp")}
                    </p>
                    {payment.reference && (
                      <p className="text-xs text-slate-400 mt-1">Ref: {payment.reference}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-2">
        <Button 
          variant="outline" 
          className="font-bold flex items-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50" 
          onClick={() => router.push(`/billing/invoices/${invoice.id}/print`)}
        >
          <Printer className="h-4 w-4" /> Print Nota
        </Button>
        {(invoice.status === "pending" || invoice.status === "overdue") && !isFullyPaid && onRecordPayment && (
          <>
            <Button onClick={onRecordPayment} className="bg-indigo-600 hover:bg-indigo-700 font-bold shadow-lg">Record Payment</Button>
            <Button variant="outline" className="font-bold" onClick={() => router.push(`/billing/invoices/${invoice.id}/edit`)}>
              Edit Invoice
            </Button>
          </>
        )}
      </div>


      {invoice.notes && (
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-700 mb-1">Notes</p>
          <p className="text-sm text-slate-600">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}

