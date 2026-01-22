"use client";

import { useEffect } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { TenantGuard } from "@/components/auth/TenantGuard";
import { AppLayout } from "@/components/layout";
import { useDashboardStore } from "@/stores/dashboardStore";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";

function TenantFeatureBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, loading, fetchDashboardData } = useDashboardStore();
  const { isAuthenticated } = useAuth();

  const ready = useAuthStore((state) => state.ready);

  useEffect(() => {
    // Ensure we have plan/features/limits available for sidebar gating and route guards.
    // CRITICAL: Only fetch if auth is READY (not just authenticated)
    // This ensures token is fully synced to apiClient before making requests
    if (ready && isAuthenticated && !data && !loading) {
      fetchDashboardData();
    }
  }, [data, loading, fetchDashboardData, isAuthenticated, ready]);

  useEffect(() => {
    // Wait until we have tenant feature data
    if (!data || loading) return;

    const planFeatures = data.plan?.features ?? [];
    const hasWildcard = planFeatures.includes("*");
    const featuresMap = data.features ?? {};

    const hasAnyFeature = (codes: string[]) => {
      if (hasWildcard) return true;
      return codes.some((c) => !!featuresMap[c] || planFeatures.includes(c));
    };

    // Route gating (MVP)
    const needsMaps = pathname.startsWith("/maps");
    const needsTechnician = pathname.startsWith("/technician");
    const needsReports = pathname.startsWith("/reports"); // not implemented yet
    const needsNetwork = pathname.startsWith("/network");
    const needsEmployees = pathname.startsWith("/employees");
    const needsServiceSetup = pathname.startsWith("/service-setup");

    // Technician routes that require feature gating (maps-related)
    const technicianRoutesRequiringFeature = [
      "/technician/clients/submit",
      "/technician/clients/submissions"
    ];
    const needsTechnicianFeature = needsTechnician && 
      (pathname.startsWith("/technician/clients") || pathname === "/technician/clients");

    // Technician routes that don't require feature gating (basic technician features)
    const technicianBasicRoutes = [
      "/technician/attendance",
      "/technician/reimbursement",
      "/technician/payslip",
      "/technician/time-off",
      "/technician/tasks",
      "/technician/activities"
    ];
    const isTechnicianBasicRoute = technicianBasicRoutes.some(route => pathname.startsWith(route));

    if (needsReports) {
      router.replace("/dashboard");
      return;
    }

    // Maps route requires feature
    if (needsMaps) {
      const ok = hasAnyFeature(["odp_maps", "client_maps"]);
      if (!ok) {
        router.replace("/dashboard");
      }
      return;
    }

    // Technician client submission routes require feature
    if (needsTechnicianFeature) {
      const ok = hasAnyFeature(["odp_maps", "client_maps"]);
      if (!ok) {
        router.replace("/dashboard");
      }
      return;
    }

    // Basic technician routes (attendance, reimbursement, etc.) don't require feature gating
    // These are handled by RoleGuard at the page level
    if (isTechnicianBasicRoute) {
      return;
    }

    if (needsNetwork) {
      const ok = hasAnyFeature(["mikrotik_api_basic", "mikrotik_api"]);
      if (!ok) {
        router.replace("/dashboard");
      }
    }

    if (needsEmployees) {
      const ok = hasAnyFeature(["rbac_employee", "rbac_full", "rbac_basic"]);
      if (!ok) {
        router.replace("/dashboard");
      }
    }

    if (needsServiceSetup) {
      const ok = hasAnyFeature(["service_packages"]);
      if (!ok) {
        router.replace("/dashboard");
      }
    }
  }, [data, loading, pathname, router]);

  return <>{children}</>;
}

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <TenantGuard fallback={<div className="p-6">Tenant tidak ditemukan / belum dipilih</div>}>
        <TenantFeatureBootstrap>
          <AppLayout>{children}</AppLayout>
        </TenantFeatureBootstrap>
      </TenantGuard>
    </AuthGuard>
  );
}

