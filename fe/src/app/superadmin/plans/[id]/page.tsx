"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { format } from "date-fns";
import { featureService } from "@/lib/api/featureService";
import type { Feature } from "@/lib/api/types";

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { plan, loading, error, fetchPlan, clearPlan } = useSuperAdminStore();
  const [featureCatalog, setFeatureCatalog] = useState<Feature[]>([]);

  useEffect(() => {
    if (id) {
      fetchPlan(id);
    }
    return () => {
      clearPlan();
    };
  }, [id, fetchPlan, clearPlan]);

  // Load feature catalog to display readable feature names
  useEffect(() => {
    const loadFeatures = async () => {
      try {
        const catalog = await featureService.getFeatures();
        setFeatureCatalog(catalog);
        console.log("[PlanDetail] Feature catalog loaded:", catalog.length, "features");
      } catch (err) {
        console.error("Failed to load feature catalog:", err);
      }
    };
    loadFeatures();
  }, []);

  // Create feature code to name mapping
  const featureMap = useMemo(() => {
    const map = new Map<string, string>();
    featureCatalog.forEach((f) => map.set(f.code, f.name));
    return map;
  }, [featureCatalog]);

  // Get feature display names
  const getFeatureDisplayName = (code: string): string => {
    if (code === "*") {
      return "All Features (Multi-tenant SaaS - Super Admin)";
    }
    return featureMap.get(code) || code;
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        Error loading plan: {error}
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6 text-slate-500">
        Plan not found.
      </div>
    );
  }

  // Check if plan has wildcard feature (Enterprise plan)
  const hasWildcardFeature = plan.features && plan.features.includes("*");

  // Get all features if wildcard, otherwise use plan features
  const displayFeatures = hasWildcardFeature
    ? featureCatalog.map(f => f.code)
    : (plan.features || []);

  // Debug: Log features
  console.log("[PlanDetail] Plan:", plan.code);
  console.log("[PlanDetail] Plan features array:", plan.features);
  console.log("[PlanDetail] Plan features type:", typeof plan.features);
  console.log("[PlanDetail] Plan features is array:", Array.isArray(plan.features));
  console.log("[PlanDetail] Has wildcard:", hasWildcardFeature);
  console.log("[PlanDetail] Feature catalog count:", featureCatalog.length);
  console.log("[PlanDetail] Display features count:", displayFeatures.length);
  console.log("[PlanDetail] Has client_maps in plan.features:", plan.features && plan.features.includes("client_maps"));
  console.log("[PlanDetail] Display features:", displayFeatures);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push("/superadmin/plans")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Plans
        </Button>
        <Button variant="outline" onClick={() => router.push(`/superadmin/plans/${plan.id}/edit`)}>
          <Pencil className="h-4 w-4 mr-2" /> Edit
        </Button>
      </div>

      <h1 className="text-3xl font-bold text-slate-900">{plan.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white shadow rounded-lg p-6">
        <div>
          <p className="text-sm font-medium text-slate-500">Code</p>
          <p className="text-lg font-semibold">{plan.code}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Status</p>
          <p className="text-lg font-semibold">
            {plan.is_active ? (
              <span className="text-green-600">Active</span>
            ) : (
              <span className="text-gray-600">Inactive</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Price Monthly</p>
          <p className="text-lg font-semibold">
            {new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: plan.currency || "IDR",
            }).format(plan.price_monthly)}
          </p>
        </div>
        {plan.price_yearly && (
          <div>
            <p className="text-sm font-medium text-slate-500">Price Yearly</p>
            <p className="text-lg font-semibold">
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: plan.currency || "IDR",
              }).format(plan.price_yearly)}
            </p>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-slate-500">Is Public</p>
          <p className="text-lg">{plan.is_public ? "Yes" : "No"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Sort Order</p>
          <p className="text-lg">{plan.sort_order}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Created At</p>
          <p className="text-lg">{format(new Date(plan.created_at), "PPp")}</p>
        </div>
      </div>

      {plan.description && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Description</h2>
          <p className="text-slate-700">{plan.description}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Limits</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(plan.limits)
            .filter(([key]) => {
              // Only show rbac_client_reseller limit if the feature is enabled
              if (key === "rbac_client_reseller") {
                const hasRbacClientReseller = plan.features?.includes("rbac_client_reseller") || plan.features?.includes("*");
                return hasRbacClientReseller;
              }
              return true;
            })
            .map(([key, value]) => (
              <div key={key}>
                <p className="text-sm font-medium text-slate-500 capitalize">{key.replace(/_/g, " ")}</p>
                <p className="text-lg font-semibold">{value}</p>
              </div>
            ))}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          Features ({displayFeatures ? displayFeatures.length : 0})
        </h2>
        {displayFeatures && displayFeatures.length > 0 ? (
          <ul className="list-disc list-inside space-y-1">
            {displayFeatures.map((feature, idx) => {
              const displayName = getFeatureDisplayName(feature);
              return (
                <li key={idx} className="text-slate-700">
                  {displayName}
                  {featureMap.has(feature) && feature !== "*" && (
                    <span className="ml-2 text-xs text-slate-500">({feature})</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div>
            <p className="text-slate-500">No features assigned to this plan.</p>
            {!plan.features && (
              <p className="text-xs text-red-600 mt-2">Warning: plan.features is undefined or null</p>
            )}
          </div>
        )}
        {/* Debug: Show raw features array - Always show for debugging */}
        <details className="mt-4 text-xs text-slate-400">
          <summary className="cursor-pointer hover:text-slate-600">
            Debug: Raw features array (click to expand)
          </summary>
          <div className="mt-2 p-2 bg-slate-50 rounded overflow-auto">
            <p className="font-semibold mb-1">plan.features:</p>
            <pre className="text-xs">
              {JSON.stringify(plan.features, null, 2)}
            </pre>
            <p className="font-semibold mb-1 mt-2">displayFeatures:</p>
            <pre className="text-xs">
              {JSON.stringify(displayFeatures, null, 2)}
            </pre>
            <p className="font-semibold mb-1 mt-2">featureCatalog codes:</p>
            <pre className="text-xs">
              {JSON.stringify(featureCatalog.map(f => f.code), null, 2)}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
}

