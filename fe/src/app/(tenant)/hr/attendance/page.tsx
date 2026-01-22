"use client";

import { RoleGuard } from "@/components/guards/RoleGuard";
import { AttendanceTab } from "@/components/hr";

export default function HRAttendancePage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Attendance Management</h1>
          <p className="text-slate-500 mt-1">
            View and manage employee attendance records
          </p>
        </div>
        <AttendanceTab />
      </div>
    </RoleGuard>
  );
}

