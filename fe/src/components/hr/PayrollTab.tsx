"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format } from "date-fns";
import { CurrencyDollarIcon, DocumentArrowDownIcon, PlusIcon } from "@heroicons/react/20/solid";
import { hrService } from "@/lib/api/hrService";
import { employeeService } from "@/lib/api/employeeService";
import { useNotificationStore } from "@/stores/notificationStore";

export function PayrollTab() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [periodFilter, setPeriodFilter] = useState<string>(format(new Date(), "yyyy-MM"));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { showToast } = useNotificationStore();
  
  // New States for Generate Workflow
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [step, setStep] = useState<"search" | "edit">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [linkedReimbursements, setLinkedReimbursements] = useState<any[]>([]);
  const [additionalItems, setAdditionalItems] = useState<{id: string, label: string, amount: number, type: 'allowance' | 'deduction'}[]>([]);
  const [newItem, setNewItem] = useState({ label: "", amount: "", type: "allowance" });

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const data = await hrService.getPayrollRuns();
      console.log('Fetched payroll runs:', data);
      
      // Since the API returns runs which contain payslips, we might need to flatten or handle differently
      // For now, let's assume we want to show payslips from the latest run or filter by period
      const allPayslips: any[] = [];
      data.forEach((run: any) => {
        if (run.payslips) {
          run.payslips.forEach((ps: any) => {
            allPayslips.push({
              ...ps,
              period: run.period,
            });
          });
        }
      });
      console.log('All payslips:', allPayslips);
      setRuns(allPayslips);
    } catch (error: any) {
      console.error('Failed to fetch runs:', error);
      showToast({ title: "Error", description: "Failed to load payroll data", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await employeeService.list();
      setEmployees(res.data || []);
    } catch (error) {
      showToast({ title: "Error", description: "Failed to load employee list", variant: "error" });
    }
  };

  const handleSelectEmployee = async (emp: any) => {
    try {
      setLoading(true);
      const preview = await hrService.getPayslipPreview(emp.id, periodFilter);
      setSelectedEmployee({
        ...emp,
        baseSalary: preview.base_salary
      });
      setLinkedReimbursements(preview.reimbursements || []);
      
      // Reset adjustments if there's an existing payslip
      if (preview.existing) {
        const addons = preview.existing.items
          ?.filter((it: any) => it.type !== 'reimbursement')
          .map((it: any) => ({
            id: it.id,
            label: it.description,
            amount: it.amount,
            type: it.type
          })) || [];
        setAdditionalItems(addons);
      } else {
        setAdditionalItems([]);
      }
      
      setStep("edit");
    } catch (error: any) {
      showToast({ title: "Error", description: "Failed to load payslip preview", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayslip = async () => {
    if (!selectedEmployee) return;
    try {
      setSaving(true);
      const payload = {
        user_id: selectedEmployee.id,
        period: periodFilter,
        allowances: additionalItems.filter(it => it.type === 'allowance').map(it => ({ label: it.label, amount: it.amount })),
        deductions: additionalItems.filter(it => it.type === 'deduction').map(it => ({ label: it.label, amount: it.amount })),
        reimbursement_ids: linkedReimbursements.map(it => it.id)
      };
      console.log('Creating payslip with payload:', payload);
      const result = await hrService.upsertPayslip(payload);
      console.log('Payslip created:', result);
      showToast({ title: "Success", description: "Payslip generated successfully", variant: "success" });
      
      // Reset modal state
      setShowGenerateModal(false);
      setSelectedEmployee(null);
      setLinkedReimbursements([]);
      setAdditionalItems([]);
      setStep("search");
      
      // Refresh data
      await fetchRuns();
    } catch (error: any) {
      console.error('Failed to create payslip:', error);
      showToast({ title: "Error", description: error.response?.data?.error || "Failed to save payslip", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateTotal = () => {
    if (!selectedEmployee) return 0;
    const rbTotal = linkedReimbursements.reduce((sum, item) => sum + item.amount, 0);
    const addonsTotal = additionalItems.reduce((sum, item) => 
      item.type === "allowance" ? sum + item.amount : sum - item.amount, 0
    );
    return selectedEmployee.baseSalary + rbTotal + addonsTotal;
  };

  const handleAddAdditional = () => {
    if (!newItem.label || !newItem.amount) return;
    setAdditionalItems([
      ...additionalItems,
      {
        id: Math.random().toString(),
        label: newItem.label,
        amount: Number(newItem.amount),
        type: newItem.type as "allowance" | "deduction"
      }
    ]);
    setNewItem({ label: "", amount: "", type: "allowance" });
  };

  const removeAdditional = (id: string) => {
    setAdditionalItems(additionalItems.filter(item => item.id !== id));
  };

  const rejectReimbursement = (id: string) => {
    setLinkedReimbursements(linkedReimbursements.filter(item => item.id !== id));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
      case "paid":
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 border border-green-200">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800 border border-yellow-200">
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-800 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "employee", "period", "baseSalary", "allowances", "deductions", "reimbursements", "netSalary", "status", "actions"
  ]);
  const [showColumnFilter, setShowColumnFilter] = useState(false);

  const allColumns = [
    { id: "employee", label: "Employee" },
    { id: "period", label: "Period" },
    { id: "baseSalary", label: "Base Salary" },
    { id: "allowances", label: "Allowances" },
    { id: "deductions", label: "Deductions" },
    { id: "reimbursements", label: "Reimbursements" },
    { id: "netSalary", label: "Net Salary" },
    { id: "status", label: "Status" },
    { id: "actions", label: "Actions" },
  ];

  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(c => c !== columnId)
        : [...prev, columnId]
    );
  };

  const filteredRecords = runs.filter((record) => {
    if (periodFilter && !record.period.toLowerCase().includes(periodFilter.toLowerCase())) {
      return false;
    }
    if (statusFilter !== "all" && record.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const totalNetSalary = filteredRecords.reduce((sum, record) => sum + record.net_salary, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-slate-500">Total Records</div>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Period (YYYY-MM)</label>
            <Input
              type="month"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
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
            <Button variant="outline" onClick={() => {
              setStep("search");
              fetchEmployees();
              setShowGenerateModal(true);
            }}>
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
          <div className="flex items-center gap-2">
            {/* Column Visibility Filter */}
            <div className="relative">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowColumnFilter(!showColumnFilter)}
                className="gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M2 3.75A.75.75 0 012.75 3h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 3.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.166a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                </svg>
                Columns
              </Button>
              
              {showColumnFilter && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowColumnFilter(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-slate-200 z-20 p-2 animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-xs font-semibold text-slate-500 uppercase px-2 py-1 mb-1">Toggle Columns</div>
                    <div className="space-y-1">
                      {allColumns.map(col => (
                        <label key={col.id} className="flex items-center px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={visibleColumns.includes(col.id)}
                            onChange={() => toggleColumn(col.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                          />
                          <span className="text-sm text-slate-700">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <Button variant="outline" size="sm" onClick={fetchRuns} disabled={loading}>
              {loading ? <LoadingSpinner size={16} /> : "Refresh"}
            </Button>
          </div>
        </div>

        {loading && runs.length === 0 ? (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size={40} />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No payroll records found for {periodFilter}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {visibleColumns.includes("employee") && <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Employee</th>}
                  {visibleColumns.includes("period") && <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Period</th>}
                  {visibleColumns.includes("baseSalary") && <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Base Salary</th>}
                  {visibleColumns.includes("allowances") && <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Allowances</th>}
                  {visibleColumns.includes("deductions") && <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Deductions</th>}
                  {visibleColumns.includes("reimbursements") && <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Reimbursements</th>}
                  {visibleColumns.includes("netSalary") && <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Net Salary</th>}
                  {visibleColumns.includes("status") && <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>}
                  {visibleColumns.includes("actions") && <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    {visibleColumns.includes("employee") && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{record.user_name}</td>
                    )}
                    {visibleColumns.includes("period") && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{record.period}</td>
                    )}
                    {visibleColumns.includes("baseSalary") && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-900">{formatCurrency(record.base_salary)}</td>
                    )}
                    {visibleColumns.includes("allowances") && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">+{formatCurrency(record.total_allowances)}</td>
                    )}
                    {visibleColumns.includes("deductions") && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">-{formatCurrency(record.total_deductions)}</td>
                    )}
                    {visibleColumns.includes("reimbursements") && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600">+{formatCurrency(record.total_reimbursements)}</td>
                    )}
                    {visibleColumns.includes("netSalary") && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-slate-900 bg-slate-50/50">{formatCurrency(record.net_salary)}</td>
                    )}
                    {visibleColumns.includes("status") && (
                      <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(record.status)}</td>
                    )}
                    {visibleColumns.includes("actions") && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="h-8">View</Button>
                          {record.status === "processed" && (
                            <Button variant="outline" size="sm" className="h-8 p-1"><DocumentArrowDownIcon className="w-4 h-4" /></Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate Payslips Workflow Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CurrencyDollarIcon className="w-5 h-5 text-indigo-600" />
                {step === "search" ? "Select Employee" : "Review Payslip Details"}
              </h3>
              <button 
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {step === "search" ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type employee name or ID..."
                      className="pl-10 h-12 text-lg"
                    />
                    <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  
                  <div className="grid gap-2">
                    {loading ? (
                      <div className="flex justify-center py-12">
                        <LoadingSpinner size={32} />
                      </div>
                    ) : employees
                      .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(emp => (
                      <button
                        key={emp.id}
                        onClick={() => handleSelectEmployee(emp)}
                        className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{emp.name}</p>
                          <p className="text-sm text-slate-500">{emp.role} • {emp.id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Base Salary</p>
                          <p className="font-mono font-bold text-slate-700">{formatCurrency(emp.base_salary || 0)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                  {/* Employee Info Header */}
                  <div className="flex items-start justify-between bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                    <div>
                      <h4 className="text-xl font-black text-slate-900">{selectedEmployee?.name}</h4>
                      <p className="text-slate-500 font-medium">{selectedEmployee?.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Base Salary</p>
                      <p className="text-2xl font-black text-slate-900">{formatCurrency(selectedEmployee?.baseSalary)}</p>
                    </div>
                  </div>

                  {/* Linked Reimbursements Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-900 flex items-center gap-2">
                        Linked Reimbursements
                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                          {linkedReimbursements.length} items
                        </span>
                      </h5>
                    </div>
                    
                    {linkedReimbursements.length > 0 ? (
                      <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden bg-white shadow-sm">
                        {linkedReimbursements.map(rb => (
                          <div key={rb.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div>
                              <p className="text-sm font-bold text-slate-900">{rb.category}</p>
                              <p className="text-xs text-slate-500">{format(new Date(rb.date), "PP")} • {rb.description}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <p className="font-bold text-slate-700">{formatCurrency(rb.amount)}</p>
                              <button 
                                onClick={() => rejectReimbursement(rb.id)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Reject from payslip"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed text-slate-400 text-sm">
                        No reimbursements linked for this period
                      </div>
                    )}
                  </div>

                  {/* Additional Items Section */}
                  <div className="space-y-4">
                    <h5 className="font-bold text-slate-900">Additional Adjustments</h5>
                    
                    <div 
                      className="grid grid-cols-12 gap-2"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAdditional();
                        }
                      }}
                    >
                      <div className="col-span-5">
                        <Input 
                          placeholder="e.g. Overtime, Tax" 
                          value={newItem.label}
                          onChange={(e) => setNewItem({...newItem, label: e.target.value})}
                          className={newItem.label && !newItem.amount ? "border-indigo-400" : ""}
                          autoFocus
                        />
                      </div>
                      <div className="col-span-3">
                        <Input 
                          type="number" 
                          placeholder="Amount" 
                          value={newItem.amount}
                          onChange={(e) => setNewItem({...newItem, amount: e.target.value})}
                          className={newItem.amount ? "border-indigo-400" : ""}
                        />
                      </div>
                      <div className="col-span-3">
                        <SimpleSelect 
                          value={newItem.type}
                          onValueChange={(val) => setNewItem({...newItem, type: val})}
                        >
                          <option value="allowance">Allowance</option>
                          <option value="deduction">Deduction</option>
                        </SimpleSelect>
                      </div>
                      <div className="col-span-1">
                        <Button 
                          onClick={handleAddAdditional}
                          disabled={!newItem.label || !newItem.amount}
                          className="w-full bg-slate-900 text-white p-0 flex items-center justify-center h-10 hover:bg-slate-800"
                          title="Add Adjustment (Enter)"
                        >
                          <PlusIcon className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Helper text if user typed but didn't add */}
                    {(newItem.label || newItem.amount) && (
                      <p className="text-xs text-amber-600 animate-pulse">
                        * Press Enter or click + to add this adjustment
                      </p>
                    )}

                    {additionalItems.length > 0 && (
                      <div className="space-y-2">
                        {additionalItems.map(item => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${item.type === 'allowance' ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className="font-medium text-slate-700">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`font-bold ${item.type === 'allowance' ? 'text-green-600' : 'text-red-600'}`}>
                                {item.type === 'allowance' ? '+' : '-'}{formatCurrency(item.amount)}
                              </span>
                              <button onClick={() => removeAdditional(item.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Summary Footer */}
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <div className="flex items-center justify-between bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-200">
                      <div>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Total Net Salary</p>
                        <p className="text-xs text-slate-500 mt-1">Calculated automatically</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black">{formatCurrency(calculateTotal())}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  if (step === "edit") setStep("search");
                  else setShowGenerateModal(false);
                }}
                disabled={saving}
              >
                {step === "search" ? "Cancel" : "Back to Search"}
              </Button>
              {step === "edit" && (
                <Button 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8"
                  onClick={handleCreatePayslip}
                  disabled={saving}
                >
                  {saving ? <LoadingSpinner size={16} /> : "Create Payslip"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


