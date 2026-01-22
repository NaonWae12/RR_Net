"use client";

import { RoleGuard } from "@/components/guards/RoleGuard";
import { FinanceDashboardTab } from "@/components/finance";

export default function FinanceDashboardPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "finance"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Finance Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Overview of financial metrics and recent activities
          </p>
        </div>
        <FinanceDashboardTab />
      </div>
    </RoleGuard>
  );
}

