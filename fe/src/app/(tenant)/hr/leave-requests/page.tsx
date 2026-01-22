"use client";

import { RoleGuard } from "@/components/guards/RoleGuard";
import { LeaveRequestsTab } from "@/components/hr";

export default function HRLeaveRequestsPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Leave Requests (Cuti)</h1>
          <p className="text-slate-500 mt-1">
            Review and manage employee leave requests
          </p>
        </div>
        <LeaveRequestsTab />
      </div>
    </RoleGuard>
  );
}

