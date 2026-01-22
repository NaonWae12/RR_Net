"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format } from "date-fns";
import { useBillingStore } from "@/stores/billingStore";
import { LineChart } from "@/components/charts/LineChart";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import {
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ChartBarIcon,
} from "@heroicons/react/20/solid";

// Mock data untuk charts (akan diganti dengan API call)
const mockRevenueTrend = [
  { month: "Jan", revenue: 45000000 },
  { month: "Feb", revenue: 52000000 },
  { month: "Mar", revenue: 48000000 },
  { month: "Apr", revenue: 61000000 },
  { month: "May", revenue: 55000000 },
  { month: "Jun", revenue: 67000000 },
];

const mockPaymentMethods = [
  { name: "Cash", value: 45, color: "#10b981" },
  { name: "Bank Transfer", value: 30, color: "#3b82f6" },
  { name: "E-Wallet", value: 15, color: "#f59e0b" },
  { name: "QRIS", value: 10, color: "#8b5cf6" },
];

const mockMonthlyComparison = [
  { month: "Jan", paid: 45000000, pending: 12000000 },
  { month: "Feb", paid: 52000000, pending: 15000000 },
  { month: "Mar", paid: 48000000, pending: 18000000 },
  { month: "Apr", paid: 61000000, pending: 14000000 },
  { month: "May", paid: 55000000, pending: 16000000 },
  { month: "Jun", paid: 67000000, pending: 13000000 },
];

export function FinanceDashboardTab() {
  const router = useRouter();
  const { summary, loading, fetchBillingSummary, invoices, payments, fetchInvoices, fetchPayments } = useBillingStore();
  const [dashboardLoading, setDashboardLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setDashboardLoading(true);
      try {
        await Promise.all([
          fetchBillingSummary(),
          fetchInvoices(),
          fetchPayments(),
        ]);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setDashboardLoading(false);
      }
    };
    loadData();
  }, [fetchBillingSummary, fetchInvoices, fetchPayments]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const recentInvoices = invoices.slice(0, 5);
  const recentPayments = payments.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Total Revenue</div>
              <div className="text-2xl font-bold text-green-600 mt-1">
                {summary ? formatCurrency(summary.total_revenue) : formatCurrency(0)}
              </div>
              <div className="text-xs text-slate-500 mt-1">This month</div>
            </div>
            <CurrencyDollarIcon className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Pending Payments</div>
              <div className="text-2xl font-bold text-yellow-600 mt-1">
                {summary ? formatCurrency(summary.pending_amount) : formatCurrency(0)}
              </div>
              <div className="text-xs text-slate-500 mt-1">{summary?.pending_invoices || 0} invoices</div>
            </div>
            <ClockIcon className="w-10 h-10 text-yellow-400" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Paid Amount</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {summary ? formatCurrency(summary.collected_this_month) : formatCurrency(0)}
              </div>
              <div className="text-xs text-slate-500 mt-1">This month</div>
            </div>
            <CheckCircleIcon className="w-10 h-10 text-blue-400" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Overdue Amount</div>
              <div className="text-2xl font-bold text-red-600 mt-1">
                {summary ? formatCurrency(summary.overdue_amount || 0) : formatCurrency(0)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Requires attention</div>
            </div>
            <ExclamationTriangleIcon className="w-10 h-10 text-red-400" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Revenue Trend</h2>
          <LineChart
            data={mockRevenueTrend}
            xAxis={{ dataKey: "month", label: "Month" }}
            yAxis={{
              dataKey: "revenue",
              label: "Revenue (IDR)",
              tickFormatter: (value) => formatCurrency(value),
            }}
            lines={[
              {
                dataKey: "revenue",
                name: "Revenue",
                stroke: "#10b981",
                strokeWidth: 2,
              },
            ]}
            height={300}
          />
        </div>

        {/* Payment Methods Distribution */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment Methods Distribution</h2>
          <PieChart
            data={mockPaymentMethods}
            donut={true}
            showPercentages={true}
            height={300}
            legend={{ show: true, position: "right" }}
          />
        </div>
      </div>

      {/* Monthly Comparison */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Monthly Comparison</h2>
        <BarChart
          data={mockMonthlyComparison}
          xAxisKey="month"
          bars={[
            { dataKey: "paid", name: "Paid", fill: "#10b981" },
            { dataKey: "pending", name: "Pending", fill: "#f59e0b" },
          ]}
          grouped={true}
          height={300}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/finance/invoices")}
            className="justify-start"
          >
            <DocumentTextIcon className="w-5 h-5 mr-2" />
            Manage Invoices
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/finance/payments")}
            className="justify-start"
          >
            <CurrencyDollarIcon className="w-5 h-5 mr-2" />
            View Payments
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/finance/reports")}
            className="justify-start"
          >
            <ChartBarIcon className="w-5 h-5 mr-2" />
            Generate Report
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/settlement")}
            className="justify-start"
          >
            <CheckCircleIcon className="w-5 h-5 mr-2" />
            View Settlement
          </Button>
        </div>
      </div>

      {/* Recent Invoices & Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Invoices</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/finance/invoices")}
            >
              View All
            </Button>
          </div>
          <div className="overflow-x-auto">
            {dashboardLoading ? (
              <div className="flex justify-center items-center h-32">
                <LoadingSpinner size={32} />
              </div>
            ) : recentInvoices.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No invoices found</div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoice</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {recentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {invoice.client_name || invoice.client_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {formatCurrency(invoice.total_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border ${
                            invoice.status === "paid"
                              ? "bg-green-100 text-green-800 border-green-200"
                              : invoice.status === "pending"
                              ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                              : "bg-red-100 text-red-800 border-red-200"
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Payments</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/finance/payments")}
            >
              View All
            </Button>
          </div>
          <div className="overflow-x-auto">
            {dashboardLoading ? (
              <div className="flex justify-center items-center h-32">
                <LoadingSpinner size={32} />
              </div>
            ) : recentPayments.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No payments found</div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {recentPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {format(new Date(payment.received_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {payment.client_name || payment.client_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                          {payment.method}
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
    </div>
  );
}

