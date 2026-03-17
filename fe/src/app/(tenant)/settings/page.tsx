"use client";

import React from "react";
import { TabLayout, TabConfig } from "@/components/layouts/TabLayout";
import { User, Building2, Shield, Settings2 } from "lucide-react";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { TenantTab } from "@/components/settings/TenantTab";
import { SecurityTab } from "@/components/settings/SecurityTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";

export default function SettingsPage() {
  const tabs: TabConfig[] = [
    {
      id: "profile",
      label: "Personal Profile",
      content: <ProfileTab />,
    },
    {
      id: "tenant",
      label: "Organization",
      content: <TenantTab />,
    },
    {
      id: "security",
      label: "Security & Privacy",
      content: <SecurityTab />,
    },
    {
      id: "integrations",
      label: "Integrations",
      content: <IntegrationsTab />,
    },
  ];

  return (
    <RoleGuard allowedRoles={["owner"]} redirectTo="/dashboard">
      <div className="p-4 md:p-8 space-y-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-indigo-600">
            <Settings2 className="w-8 h-8" />
            <span className="text-sm font-semibold uppercase tracking-wider">System Settings</span>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Settings
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl">
            Customize your account preferences, manage organization details, and secure your access to RRNet.
          </p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden min-h-[650px] flex">
          <TabLayout 
            tabs={tabs} 
            vertical={true} 
            className="w-full"
            defaultTab="profile"
          />
        </div>
        
        <div className="text-center text-slate-400 text-sm">
          <p>© 2026 RRNet Cloud ERP. All rights reserved.</p>
        </div>
      </div>
    </RoleGuard>
  );
}
