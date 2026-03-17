"use client";

import { RoleGuard } from "@/components/guards/RoleGuard";
import { ReimbursementTab } from "@/components/hr";

export default function HRReimbursementsPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Reimbursement Approval</h1>
          <p className="text-slate-500 mt-1">
            Review and manage employee reimbursement requests
          </p>
        </div>
        <ReimbursementTab />
      </div>
    </RoleGuard>
  );
}
