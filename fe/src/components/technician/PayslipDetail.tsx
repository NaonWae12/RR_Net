"use client";

import React from "react";
import { Payslip } from "@/lib/api/types";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowDownTrayIcon, PrinterIcon } from "@heroicons/react/20/solid";

interface PayslipDetailProps {
  payslip: Payslip;
  onDownload: (id: string) => void;
  onClose: () => void;
  loading?: boolean;
}

export function PayslipDetail({ payslip, onDownload, onClose, loading = false }: PayslipDetailProps) {
  const periodDate = new Date(payslip.period + "-01");
  const periodLabel = format(periodDate, "MMMM yyyy");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 print:shadow-none">
      {/* Header */}
      <div className="mb-6 print:mb-4">
        <h2 className="text-2xl font-bold text-slate-900">Payslip</h2>
        <p className="text-slate-600 mt-1">{periodLabel}</p>
      </div>


      {/* Breakdown */}
      <div className="space-y-6 mb-6 print:mb-4">
        {/* Base Salary */}
        <div className="border-b border-slate-100 pb-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 font-medium">Base Salary</span>
            <span className="font-bold text-slate-900">
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
              }).format(payslip.base_salary)}
            </span>
          </div>
        </div>

        {/* Allowances */}
        {payslip.items?.some(item => item.type === 'allowance') && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Allowances</h3>
            <div className="space-y-2">
              {payslip.items.filter(item => item.type === 'allowance').map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.description}</span>
                  <span className="font-medium text-slate-900">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                    }).format(item.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-1 border-t border-slate-50">
                <span className="font-semibold text-slate-900">Total Allowances</span>
                <span className="font-bold text-indigo-600">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    minimumFractionDigits: 0,
                  }).format(payslip.total_allowances)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Reimbursements */}
        {payslip.items?.some(item => item.type === 'reimbursement') && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Reimbursements</h3>
            <div className="space-y-2">
              {payslip.items.filter(item => item.type === 'reimbursement').map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.description}</span>
                  <span className="font-medium text-slate-900">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                    }).format(item.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-1 border-t border-slate-50">
                <span className="font-semibold text-slate-900">Total Reimbursements</span>
                <span className="font-bold text-emerald-600">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    minimumFractionDigits: 0,
                  }).format(payslip.total_reimbursements)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Deductions */}
        {payslip.items?.some(item => item.type === 'deduction') && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Deductions</h3>
            <div className="space-y-2">
              {payslip.items.filter(item => item.type === 'deduction').map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.description}</span>
                  <span className="font-medium text-red-600">
                    -{new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                    }).format(item.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-1 border-t border-slate-50">
                <span className="font-semibold text-slate-900">Total Deductions</span>
                <span className="font-bold text-red-700">
                  -{new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    minimumFractionDigits: 0,
                  }).format(payslip.total_deductions)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="bg-slate-900 rounded-xl p-6 text-white mb-6 print:bg-slate-100 print:text-slate-900">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Net Take Home Pay</p>
            <p className="text-3xl font-black">
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
              }).format(payslip.net_salary)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Status</p>
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
              payslip.status === "paid" ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
            }`}>
              {payslip.status === "paid" ? "Paid" : "Pending"}
            </span>
          </div>
        </div>
        {payslip.paid_at && (
          <p className="text-[10px] text-slate-500 mt-4 text-center border-t border-slate-800 pt-3">
            Payment confirmed on {format(new Date(payslip.paid_at), "PPP p")}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 print:hidden">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Close
        </Button>
        <Button variant="outline" onClick={handlePrint} className="flex-1">
          <PrinterIcon className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button
          variant="default"
          onClick={() => onDownload(payslip.id)}
          disabled={loading}
          className="flex-1"
        >
          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>
    </div>
  );
}

