"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TabLayout } from "@/components/layouts/TabLayout";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { useAuth } from "@/lib/hooks/useAuth";
import { OverviewTab } from "@/components/settlement/OverviewTab";
import { HistoryTab } from "@/components/settlement/HistoryTab";
import { SubmitSettlementTab } from "@/components/settlement/SubmitSettlementTab";

export default function SettlementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const tabParam = searchParams.get("tab");
  const isAdmin = user?.role === "admin" || user?.role === "owner" || user?.role === "finance";
  const isCollector = user?.role === "collector";

  // Default tab based on role
  const defaultTab = tabParam || (isAdmin ? "overview" : "submit");

  // Admin tabs
  const adminTabs = [
    { id: "overview", label: "Overview", content: <OverviewTab /> },
    { id: "history", label: "History", content: <HistoryTab /> },
  ];

  // Collector tabs
  const collectorTabs = [
    { id: "submit", label: "Submit Settlement", content: <SubmitSettlementTab /> },
    { id: "history", label: "My History", content: <HistoryTab collectorView /> },
  ];

  const tabs = isAdmin ? adminTabs : collectorTabs;

  return (
    <RoleGuard allowedRoles={["owner", "admin", "finance", "collector"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Collector Settlement</h1>
          <p className="text-slate-500 mt-1">
            {isAdmin
              ? "Manage collector settlements and verify deposits"
              : "Submit your daily settlement and track verification status"}
          </p>
        </div>

        <TabLayout
          defaultTab={defaultTab}
          onTabChange={(tabId) => router.replace(`/settlement?tab=${encodeURIComponent(tabId)}`)}
          tabs={tabs}
        />
      </div>
    </RoleGuard>
  );
}

