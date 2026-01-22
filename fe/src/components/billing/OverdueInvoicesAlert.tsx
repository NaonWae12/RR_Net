"use client";

import { Invoice } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

interface OverdueInvoicesAlertProps {
  invoices: Invoice[] | null | undefined;
}

export function OverdueInvoicesAlert({ invoices }: OverdueInvoicesAlertProps) {
  const router = useRouter();

  if (!invoices || invoices.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <div className="flex items-start">
        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {invoices.length} Overdue Invoice{invoices.length > 1 ? "s" : ""}
          </h3>
          <p className="text-sm text-red-700 mt-1">
            You have {invoices.length} invoice{invoices.length > 1 ? "s" : ""} that are past due date.
          </p>
          <button
            onClick={() => router.push("/billing?tab=invoices&status=overdue")}
            className="text-sm font-medium text-red-800 hover:text-red-900 mt-2 underline"
          >
            View overdue invoices →
          </button>
        </div>
      </div>
    </div>
  );
}

