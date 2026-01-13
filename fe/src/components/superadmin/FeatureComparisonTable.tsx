"use client";

import { useEffect, useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import type { Plan } from "@/lib/api/types";

interface FeatureRow {
  feature: string;
  basic: string | number | boolean;
  pro: string | number | boolean;
  business: string | number | boolean;
  enterprise: string | number | boolean;
}

/* ===================== FEATURE MAPPING ===================== */

const featureMapping: Record<
  string,
  {
    limitKey?: string;
    featureKey?: string;
    type: "limit" | "feature" | "custom";
    customValue?: (plan: Plan) => string | number | boolean;
  }
> = {
  "Radius Basic": { featureKey: "radius_basic", type: "feature" },
  "MikroTik API Basic": { featureKey: "mikrotik_api_basic", type: "feature" },
  "MikroTik Control Panel (advanced)": {
    featureKey: "mikrotik_control_panel_advanced",
    type: "feature",
  },
  "Max Router": { limitKey: "max_routers", type: "limit" },
  "Max User": { limitKey: "max_users", type: "limit" },
  "Active User": { type: "custom", customValue: () => "Unlimited" },
  "Voucher Limit": { limitKey: "max_vouchers", type: "limit" },
  "RBAC Employee": { featureKey: "rbac_employee", type: "feature" },
  "RBAC Client / Reseller": {
    type: "custom",
    customValue: (plan) => {
      // Check if plan has rbac_client_reseller feature
      const hasFeature = plan.features.includes("rbac_client_reseller") || plan.features.includes("*");
      if (!hasFeature) return false; // Return false to show X
      
      // If feature exists, return the limit value
      const value = plan.limits?.rbac_client_reseller;
      if (value === -1 || value == null) return "Unlimited";
      return value;
    },
  },
  "ODC Maps": { limitKey: "max_odc", type: "limit" },
  "ODP Maps": { limitKey: "max_odp", type: "limit" },
  "Client Maps": { limitKey: "max_client_maps", type: "limit" },
  "Payment Gateway": { featureKey: "payment_gateway", type: "feature" },
  "WA Gateway": { featureKey: "wa_gateway", type: "feature" },
  "Manual Isolir": { featureKey: "isolir_manual", type: "feature" },
  "Auto Isolir": { featureKey: "isolir_auto", type: "feature" },
  "API Integration": {
    type: "custom",
    customValue: (plan) => {
      if (plan.code === "basic") return "1 API";
      if (plan.code === "pro") return "Partial";
      if (plan.code === "business") return "Full";
      return "Full + Custom";
    },
  },
  "Multi-tenant SaaS (Super Admin)": {
    featureKey: "*",
    type: "feature",
  },
  "SLA Support": { type: "custom", customValue: () => "Same" },
  "High Availability": {
    type: "custom",
    customValue: (plan) => plan.code === "enterprise",
  },
  "White-label Full": {
    type: "custom",
    customValue: (plan) => {
      if (plan.code === "business") return "Optional";
      return plan.code === "enterprise";
    },
  },
  "AI Agent (Client via WA)": {
    featureKey: "ai_agent_client_wa",
    type: "feature",
  },
  "AI Agent (Admin Ops)": {
    type: "custom",
    customValue: () => "Coming Soon",
  },
  "HCM (Absensi, Gaji, Cuti, Reimbursement)": {
    featureKey: "hcm_module",
    type: "feature",
  },
  "Mobile App (Client/Employee)": {
    type: "custom",
    customValue: () => "Coming Soon",
  },
  "Add-on Router": { featureKey: "addon_router", type: "feature" },
  "Add-on User Packs": {
    featureKey: "addon_user_packs",
    type: "feature",
  },
  "Custom Login Page": {
    featureKey: "custom_login_page",
    type: "feature",
  },
  "Custom Isolir Page": {
    featureKey: "custom_isolir_page",
    type: "feature",
  },
  "Payment Reporting (Advanced)": {
    featureKey: "payment_reporting_advanced",
    type: "feature",
  },
  "Payment History": {
    type: "custom",
    customValue: (plan) =>
      plan.code === "basic"
        ? "1 tahun limit (reset tahunan)"
        : "Unlimited",
  },
  "Dashboard Pendapatan": {
    featureKey: "dashboard_pendapatan",
    type: "feature",
  },
};

/* ===================== HELPERS ===================== */

const getFeatureValue = (
  plan: Plan,
  featureName: string
): string | number | boolean => {
  const mapping = featureMapping[featureName];
  if (!mapping) return false;

  if (mapping.type === "custom" && mapping.customValue) {
    return mapping.customValue(plan);
  }

  if (mapping.type === "limit" && mapping.limitKey) {
    const value = plan.limits[mapping.limitKey];
    if (value === -1 || value == null) return "Unlimited";
    return value;
  }

  if (mapping.type === "feature" && mapping.featureKey) {
    if (mapping.featureKey === "*") {
      return plan.code === "enterprise";
    }
    // Enterprise plan with "*" has all features
    if (plan.features.includes("*")) {
      return true;
    }
    return plan.features.includes(mapping.featureKey);
  }

  return false;
};

const renderValue = (value: string | number | boolean) => {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="h-5 w-5 text-emerald-600 mx-auto" />
    ) : (
      <X className="h-5 w-5 text-red-600 mx-auto" />
    );
  }

  if (value === "Unlimited") {
    return <span className="font-semibold text-blue-600">Unlimited</span>;
  }

  if (typeof value === "number") {
    return <span>{value.toLocaleString("id-ID")}</span>;
  }

  return <span>{value}</span>;
};

