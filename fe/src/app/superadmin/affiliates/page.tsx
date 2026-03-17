"use client";

import { useState } from "react";
import { 
  Users, 
  Search, 
  Filter, 
  MoreHorizontal, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  DollarSign,
  Briefcase,
  ExternalLink,
  ChevronRight,
  Plus
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const MOCK_AFFILIATES = [
  { id: "1", name: "Budi Santoso", email: "budi@affiliate.com", phone: "62812345678", total_referrals: 12, balance: 2500000, status: "active", created_at: "2024-02-15" },
  { id: "2", name: "Siti Rahma", email: "siti@partner.net", phone: "62898765432", total_referrals: 5, balance: 750000, status: "pending", created_at: "2024-02-18" },
  { id: "3", name: "Andi Wijaya", email: "andi.w@isp-solusi.id", phone: "62811223344", total_referrals: 28, balance: 5400000, status: "active", created_at: "2024-01-10" },
  { id: "4", name: "Eko Pratama", email: "eko@network.com", phone: "62855667788", total_referrals: 0, balance: 0, status: "pending", created_at: "2024-02-20" },
  { id: "5", name: "Dewi Lestari", email: "dewi@consultant.io", phone: "62813344556", total_referrals: 8, balance: 1200000, status: "active", created_at: "2024-02-01" },
];

export default function AffiliatesManagementPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const stats = [
    { label: "Total Partners", value: "156", icon: Users, color: "bg-blue-500", trend: "+12% mo/mo" },
    { label: "Active Referrals", value: "482", icon: TrendingUp, color: "bg-purple-500", trend: "+5% mo/mo" },
    { label: "Total Payouts", value: "Rp 42.5M", icon: DollarSign, color: "bg-emerald-500", trend: "+18% mo/mo" },
    { label: "Pending Review", value: "8", icon: Clock, color: "bg-amber-500", trend: "-2 from yesterday" },
  ];

  const filteredAffiliates = MOCK_AFFILIATES.filter(aff => 
    (aff.name.toLowerCase().includes(search.toLowerCase()) || aff.email.toLowerCase().includes(search.toLowerCase())) &&
    (filter === "all" || aff.status === filter)
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Affiliate Program</h1>
          <p className="text-slate-500 font-medium mt-1">Manage partners, commissions, and payout requests.</p>
        </div>
        <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
          <Plus className="w-5 h-5" />
          Add Partner
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[32px] border border-slate-100/20 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.trend}</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
            <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-tight">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-[32px] border border-slate-100/20 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative group flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search partner name or email..."
              className="w-full bg-slate-50 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600/10 transition-all outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-50 p-1 rounded-xl">
              {['all', 'active', 'pending'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                    filter === t ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <button className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/60">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Partner Info</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Referrals</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Balance</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Joined</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {filteredAffiliates.map((aff) => (
                <tr key={aff.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400">
                        {aff.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{aff.name}</p>
                        <p className="text-xs text-slate-400 font-medium">{aff.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-900 text-xs font-bold border border-slate-200">
                      <ExternalLink className="w-3 h-3" />
                      {aff.total_referrals}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right font-black text-slate-900">
                    Rp {aff.balance.toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-center">
                    {aff.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-slate-400">
                    {aff.created_at}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-all">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-8 border-t border-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-400 font-bold">Showing {filteredAffiliates.length} of {MOCK_AFFILIATES.length} partners</p>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-xl border border-slate-100 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
            <button className="px-4 py-2 rounded-xl border border-slate-100 text-xs font-bold text-slate-500 hover:bg-slate-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
