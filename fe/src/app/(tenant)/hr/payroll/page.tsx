"use client";

import { RoleGuard } from "@/components/guards/RoleGuard";
import { PayrollTab } from "@/components/hr";

export default function HRPayrollPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Payroll Management</h1>
          <p className="text-slate-500 mt-1">
            Process and manage employee payroll
          </p>
        </div>
        <PayrollTab />
      </div>
    </RoleGuard>
  );
}

