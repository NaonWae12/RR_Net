"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { hrService } from "@/lib/api/hrService";
import { useNotificationStore } from "@/stores/notificationStore";

export function AttendanceTab() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [employeeFilter, setEmployeeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { showToast } = useNotificationStore();

  const fetchData = async () => {
    try {
      setLoading(true);
      const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      const data = await hrService.getAttendanceRecords(start, end);
      setRecords(data || []);
    } catch (err: any) {
      showToast({
        title: "Error fetching attendance",
        description: err?.message || "Could not load attendance records",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const formatDateLabel = (date: Date) => {
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
      case "checked_in":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#eef2ff] text-[#4f46e5] border border-[#c7d2fe]">
            Checked In
          </span>
        );
      case "checked_out":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0]">
            Completed
          </span>
        );
      case "absent":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]">
            Absent
          </span>
        );
      case "on_leave":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#fffbeb] text-[#f59e0b] border border-[#fef3c7]">
            On Leave
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#f8fafc] text-[#64748b] border border-[#e2e8f0]">
            {status}
          </span>
        );
    }
  };

  const filteredRecords = records.filter((record) => {
    if (employeeFilter && !record.user_name?.toLowerCase().includes(employeeFilter.toLowerCase())) {
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
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-xl p-5 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col md:flex-row gap-5 items-end">
          <div className="flex-1">
            <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Month Period</label>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePreviousMonth}
                className="border-[#e2e8f0] hover:bg-[#f1f5f9] text-[#0f172a]"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </Button>
              <Input
                type="month"
                value={formatDateLabel(currentMonth)}
                onChange={(e) => setCurrentMonth(new Date(e.target.value + "-01"))}
                className="flex-1 border-[#e2e8f0] focus:ring-[#4f46e5] h-9 text-sm font-semibold text-[#0f172a]"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNextMonth}
                className="border-[#e2e8f0] hover:bg-[#f1f5f9] text-[#0f172a]"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Employee Search</label>
            <Input
              type="text"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              placeholder="Start typing..."
              className="border-[#e2e8f0] focus:ring-[#4f46e5] h-9 text-sm text-[#0f172a]"
            />
          </div>
          <div className="w-full md:w-48">
            <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Filter Status</label>
            <SimpleSelect 
              value={statusFilter} 
              onValueChange={setStatusFilter}
              className="border-[#e2e8f0] focus:ring-[#4f46e5] h-9 text-sm font-semibold text-[#0f172a]"
            >
              <option value="all">All Status</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Completed</option>
              <option value="absent">Absent</option>
              <option value="on_leave">On Leave</option>
            </SimpleSelect>
          </div>
        </div>
      </div>

      {/* Attendance Records */}
      <div className="bg-[#ffffff] border border-[#e2e8f0] rounded-xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]">
        <div className="px-6 py-5 bg-gradient-to-r from-[#f8fafc] to-[#ffffff] border-b border-[#e2e8f0] flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#0f172a]">Attendance Records</h2>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={fetchData} 
              disabled={loading}
              className="border-[#e2e8f0] text-[#0f172a] hover:bg-[#f1f5f9] font-semibold"
            >
              Refresh
            </Button>
            <Button className="bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold px-6 shadow-md transition-all">
              Export CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size={40} />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-20 bg-[#f8fafc]">
            <p className="text-xl font-bold text-[#cbd5e1]">No records found</p>
            <p className="text-sm text-[#94a3b8] mt-2">Try adjusting your filters or checking another date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] uppercase tracking-widest">Employee Information</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] uppercase tracking-widest">Work Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] uppercase tracking-widest">Check In</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] uppercase tracking-widest">Check Out</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-[#64748b] uppercase tracking-widest">Duration</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#64748b] uppercase tracking-widest">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-[#f8fafc] transition-all group">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="text-sm font-bold text-[#0f172a] group-hover:text-[#4f46e5] transition-colors">{record.user_name}</div>
                      <div className="text-xs font-mono text-[#94a3b8]">{record.user_id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-semibold text-[#334155]">
                      {format(new Date(record.date), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-[#475569]">
                      <span className="bg-[#f1f5f9] px-2 py-1 rounded border border-[#e2e8f0]">
                        {record.check_in_time ? format(new Date(record.check_in_time), "HH:mm") : "--:--"}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-medium text-[#475569]">
                      <span className="bg-[#f1f5f9] px-2 py-1 rounded border border-[#e2e8f0]">
                        {record.check_out_time ? format(new Date(record.check_out_time), "HH:mm") : "--:--"}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-sm font-bold text-[#0f172a] text-center">
                      <div className="bg-[#eef2ff] text-[#4f46e5] rounded-lg py-1 border border-[#c7d2fe]">
                        {record.total_hours ? `${record.total_hours.toFixed(1)}h` : "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(record.status)}</td>
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
