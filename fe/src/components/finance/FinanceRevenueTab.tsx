"use client";

import { useState, useEffect } from "react";
import { 
  CurrencyDollarIcon, 
  ArrowTrendingUpIcon, 
  UserGroupIcon, 
  TicketIcon,
  CalendarDaysIcon
} from "@heroicons/react/24/outline";
import { financeService } from "@/lib/api/financeService";
import { RevenueSummary } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { LineChart } from "@/components/charts/LineChart";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FinanceRevenueTab() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [trendData, setTrendData] = useState<{ date: string, amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSource, setActiveSource] = useState<"voucher_usage" | "reseller_purchase">("voucher_usage");
  
  // Date filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = [
    { value: 1, label: "Januari" },
    { value: 2, label: "Februari" },
    { value: 3, label: "Maret" },
    { value: 4, label: "April" },
    { value: 5, label: "Mei" },
    { value: 6, label: "Juni" },
    { value: 7, label: "Juli" },
    { value: 8, label: "Agustus" },
    { value: 9, label: "September" },
    { value: 10, label: "Oktober" },
    { value: 11, label: "November" },
    { value: 12, label: "Desember" },
  ];

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth, activeSource]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, trendRes] = await Promise.all([
        financeService.getRevenueSummary(selectedYear, selectedMonth),
        financeService.getTrend(selectedYear, selectedMonth, activeSource)
      ]);
      setSummary(summaryRes);
      
      // Transform trend data for LineChart
      const formattedPoints = (trendRes.points || []).map(p => ({
        name: p.date.split('-')[2], // Just the day
        value: p.amount
      }));
      setTrendData(formattedPoints as any);

    } catch (error) {
      console.error("Failed to fetch finance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Filters & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Analisis Pendapatan</h2>
          <p className="text-sm text-slate-500">Filter berdasarkan bulan dan tahun untuk melihat detail voucher & reseller.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
            >
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <CalendarDaysIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <CalendarDaysIcon className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Metric Cards - Interactive */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button 
          onClick={() => setActiveSource("voucher_usage")}
          className={cn(
            "text-left transition-all duration-300 transform",
            activeSource === "voucher_usage" ? "scale-[1.02]" : "hover:scale-[1.01]"
          )}
        >
          <Card className={cn(
            "p-6 border-2 transition-all",
            activeSource === "voucher_usage" 
              ? "border-indigo-500 bg-indigo-50/30 ring-4 ring-indigo-500/10 shadow-lg" 
              : "border-slate-100 hover:border-indigo-200 shadow-sm"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "p-3 rounded-xl transition-colors",
                activeSource === "voucher_usage" ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"
              )}>
                <TicketIcon className="w-6 h-6" />
              </div>
              {activeSource === "voucher_usage" && (
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-100 px-2 py-1 rounded">Selected</span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-500">Revenue Voucher Hotspot</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">
              {summary ? formatCurrency(summary.voucher_revenue) : "Rp 0"}
            </h3>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <InformationCircleIcon className="w-4 h-4" />
              <span>Diakui saat voucher digunakan (Accrual)</span>
            </div>
          </Card>
        </button>

        <button 
          onClick={() => setActiveSource("reseller_purchase")}
          className={cn(
            "text-left transition-all duration-300 transform",
            activeSource === "reseller_purchase" ? "scale-[1.02]" : "hover:scale-[1.01]"
          )}
        >
          <Card className={cn(
            "p-6 border-2 transition-all",
            activeSource === "reseller_purchase" 
              ? "border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-500/10 shadow-lg" 
              : "border-slate-100 hover:border-emerald-200 shadow-sm"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "p-3 rounded-xl transition-colors",
                activeSource === "reseller_purchase" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-600"
              )}>
                <UserGroupIcon className="w-6 h-6" />
              </div>
              {activeSource === "reseller_purchase" && (
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-100 px-2 py-1 rounded">Selected</span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-500">Revenue Penjualan Reseller</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">
              {summary ? formatCurrency(summary.reseller_revenue) : "Rp 0"}
            </h3>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <InformationCircleIcon className="w-4 h-4" />
              <span>Diakui saat reseller beli batch (Cash)</span>
            </div>
          </Card>
        </button>
      </div>

      {/* Main Trend Chart */}
      <Card className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ArrowTrendingUpIcon className={cn(
                "w-5 h-5",
                activeSource === "voucher_usage" ? "text-indigo-600" : "text-emerald-600"
              )} />
              Trend Pendapatan: <span className="text-slate-500 font-medium">{activeSource === "voucher_usage" ? "Admin Voucher" : "Reseller Sales"}</span>
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Pergerakan harian di {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Selected Period Total</p>
            <p className={cn(
              "text-2xl font-black",
              activeSource === "voucher_usage" ? "text-indigo-600" : "text-emerald-600"
            )}>
              {formatCurrency(trendData.reduce((acc, curr) => acc + curr.value, 0))}
            </p>
          </div>
        </div>

        <div className="h-[350px] w-full relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
              <LoadingSpinner size={40} />
            </div>
          ) : trendData.length > 0 ? (
            <LineChart 
              data={trendData} 
              height={350} 
              xAxis={{
                dataKey: "name",
                label: "Tanggal"
              }}
              yAxis={{
                dataKey: "value",
                tickFormatter: (val) => `Rp ${val.toLocaleString()}`
              }}
              lines={[
                {
                  dataKey: "value",
                  name: activeSource === "voucher_usage" ? "Voucher" : "Reseller",
                  stroke: activeSource === "voucher_usage" ? "#4f46e5" : "#10b981",
                  strokeWidth: 3,
                  type: "monotone"
                }
              ]}
              legend={{ show: false }}
              tooltip={{
                show: true,
                formatter: (value: any) => new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  minimumFractionDigits: 2,
                }).format(value)
              }}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
              <ArrowTrendingUpIcon className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">Tidak ada data transaksi di periode ini</p>
              <p className="text-xs mt-1">Silakan pilih bulan atau tahun lain.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function InformationCircleIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg 
      fill="none" 
      viewBox="0 0 24 24" 
      strokeWidth={1.5} 
      stroke="currentColor" 
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}
