"use client";

import { RoleGuard } from "@/components/guards/RoleGuard";
import { PaymentsTab } from "@/components/finance";

export default function FinancePaymentsPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "finance"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-slate-500 mt-1">
            View and manage payment records
          </p>
        </div>
        <PaymentsTab />
      </div>
    </RoleGuard>
  );
}

