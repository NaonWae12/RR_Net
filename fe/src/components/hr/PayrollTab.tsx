"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format } from "date-fns";
import { CurrencyDollarIcon, DocumentArrowDownIcon } from "@heroicons/react/20/solid";

// Mock data - akan diganti dengan API call
const mockPayrollRecords = [
  {
    id: "1",
    employeeName: "Budi Santoso",
    employeeId: "emp-1",
    period: "January 2024",
    baseSalary: 5000000,
    allowances: 500000,
    deductions: 200000,
    netSalary: 5300000,
    status: "pending",
  },
  {
    id: "2",
    employeeName: "Siti Nurhaliza",
    employeeId: "emp-2",
    period: "January 2024",
    baseSalary: 4500000,
    allowances: 400000,
    deductions: 150000,
    netSalary: 4750000,
    status: "processed",
  },
  {
    id: "3",
    employeeName: "Ahmad Fauzi",
    employeeId: "emp-3",
    period: "January 2024",
    baseSalary: 4000000,
    allowances: 300000,
    deductions: 100000,
    netSalary: 4200000,
    status: "processed",
  },
];

export function PayrollTab() {
  const [loading, setLoading] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">
            Processed
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800 border border-yellow-200">
            Pending
          </span>
        );
      default:
        return null;
    }
  };

  const filteredRecords = mockPayrollRecords.filter((record) => {
    if (periodFilter && !record.period.toLowerCase().includes(periodFilter.toLowerCase())) {
      return false;
    }
    if (statusFilter !== "all" && record.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const totalNetSalary = filteredRecords.reduce((sum, record) => sum + record.netSalary, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-slate-500">Total Employees</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{filteredRecords.length}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Total Net Salary</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalNetSalary)}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Pending Processing</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">
              {filteredRecords.filter((r) => r.status === "pending").length}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Period</label>
            <Input
              type="text"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              placeholder="Search period..."
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <SimpleSelect value={statusFilter} onValueChange={setStatusFilter}>
              <option value="all" className="text-slate-900 bg-white">All Status</option>
              <option value="pending" className="text-slate-900 bg-white">Pending</option>
              <option value="processed" className="text-slate-900 bg-white">Processed</option>
            </SimpleSelect>
          </div>
          <div>
            <Button variant="outline">
              <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
              Generate Payslips
            </Button>
          </div>
        </div>
      </div>

      {/* Payroll Records */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Payroll Records</h2>
          <Button variant="outline" size="sm">
            Export
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No payroll records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Period</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Base Salary</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Allowances</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Deductions</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Net Salary</th>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{record.period}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-900">
                      {formatCurrency(record.baseSalary)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                      +{formatCurrency(record.allowances)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                      -{formatCurrency(record.deductions)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-slate-900">
                      {formatCurrency(record.netSalary)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(record.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                        {record.status === "processed" && (
                          <Button variant="outline" size="sm">
                            <DocumentArrowDownIcon className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
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


