"use client";

import { useState } from "react";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { AttendanceTab, AttendanceSettingsTab } from "@/components/hr";

export default function HRAttendancePage() {
  const [activeTab, setActiveTab] = useState<"records" | "settings">("records");

  return (
    <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Attendance Management</h1>
            <p className="text-slate-500 mt-1">
              View and manage employee attendance records and configuration
            </p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-lg self-start">
            <button
              onClick={() => setActiveTab("records")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === "records"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
              }`}
            >
              Attendance Records
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === "settings"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200"
              }`}
            >
              Settings
            </button>
          </div>
        </div>

        {activeTab === "records" ? <AttendanceTab /> : <AttendanceSettingsTab />}
      </div>
    </RoleGuard>
  );
}
