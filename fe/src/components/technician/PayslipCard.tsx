"use client";

import React from "react";
import { Payslip } from "@/lib/api/types";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowDownTrayIcon } from "@heroicons/react/20/solid";

interface PayslipCardProps {
  payslip: Payslip;
  onView: (id: string) => void;
  onDownload: (id: string) => void;
  loading?: boolean;
}

export function PayslipCard({ payslip, onView, onDownload, loading = false }: PayslipCardProps) {
  const periodDate = new Date(payslip.period + "-01");
  const periodLabel = format(periodDate, "MMMM yyyy");

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{periodLabel}</h3>
          <p className="text-sm text-slate-600 mt-1">
            Status:{" "}
            <span
              className={`font-medium ${
                payslip.status === "paid" ? "text-green-600" : "text-amber-600"
              }`}
            >
              {payslip.status === "paid" ? "Paid" : "Generated"}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-600">Net Salary</p>
          <p className="text-2xl font-bold text-slate-900">
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              minimumFractionDigits: 0,
            }).format(payslip.net_salary)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <p className="text-slate-600">Gross Salary</p>
          <p className="font-medium text-slate-900">
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              minimumFractionDigits: 0,
            }).format(payslip.gross_salary)}
          </p>
        </div>
        <div>
          <p className="text-slate-600">Deductions</p>
          <p className="font-medium text-slate-900">
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              minimumFractionDigits: 0,
            }).format(payslip.deductions)}
          </p>
        </div>
      </div>

      {payslip.paid_at && (
        <p className="text-xs text-slate-500 mb-4">
          Paid on: {format(new Date(payslip.paid_at), "PPp")}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onView(payslip.id)} className="flex-1">
          View Details
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => onDownload(payslip.id)}
          disabled={loading}
          className="flex-1"
        >
          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>
    </div>
  );
}

