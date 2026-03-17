"use client";

import { useState } from "react";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { 
  FinanceDashboardTab, 
  FinanceRevenueTab, 
  InvoicesTab, 
  PaymentsTab, 
  ReportsTab 
} from "@/components/finance";
import { 
  LayoutDashboard, 
  BarChart3, 
  FileText, 
  CreditCard, 
  PieChart as PieChartIcon 
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue'>('overview');

  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'revenue', name: 'Pendapatan (Voucher)', icon: BarChart3 },
    // { id: 'invoices', name: 'Tagihan (Invoices)', icon: FileText },
    // { id: 'payments', name: 'Pembayaran (Payments)', icon: CreditCard },
    // { id: 'reports', name: 'Laporan Keuangan', icon: PieChartIcon },
  ];

  return (
    <RoleGuard allowedRoles={["finance"]} redirectTo="/dashboard">
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Manajemen Keuangan</h1>
          <p className="text-slate-500 mt-2 text-lg">
            Pantau arus kas, realisasi pendapatan, dan penagihan dalam satu dashboard.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8 bg-slate-100/50 p-1.5 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all duration-200 rounded-lg",
                activeTab === tab.id
                  ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-indigo-600" : "text-slate-400")} />
              {tab.name}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeTab === 'overview' && <FinanceDashboardTab />}
          {activeTab === 'revenue' && <FinanceRevenueTab />}
          // {activeTab === 'invoices' && <InvoicesTab />}
          // {activeTab === 'payments' && <PaymentsTab />}
          // {activeTab === 'reports' && <ReportsTab />}
        </div>
      </div>
    </RoleGuard>
  );
}
