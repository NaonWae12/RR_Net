"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon } from "@heroicons/react/20/solid";

// Mock data - akan diganti dengan API call
const mockAttendanceRecords = [
  {
    id: "1",
    employeeName: "Budi Santoso",
    employeeId: "emp-1",
    date: new Date(),
    checkIn: "08:00",
    checkOut: "17:00",
    status: "present",
  },
  {
    id: "2",
    employeeName: "Siti Nurhaliza",
    employeeId: "emp-2",
    date: new Date(),
    checkIn: "08:15",
    checkOut: null,
    status: "present",
  },
  {
    id: "3",
    employeeName: "Ahmad Fauzi",
    employeeId: "emp-3",
    date: new Date(),
    checkIn: null,
    checkOut: null,
    status: "absent",
  },
];

export function AttendanceTab() {
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [employeeFilter, setEmployeeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const formatDate = (date: Date) => {
    return format(date, "yyyy-MM");
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">
            Present
          </span>
        );
      case "absent":
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-red-100 text-red-800 border border-red-200">
            Absent
          </span>
        );
      case "late":
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800 border border-yellow-200">
            Late
          </span>
        );
      default:
        return null;
    }
  };

  const filteredRecords = mockAttendanceRecords.filter((record) => {
    if (employeeFilter && !record.employeeName.toLowerCase().includes(employeeFilter.toLowerCase())) {
      return false;
    }
    if (statusFilter !== "all" && record.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                <ChevronLeftIcon className="w-4 h-4" />
              </Button>
              <Input
                type="month"
                value={formatDate(currentMonth)}
                onChange={(e) => setCurrentMonth(new Date(e.target.value + "-01"))}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleNextMonth}>
                <ChevronRightIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
            <Input
              type="text"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              placeholder="Search employee..."
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <SimpleSelect value={statusFilter} onValueChange={setStatusFilter}>
              <option value="all" className="text-slate-900 bg-white">All Status</option>
              <option value="present" className="text-slate-900 bg-white">Present</option>
              <option value="absent" className="text-slate-900 bg-white">Absent</option>
              <option value="late" className="text-slate-900 bg-white">Late</option>
            </SimpleSelect>
          </div>
        </div>
      </div>

      {/* Attendance Records */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Attendance Records</h2>
          <Button variant="outline" size="sm">
            Export
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No attendance records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Check In</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Check Out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {record.employeeName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {format(record.date, "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {record.checkIn || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {record.checkOut || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(record.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


