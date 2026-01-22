"use client";

import { RoleGuard } from "@/components/guards/RoleGuard";
import { DepositsTab } from "@/components/finance";

export default function FinanceDepositsPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "finance"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Deposit Confirmation</h1>
          <p className="text-slate-500 mt-1">
            Review and confirm deposits from collectors
          </p>
        </div>
        <DepositsTab />
      </div>
    </RoleGuard>
  );
}

