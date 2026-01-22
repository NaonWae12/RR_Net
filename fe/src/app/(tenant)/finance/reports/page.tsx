"use client";

import { RoleGuard } from "@/components/guards/RoleGuard";
import { ReportsTab } from "@/components/finance";

export default function FinanceReportsPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "finance"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Financial Reports</h1>
          <p className="text-slate-500 mt-1">
            Generate and export financial reports
          </p>
        </div>
        <ReportsTab />
      </div>
    </RoleGuard>
  );
}

