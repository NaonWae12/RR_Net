"use client";

import { useRouter } from "next/navigation";
import { RoleGuard } from "@/components/guards/RoleGuard";
import { FinanceDashboardTab } from "@/components/finance";

// Redirect to dashboard by default
export default function FinancePage() {
  const router = useRouter();
  
  // Redirect to Finance dashboard
  if (typeof window !== "undefined") {
    router.replace("/finance/dashboard");
  }

  return (
    <RoleGuard allowedRoles={["owner", "admin", "finance"]} redirectTo="/dashboard">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Finance Management</h1>
          <p className="text-slate-500 mt-1">
            Manage invoices, payments, reports, and deposits
          </p>
        </div>
        <FinanceDashboardTab />
      </div>
    </RoleGuard>
  );
}