/* ===================== COMPONENT ===================== */

export function FeatureComparisonTable() {
  const { plans, loading, fetchPlans } = useSuperAdminStore();
  const [features, setFeatures] = useState<FeatureRow[]>([]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    if (!plans.length) return;

    const sorted = [...plans].sort(
      (a, b) => a.sort_order - b.sort_order
    );

    const basic = sorted.find((p) => p.code === "basic");
    const pro = sorted.find((p) => p.code === "pro");
    const business = sorted.find((p) => p.code === "business");
    const enterprise = sorted.find((p) => p.code === "enterprise");

    if (!basic || !pro || !business || !enterprise) return;

    setFeatures(
      Object.keys(featureMapping).map((feature) => ({
        feature,
        basic: getFeatureValue(basic, feature),
        pro: getFeatureValue(pro, feature),
        business: getFeatureValue(business, feature),
        enterprise: getFeatureValue(enterprise, feature),
      }))
    );
  }, [plans]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const basic = plans.find((p) => p.code === "basic");
  const pro = plans.find((p) => p.code === "pro");
  const business = plans.find((p) => p.code === "business");
  const enterprise = plans.find((p) => p.code === "enterprise");

  if (!basic || !pro || !business || !enterprise) return null;

  return (
    <Card>
      {/* <CardHeader>
        <CardTitle>Feature Comparison by Plan</CardTitle>
      </CardHeader> */}

      <CardContent>
        <br />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 z-20 bg-slate-100 p-3 text-left font-semibold min-w-[260px]">
                  Fitur
                </th>

                <th className="bg-slate-100 p-3 text-center font-semibold">
                  Basic
                  <div className="text-xs font-normal text-muted-foreground">
                    {formatPrice(basic.price_monthly)}
                  </div>
                </th>

                <th className="bg-slate-100 p-3 text-center font-semibold">
                  Pro
                  <div className="text-xs font-normal text-muted-foreground">
                    {formatPrice(pro.price_monthly)}
                  </div>
                </th>

                <th className="bg-blue-100 p-3 text-center font-semibold text-blue-700">
                  Business
                  <div className="text-xs font-normal">
                    {formatPrice(business.price_monthly)}
                  </div>
                  <span className="mt-1 block text-[10px] font-semibold uppercase">
                    Most Popular
                  </span>
                </th>

                <th className="bg-slate-100 p-3 text-center font-semibold">
                  Enterprise
                  <div className="text-xs font-normal text-muted-foreground">
                    {formatPrice(enterprise.price_monthly)}+
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {features.map((row, idx) => (
                <tr
                  key={idx}
                  className={`
                    group border-b transition-colors
                    ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                    hover:bg-slate-100
                  `}
                >
                  <td className="sticky left-0 z-10 bg-inherit p-3 font-medium group-hover:bg-slate-100">
                    {row.feature}
                  </td>

                  <td className="p-3 text-center">{renderValue(row.basic)}</td>
                  <td className="p-3 text-center">{renderValue(row.pro)}</td>

                  <td className="bg-blue-50/40 p-3 text-center">
                    {renderValue(row.business)}
                  </td>

                  <td className="p-3 text-center">
                    {renderValue(row.enterprise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
