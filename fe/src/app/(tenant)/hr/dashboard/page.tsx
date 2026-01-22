"use client";

import { RoleGuard } from "@/components/guards/RoleGuard";
import { HRDashboardTab } from "@/components/hr";

export default function HRDashboardPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">HR Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Overview of employees, attendance, leave requests, and payroll
          </p>
        </div>
        <HRDashboardTab />
      </div>
    </RoleGuard>
  );
}

