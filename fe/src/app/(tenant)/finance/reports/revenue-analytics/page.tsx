"use client";

import { RoleGuard } from "@/components/guards/RoleGuard";
import { RevenueAnalyticsPage } from "@/components/finance/RevenueAnalyticsPage";

export default function FinanceRevenueAnalyticsPage() {
  return (
    <RoleGuard allowedRoles={["owner", "admin", "finance"]} redirectTo="/dashboard">
      <div className="p-6">
        <RevenueAnalyticsPage />
      </div>
    </RoleGuard>
  );
}
