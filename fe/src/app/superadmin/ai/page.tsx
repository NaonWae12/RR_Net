"use client";

import React from "react";
import { AITab } from "@/components/settings/AITab";
import { Bot, Sparkles, ShieldCheck } from "lucide-react";
import { RoleGuard } from "@/components/guards/RoleGuard";

export default function SuperAdminAIPage() {
  return (
    <RoleGuard allowedRoles={["super_admin"]} redirectTo="/superadmin">
      <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-indigo-600">
            <ShieldCheck className="w-8 h-8" />
            <span className="text-sm font-semibold uppercase tracking-wider">Super Admin Control Panel</span>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Global AI & Automation <Sparkles className="w-8 h-8 text-amber-500 fill-amber-500" />
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl leading-relaxed">
            Manage the platform-wide AI configuration. Settings defined here will apply to <span className="text-indigo-600 font-bold underline decoration-indigo-200">all tenants</span> across the entire RRNet ecosystem.
          </p>
        </div>
        
        <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-100/50 border border-slate-200 overflow-hidden p-8 md:p-10">
          <AITab isAdmin={true} />
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-3">
             <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
             </div>
             <h4 className="font-bold text-indigo-900">Centralized Control</h4>
             <p className="text-xs text-indigo-700 leading-relaxed">One API key for all tenants. Simplifies billing and technical management for the platform provider.</p>
          </div>
          <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100 space-y-3">
             <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Bot className="w-5 h-5 text-amber-600" />
             </div>
             <h4 className="font-bold text-amber-900">Tenant-Ready</h4>
             <p className="text-xs text-amber-700 leading-relaxed">Tenants will immediately see AI features active as soon as you configure and enable them here.</p>
          </div>
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
             <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-5 h-5 text-slate-600" />
             </div>
             <h4 className="font-bold text-slate-900">Security First</h4>
             <p className="text-xs text-slate-600 leading-relaxed">Keys are encrypted with AES-GCM 256-bit. Only authorized super admin calls can retrieve or modify them.</p>
          </div>
        </div>

        <div className="text-center text-slate-400 text-sm">
          <p>© 2026 RRNet Platform Administration. All rights reserved.</p>
        </div>
      </div>
    </RoleGuard>
  );
}
