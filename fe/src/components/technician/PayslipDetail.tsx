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

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6 print:mb-4">
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm text-slate-600">Gross Salary</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              minimumFractionDigits: 0,
            }).format(payslip.gross_salary)}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm text-slate-600">Net Salary</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              minimumFractionDigits: 0,
            }).format(payslip.net_salary)}
          </p>
        </div>
      </div>

      {/* Breakdown */}
      {payslip.breakdown && (
        <div className="space-y-4 mb-6 print:mb-4">
          {/* Allowances */}
          {payslip.breakdown.allowances && payslip.breakdown.allowances.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Allowances</h3>
              <div className="space-y-2">
                {payslip.breakdown.allowances.map((allowance, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-slate-600">{allowance.name}</span>
                    <span className="font-medium text-slate-900">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        minimumFractionDigits: 0,
                      }).format(allowance.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deductions */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Deductions</h3>
            <div className="space-y-2">
              {payslip.breakdown.tax && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Tax</span>
                  <span className="font-medium text-slate-900">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                    }).format(payslip.breakdown.tax)}
                  </span>
                </div>
              )}
              {payslip.breakdown.insurance && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Insurance</span>
                  <span className="font-medium text-slate-900">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                    }).format(payslip.breakdown.insurance)}
                  </span>
                </div>
              )}
              {payslip.breakdown.other_deductions &&
                payslip.breakdown.other_deductions.map((deduction, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-slate-600">{deduction.name}</span>
                    <span className="font-medium text-slate-900">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        minimumFractionDigits: 0,
                      }).format(deduction.amount)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Total Deductions */}
      <div className="border-t border-slate-200 pt-4 mb-6 print:mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Total Deductions</span>
          <span className="font-semibold text-slate-900">
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              minimumFractionDigits: 0,
            }).format(payslip.deductions)}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="mb-6 print:mb-4">
        <p className="text-sm text-slate-600">
          Status:{" "}
          <span
            className={`font-medium ${
              payslip.status === "paid" ? "text-green-600" : "text-amber-600"
            }`}
          >
            {payslip.status === "paid" ? "Paid" : "Generated"}
          </span>
        </p>
        {payslip.paid_at && (
          <p className="text-xs text-slate-500 mt-1">
            Paid on: {format(new Date(payslip.paid_at), "PPp")}
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

