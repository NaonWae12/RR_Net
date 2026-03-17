"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, startOfYear, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import {
  AreaChart,
  BarChart,
  PieChart,
} from "@/components/charts";
import { billingService } from "@/lib/api/billingService";
import { RevenueAnalytics } from "@/lib/api/types";
import { 
  ArrowLeftIcon, 
  FunnelIcon, 
  ArrowDownTrayIcon,
  CalendarIcon
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

export function RevenueAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<RevenueAnalytics | null>(null);
  
  // Filters
  const [interval, setInterval] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const data = await billingService.getRevenueAnalytics({
        interval,
        start_date: startDate,
        end_date: endDate,
      });
      setAnalytics(data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [interval, startDate, endDate]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const percentageGrowth = analytics && analytics.previous_period_total > 0
    ? ((analytics.period_total - analytics.previous_period_total) / analytics.previous_period_total) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-2 -ml-2 text-slate-500 hover:text-slate-900"
            onClick={() => router.back()}
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-slate-900 border-none">Advanced Revenue Analytics</h1>
          <p className="text-slate-500">Detailed breakdown and trends of your revenue</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="hidden sm:flex">
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Time Granularity</label>
            <SimpleSelect
              value={interval}
              onChange={(val) => setInterval(val as any)}
              options={[
                { label: "Daily", value: "daily" },
                { label: "Weekly", value: "weekly" },
                { label: "Monthly", value: "monthly" },
                { label: "Yearly", value: "yearly" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Button 
              className="w-full bg-slate-900 text-white hover:bg-slate-800"
              onClick={fetchAnalytics}
              disabled={loading}
            >
              {loading ? <LoadingSpinner size={16} className="mr-2" /> : <FunnelIcon className="w-4 h-4 mr-2" />}
              Apply Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Total Revenue in Period</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-3xl font-bold text-slate-900">
              {analytics ? formatCurrency(analytics.period_total) : "..."}
            </h3>
            {analytics && (
              <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${percentageGrowth >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {percentageGrowth >= 0 ? "+" : ""}{percentageGrowth.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">vs previous period ({analytics ? formatCurrency(analytics.previous_period_total) : "..."})</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Avg. Revenue / {interval === "daily" ? "Day" : interval === "weekly" ? "Week" : "Month"}</p>
          <div className="mt-2 flex items-baseline">
            <h3 className="text-3xl font-bold text-slate-900">
              {analytics && analytics.trend.length > 0 
                ? formatCurrency(analytics.period_total / analytics.trend.length)
                : "..."}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-2">Based on {analytics?.trend.length || 0} data points</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Peak Revenue Period</p>
          <div className="mt-2 flex items-baseline">
            <h3 className="text-3xl font-bold text-slate-900">
              {analytics && analytics.trend.length > 0
                ? formatCurrency(Math.max(...analytics.trend.map(t => t.amount)))
                : "..."}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-2">Heaviest collection period</p>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900">Revenue Flow Trend</h2>
            <div className="flex items-center text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
              {format(new Date(startDate), "MMM d, yyyy")} - {format(new Date(endDate), "MMM d, yyyy")}
            </div>
          </div>
          <AreaChart
            data={analytics?.trend || []}
            loading={loading}
            xAxis={{ 
              dataKey: "date",
              tickFormatter: (val) => {
                const d = new Date(val);
                if (interval === "daily") return format(d, "MMM d");
                if (interval === "weekly") return format(d, "d MMM"); // Show start date
                if (interval === "monthly") return format(d, "MMM yyyy");
                if (interval === "yearly") return format(d, "yyyy");
                return format(d, "MMM");
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
                color: "#6366f1", // Indigo for premium feel
                strokeWidth: 4,
                fillOpacity: 0.15,
              },
            ]}
            height={400}
            tooltip={{
              formatter: (value) => [formatCurrency(value as number), "Revenue"],
              labelFormatter: (label: any) => {
                try {
                  const d = new Date(label);
                  if (interval === "daily") return format(d, "EEEE, d MMM yyyy");
                  if (interval === "weekly") {
                    const end = addDays(d, 6);
                    return `Minggu ${format(d, "w")}: ${format(d, "d MMM")} - ${format(end, "d MMM yyyy")}`;
                  }
                  if (interval === "monthly") return format(d, "MMMM yyyy");
                  if (interval === "yearly") return format(d, "yyyy");
                  return format(d, "d MMMM yyyy");
                } catch (e) {
                  return label;
                }
              }
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Group */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Revenue by Client Group</h2>
          <BarChart
            data={analytics?.by_group.map(g => ({ name: g.group_name, value: g.amount })) || []}
            xAxisKey="name"
            bars={[{ dataKey: "value", name: "Revenue", fill: "#10b981" }]}
            height={300}
            orientation="horizontal"
            loading={loading}
            subtitle="Berdasarkan periode waktu yang dipilih"
            tooltip={{
              show: true,
              formatter: (value: any) => [formatCurrency(value as number), "Revenue"],
            }}
          />
        </div>

        {/* By Connection Type */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">By Connection Type</h2>
          <PieChart
            data={analytics?.by_connection_type.map(c => ({ 
              name: c.connection_type.toUpperCase(), 
              value: c.amount,
              color: c.connection_type === 'pppoe' ? '#3b82f6' : '#f59e0b'
            })) || []}
            donut={true}
            height={300}
            subtitle="Berdasarkan periode waktu yang dipilih"
            legend={{ show: true, position: "bottom" }}
            tooltip={{
              formatter: (value) => [formatCurrency(value as number), "Revenue"]
            }}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
