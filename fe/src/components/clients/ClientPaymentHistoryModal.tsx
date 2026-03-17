"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/modals/Modal";
import { billingService } from "@/lib/api/billingService";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { Payment } from "@/lib/api/types";
import { format } from "date-fns";

interface ClientPaymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

export function ClientPaymentHistoryModal({
  isOpen,
  onClose,
  clientId,
  clientName,
}: ClientPaymentHistoryModalProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && clientId) {
      setLoading(true);
      billingService
        .getPayments({ client_id: clientId, page_size: 50 })
        .then((res) => {
          setPayments(res.data || []);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, clientId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Riwayat Pembayaran: ${clientName}`}
      size="lg"
    >
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          Belum ada riwayat pembayaran untuk klien ini.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Metode</th>
                <th className="px-4 py-3">Nominal</th>
                <th className="px-4 py-3">Penerima</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">
                    {format(new Date(p.received_at), "dd MMM yyyy, HH:mm")}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">
                    {p.method.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.collector_name || (p.method === 'collector' ? 'Collector' : 'System')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === "verified"
                          ? "bg-green-100 text-green-700"
                          : p.status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
