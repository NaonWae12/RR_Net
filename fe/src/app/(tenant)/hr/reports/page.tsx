"use client";

import { RoleGuard } from "@/components/guards/RoleGuard";
import { ReportsTab } from "@/components/hr";

export default function HRReportsPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">HR Reports</h1>
          <p className="text-slate-500 mt-1">
            Generate and view HR-related reports
          </p>
        </div>
        <ReportsTab />
      </div>
    </RoleGuard>
  );
}

