"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { hrService } from "@/lib/api/hrService";
import { TimeOff } from "@/lib/api/types";
import { format, parseISO } from "date-fns";
import {
  UserGroupIcon,
  ClockIcon,
  DocumentCheckIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/20/solid";

interface DashboardSummary {
  totalEmployees: number;
  activeEmployees: number;
  pendingLeaveRequests: number;
  attendanceToday: number;
  payrollPending: number;
  pendingReimbursements: number;
}

export function HRDashboardTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary>({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingLeaveRequests: 0,
    attendanceToday: 0,
    payrollPending: 0,
    pendingReimbursements: 0,
  });
  const [recentLeaveRequests, setRecentLeaveRequests] = useState<TimeOff[]>([]);
  const [alerts, setAlerts] = useState<{ type: string; message: string }[]>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch pending leave requests
      const pendingLeaves = await hrService.getTimeOffs("pending_approval");
      const allLeaves = await hrService.getTimeOffs();
      
      // Fetch pending reimbursements
      const pendingReimbursements = await hrService.getReimbursements("pending_approval");

      // Update summary
      setSummary({
        totalEmployees: 0, // TODO: Add employees API
        activeEmployees: 0, // TODO: Add employees API
        pendingLeaveRequests: pendingLeaves.length,
        attendanceToday: 0, // TODO: Add attendance API
        payrollPending: 0, // TODO: Add payroll API
        pendingReimbursements: pendingReimbursements.length,
      });

      // Get recent leave requests (last 5)
      const recent = allLeaves.slice(0, 5);
      setRecentLeaveRequests(recent);

      // Generate alerts
      const newAlerts: { type: string; message: string }[] = [];
      if (pendingLeaves.length > 0) {
        newAlerts.push({
          type: "info",
          message: `${pendingLeaves.length} leave request${pendingLeaves.length > 1 ? "s" : ""} pending approval`,
        });
      }
      if (pendingReimbursements.length > 0) {
        newAlerts.push({
          type: "info",
          message: `${pendingReimbursements.length} reimbursement${pendingReimbursements.length > 1 ? "s" : ""} pending approval`,
        });
      }
      setAlerts(newAlerts);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "sick":
        return "Sick Leave";
      case "leave":
        return "Annual Leave";
      case "emergency":
        return "Emergency Leave";
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-red-100 text-red-800 border border-red-200">
            Rejected
          </span>
        );
      case "pending_approval":
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800 border border-yellow-200">
            Pending
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Total Employees</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{summary.totalEmployees}</div>
              <div className="text-xs text-slate-500 mt-1">{summary.activeEmployees} active</div>
            </div>
            <UserGroupIcon className="w-10 h-10 text-slate-400" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Attendance Today</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{summary.attendanceToday}</div>
              <div className="text-xs text-slate-500 mt-1">of {summary.activeEmployees} employees</div>
            </div>
            <ClockIcon className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Pending Leave <span className="text-xs">(Cuti)</span></div>
              <div className="text-2xl font-bold text-yellow-600 mt-1">{summary.pendingLeaveRequests}</div>
              <div className="text-xs text-slate-500 mt-1">Requires action</div>
            </div>
            <DocumentCheckIcon className="w-10 h-10 text-yellow-400" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Payroll Pending</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{summary.payrollPending}</div>
              <div className="text-xs text-slate-500 mt-1">This month</div>
            </div>
            <CurrencyDollarIcon className="w-10 h-10 text-blue-400" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Pending Reimbursements</div>
              <div className="text-2xl font-bold text-purple-600 mt-1">{summary.pendingReimbursements}</div>
              <div className="text-xs text-slate-500 mt-1">Requires approval</div>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-yellow-900">Alerts</div>
              <ul className="mt-2 space-y-1">
                {alerts.map((alert, idx) => (
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
            className="justify-start shadow-sm border-slate-200"
          >
            <CurrencyDollarIcon className="w-5 h-5 mr-2" />
            Process Payroll
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/hr/reimbursements")}
            className="justify-start shadow-sm border-slate-200"
          >
            <div className="w-5 h-5 mr-2">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            Review Reimbursements
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
          {recentLeaveRequests.length === 0 ? (
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
                {recentLeaveRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {request.user_name || "Unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{getTypeLabel(request.type)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(parseISO(request.start_date), "MMM d")} - {format(parseISO(request.end_date), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(request.status)}
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


