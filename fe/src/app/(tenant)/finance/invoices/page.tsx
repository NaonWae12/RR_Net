"use client";

import { RoleGuard } from "@/components/guards/RoleGuard";
import { InvoicesTab } from "@/components/finance";

export default function FinanceInvoicesPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "finance"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500 mt-1">
            Manage and track all invoices
          </p>
        </div>
        <InvoicesTab />
      </div>
    </RoleGuard>
  );
}

