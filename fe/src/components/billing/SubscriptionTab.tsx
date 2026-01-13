"use client";

import { useEffect, useMemo } from "react";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useTenantStore } from "@/stores/tenantStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currency || "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatLimitValue(v: number) {
  if (v === -1) return "Unlimited";
  return String(v);
}

export function SubscriptionTab() {
  const { tenant } = useTenantStore();
  const { data, loading, error, fetchDashboardData } = useDashboardStore();

  useEffect(() => {
    if (!data && !loading) {
      fetchDashboardData();
    }
  }, [data, loading, fetchDashboardData]);

  const plan = data?.plan;

  const effectiveLimits = useMemo(() => {
    if (plan?.limits && Object.keys(plan.limits).length > 0) return plan.limits;
    return data?.limits ?? {};
  }, [data?.limits, plan?.limits]);

  const effectiveFeatures = useMemo(() => {
    if (plan?.features && plan.features.length > 0) return plan.features;
    const m = data?.features ?? {};
    return Object.keys(m).filter((k) => !!m[k]);
  }, [data?.features, plan?.features]);

  if (error) {
    return <div className="text-red-500">Error loading subscription: {error}</div>;
  }

  if (!data || loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{plan?.name ?? "No active plan"}</CardTitle>
              <CardDescription>{plan?.description ?? "Plan information is not available."}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-sm text-muted-foreground">Billing Status</span>
              <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-slate-100 text-slate-800">
                {tenant?.billing_status ?? "-"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {plan ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">Monthly Price</div>
                <div className="text-lg font-semibold">
                  {formatCurrency(plan.price_monthly ?? 0, plan.currency ?? "IDR")}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Plan Code</div>
                <div className="text-sm font-medium">{plan.code}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Belum ada plan terdeteksi untuk tenant ini.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Limits</CardTitle>
            <CardDescription>Batasan berdasarkan plan</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(effectiveLimits).length === 0 ? (
              <div className="text-sm text-muted-foreground">Tidak ada data limits.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(effectiveLimits).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm text-slate-700">{k}</span>
                    <span className="text-sm font-medium">{formatLimitValue(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Features</CardTitle>
            <CardDescription>Fitur yang tersedia untuk tenant</CardDescription>
          </CardHeader>
          <CardContent>
            {effectiveFeatures.length === 0 ? (
              <div className="text-sm text-muted-foreground">Tidak ada data feature.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {effectiveFeatures.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-primary/10 text-primary"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


