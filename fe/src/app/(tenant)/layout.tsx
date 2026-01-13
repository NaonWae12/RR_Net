"use client";

import { useEffect } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { TenantGuard } from "@/components/auth/TenantGuard";
import { AppLayout } from "@/components/layout";
import { useDashboardStore } from "@/stores/dashboardStore";
import { usePathname, useRouter } from "next/navigation";

function TenantFeatureBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, loading, fetchDashboardData } = useDashboardStore();

  useEffect(() => {
    // Ensure we have plan/features/limits available for sidebar gating and route guards.
    if (!data && !loading) {
      fetchDashboardData();
    }
  }, [data, loading, fetchDashboardData]);

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

    if (needsReports) {
      router.replace("/dashboard");
      return;
    }

    if (needsMaps || needsTechnician) {
      const ok = hasAnyFeature(["odp_maps", "client_maps"]);
      if (!ok) {
        router.replace("/dashboard");
      }
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

