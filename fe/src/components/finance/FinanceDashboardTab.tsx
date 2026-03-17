"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { format, subMonths, startOfDay, endOfDay, addDays } from "date-fns";
import { useBillingStore } from "@/stores/billingStore";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import {
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ChartBarIcon,
  BanknotesIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/20/solid";
import { billingService } from "@/lib/api/billingService";
import { RevenueAnalytics } from "@/lib/api/types";

export function FinanceDashboardTab() {
  const router = useRouter();
  const { summary, loading, fetchBillingSummary, invoices, payments, fetchInvoices, fetchPayments } = useBillingStore();
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [revenueAnalytics, setRevenueAnalytics] = useState<RevenueAnalytics | null>(null);
  const [revenueInterval, setRevenueInterval] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

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

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoadingAnalytics(true);
      try {
        const data = await billingService.getRevenueAnalytics({
          interval: revenueInterval,
          start_date: format(subMonths(new Date(), 6), "yyyy-MM-dd"),
          end_date: format(new Date(), "yyyy-MM-dd"),
        });
        setRevenueAnalytics(data);
      } catch (error) {
        console.error("Failed to fetch revenue analytics:", error);
      } finally {
        setLoadingAnalytics(false);
      }
    };
    fetchAnalytics();
  }, [revenueInterval]);

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
              <div className="text-xs text-slate-500 mt-1">This year</div>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Revenue Trend</h2>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-md">
                {(["daily", "weekly", "monthly", "yearly"] as const).map((inv) => (
                  <button
                    key={inv}
                    onClick={() => setRevenueInterval(inv)}
                    className={cn(
                      "px-2 py-1 text-xs font-medium rounded capitalize",
                      revenueInterval === inv
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {inv.charAt(0)}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-indigo-600 hover:text-indigo-700 text-xs gap-1"
                onClick={() => router.push("/finance/reports/revenue-analytics")}
              >
                Details
                <ArrowTopRightOnSquareIcon className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <AreaChart
            data={revenueAnalytics?.trend || []}
            loading={loadingAnalytics}
            xAxis={{ 
              dataKey: "date", 
              tickFormatter: (val) => {
                try {
                  const d = new Date(val);
                  if (revenueInterval === "daily") return format(d, "d MMM");
                  if (revenueInterval === "weekly") return format(d, "d MMM"); // Show start date of week
                  if (revenueInterval === "monthly") return format(d, "MMM");
                  if (revenueInterval === "yearly") return format(d, "yyyy");
                  return format(d, "MMM");
                } catch (e) {
                  return val;
                }
              }
            }}
            yAxis={{
              dataKey: "amount",
              tickFormatter: (value) => {
                if (value >= 1000000000000) return `${(value / 1000000000000).toFixed(1)} T`;
                if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)} M`;
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)} jt`;
                if (value >= 1000) return `${(value / 1000).toFixed(0)} k`;
                return value.toString();
              },
            }}
            areas={[
              {
                dataKey: "amount",
                name: "Revenue",
                color: "#10b981",
                strokeWidth: 3,
              },
            ]}
            tooltip={{
              show: true,
              formatter: (value: any) => [formatCurrency(value), "Revenue"],
              labelFormatter: (label: any) => {
                try {
                  const d = new Date(label);
                  if (revenueInterval === "daily") return format(d, "EEEE, d MMMM yyyy");
                  if (revenueInterval === "weekly") {
                    const end = addDays(d, 6);
                    return `Minggu ${format(d, "w")}: ${format(d, "d MMM")} - ${format(end, "d MMM yyyy")}`;
                  }
                  if (revenueInterval === "monthly") return format(d, "MMMM yyyy");
                  if (revenueInterval === "yearly") return format(d, "yyyy");
                  return format(d, "d MMMM yyyy");
                } catch (e) {
                  return label;
                }
              }
            }}
            height={300}
          />
        </div>

        {/* Connection Type Distribution */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Connection Type Revenue</h2>
          <PieChart
            data={revenueAnalytics?.by_connection_type?.map(c => ({
              name: c.connection_type.toUpperCase(),
              value: c.amount,
              color: c.connection_type === 'pppoe' ? '#3b82f6' : '#f59e0b'
            })) || []}
            donut={true}
            loading={loadingAnalytics}
            height={300}
            subtitle="Berdasarkan periode waktu yang dipilih"
            legend={{ show: true, position: "bottom" }}
            tooltip={{
              show: true,
              formatter: (value: any) => [formatCurrency(value as number), "Revenue"],
            }}
          />
        </div>
      </div>

      {/* Revenue by Client Group */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Revenue by Client Group</h2>
        <BarChart
          data={revenueAnalytics?.by_group?.map(g => ({ name: g.group_name, revenue: g.amount })) || []}
          xAxisKey="name"
          loading={loadingAnalytics}
          subtitle="Berdasarkan periode waktu yang dipilih"
          bars={[
            { dataKey: "revenue", name: "Revenue", fill: "#10b981" },
          ]}
          height={300}
          tooltip={{
            show: true,
            formatter: (value: any) => [formatCurrency(value as number), "Revenue"],
          }}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/finance/invoices")}
            className="justify-start border-slate-200 hover:bg-slate-50"
          >
            <DocumentTextIcon className="w-5 h-5 mr-2 text-indigo-500" />
            Invoices
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/finance/payments")}
            className="justify-start border-slate-200 hover:bg-slate-50"
          >
            <CurrencyDollarIcon className="w-5 h-5 mr-2 text-emerald-500" />
            Payments
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/finance/expenses")}
            className="justify-start border-slate-200 hover:bg-slate-50"
          >
            <BanknotesIcon className="w-5 h-5 mr-2 text-red-500" />
            Expenses
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/finance/inventory")}
            className="justify-start border-slate-200 hover:bg-slate-50"
          >
            <ChartBarIcon className="w-5 h-5 mr-2 text-amber-500" />
            Inventory
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/finance/reports")}
            className="justify-start border-slate-200 hover:bg-slate-50"
          >
            <ChartBarIcon className="w-5 h-5 mr-2 text-blue-500" />
            Reports
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

