"use client";

import { useRouter } from "next/navigation";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { EmployeesTab } from "@/components/hr";

export default function HREmployeesPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Employee Management</h1>
          <p className="text-slate-500 mt-1">
            Manage employees and user accounts
          </p>
        </div>
        <EmployeesTab />
      </div>
    </RoleGuard>
  );
}

