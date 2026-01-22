"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { DocumentChartBarIcon } from "@heroicons/react/20/solid";

export function ReportsTab() {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<string>("attendance");
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const reportTypes = [
    { value: "attendance", label: "Attendance Report" },
    { value: "leave", label: "Leave Report" },
    { value: "payroll", label: "Payroll Report" },
    { value: "employee", label: "Employee Summary" },
  ];

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // In real implementation, this would generate and download the report
      alert(`Report generated: ${reportType} from ${dateFrom} to ${dateTo}`);
    } catch (error: any) {
      console.error("Failed to generate report:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Generator */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <DocumentChartBarIcon className="w-6 h-6 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">Generate Report</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Report Type</label>
            <SimpleSelect value={reportType} onValueChange={setReportType}>
              {reportTypes.map((type) => (
                <option key={type.value} value={type.value} className="text-slate-900 bg-white">
                  {type.label}
                </option>
              ))}
            </SimpleSelect>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Button onClick={handleGenerateReport} disabled={loading} className="w-full md:w-auto">
              {loading ? (
                <>
                  <LoadingSpinner size={16} className="mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <DocumentChartBarIcon className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Report History */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Report History</h2>
        </div>
        <div className="p-6 text-center text-slate-500">
          <p>No reports generated yet. Use the form above to generate your first report.</p>
        </div>
      </div>
    </div>
  );
}


