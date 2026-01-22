"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format } from "date-fns";
import {
  UserGroupIcon,
  ClockIcon,
  DocumentCheckIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/20/solid";

// Mock data - akan diganti dengan API call
const mockSummary = {
  totalEmployees: 25,
  activeEmployees: 23,
  pendingLeaveRequests: 5,
  attendanceToday: 20,
  payrollPending: 3,
  alerts: [
    { type: "warning", message: "3 employees have not checked in today" },
    { type: "info", message: "5 leave requests pending approval" },
  ],
};

const mockRecentLeaveRequests = [
  {
    id: "1",
    employeeName: "Budi Santoso",
    type: "Sick Leave",
    dateFrom: new Date(),
    dateTo: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    status: "pending",
  },
  {
    id: "2",
    employeeName: "Siti Nurhaliza",
    type: "Annual Leave",
    dateFrom: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    dateTo: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    status: "pending",
  },
];

export function HRDashboardTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Total Employees</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{mockSummary.totalEmployees}</div>
              <div className="text-xs text-slate-500 mt-1">{mockSummary.activeEmployees} active</div>
            </div>
            <UserGroupIcon className="w-10 h-10 text-slate-400" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Attendance Today</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{mockSummary.attendanceToday}</div>
              <div className="text-xs text-slate-500 mt-1">of {mockSummary.activeEmployees} employees</div>
            </div>
            <ClockIcon className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Pending Leave <span className="text-xs">(Cuti)</span></div>
              <div className="text-2xl font-bold text-yellow-600 mt-1">{mockSummary.pendingLeaveRequests}</div>
              <div className="text-xs text-slate-500 mt-1">Requires action</div>
            </div>
            <DocumentCheckIcon className="w-10 h-10 text-yellow-400" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Payroll Pending</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{mockSummary.payrollPending}</div>
              <div className="text-xs text-slate-500 mt-1">This month</div>
            </div>
            <CurrencyDollarIcon className="w-10 h-10 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {mockSummary.alerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-yellow-900">Alerts</div>
              <ul className="mt-2 space-y-1">
                {mockSummary.alerts.map((alert, idx) => (
                  <li key={idx} className="text-sm text-yellow-700">
                    • {alert.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/hr/employees")}
            className="justify-start"
          >
            <UserGroupIcon className="w-5 h-5 mr-2" />
            Manage Employees
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/hr/leave-requests")}
            className="justify-start"
          >
            <DocumentCheckIcon className="w-5 h-5 mr-2" />
            Review Leave Requests (Cuti)
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/hr/payroll")}
            className="justify-start"
          >
            <CurrencyDollarIcon className="w-5 h-5 mr-2" />
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Recent Leave Requests */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Leave Requests <span className="text-xs font-normal text-slate-500">(Cuti)</span>
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/hr/leave-requests")}
          >
            View All
          </Button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <LoadingSpinner size={32} />
            </div>
          ) : mockRecentLeaveRequests.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No leave requests</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {mockRecentLeaveRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {request.employeeName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{request.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(request.dateFrom, "MMM d")} - {format(request.dateTo, "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800 border border-yellow-200">
                        {request.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}


