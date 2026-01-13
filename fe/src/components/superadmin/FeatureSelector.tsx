"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { X, List } from "lucide-react";
import { FeatureCatalogModal } from "./FeatureCatalogModal";
import { featureService } from "@/lib/api/featureService";
import type { Feature } from "@/lib/api/types";

interface FeatureSelectorProps {
  value: string[];
  onChange: (codes: string[]) => void;
  error?: string;
}

export function FeatureSelector({ value, onChange, error }: FeatureSelectorProps) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch features catalog on mount
  useEffect(() => {
    const loadFeatures = async () => {
      setLoading(true);
      try {
        const catalog = await featureService.getFeatures();
        setFeatures(catalog);
      } catch (err) {
        console.error("Failed to load features catalog:", err);
      } finally {
        setLoading(false);
      }
    };

    loadFeatures();
  }, []);

  // Create a map of feature codes to feature objects for quick lookup
  const featureMap = useMemo(() => {
    const map = new Map<string, Feature>();
    features.forEach((f) => map.set(f.code, f));
    return map;
  }, [features]);

  // Get feature names for display
  const selectedFeatures = useMemo(() => {
    return value
      .map((code) => {
        const feature = featureMap.get(code);
        return feature ? { code, name: feature.name } : { code, name: code };
      })
      .filter((f) => f.code.trim() !== "");
  }, [value, featureMap]);

  const handleRemoveFeature = (codeToRemove: string) => {
    onChange(value.filter((code) => code !== codeToRemove));
  };

  const handleCatalogSelect = (selectedCodes: string[]) => {
    // Merge with existing, avoiding duplicates
    const merged = Array.from(new Set([...value, ...selectedCodes]));
    onChange(merged);
  };

  // Get invalid feature codes (ones that don't exist in catalog)
  const invalidCodes = useMemo(() => {
    return value.filter((code) => code.trim() !== "" && !featureMap.has(code));
  }, [value, featureMap]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          Features
          {value.length > 0 && (
            <span className="ml-2 text-xs text-slate-500">({value.length} selected)</span>
          )}
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          disabled={loading}
        >
          <List className="h-4 w-4 mr-2" />
          Select from Catalog
        </Button>
      </div>

      {/* Manual Input Textarea */}
      <textarea
        value={value.join("\n")}
        onChange={(e) => {
          const codes = e.target.value
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line !== "");
          onChange(codes);
        }}
        placeholder="Enter feature codes, one per line:&#10;radius_basic&#10;mikrotik_api_basic&#10;wa_gateway"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:border-slate-400"
        rows={4}
      />

      {/* Selected Features Display */}
      {selectedFeatures.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-600">Selected Features:</div>
          <div className="flex flex-wrap gap-2">
            {selectedFeatures.map(({ code, name }) => (
              <div
                key={code}
                className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-sm border border-blue-200"
              >
                <span className="font-medium">{name}</span>
                <code className="text-xs bg-blue-100 px-1.5 py-0.5 rounded">{code}</code>
                <button
                  type="button"
                  onClick={() => handleRemoveFeature(code)}
                  className="ml-1 hover:bg-blue-200 rounded p-0.5 transition-colors"
                  aria-label={`Remove ${name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invalid Codes Warning */}
      {invalidCodes.length > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
          <div className="text-sm font-medium text-amber-800 mb-1">Invalid Feature Codes:</div>
          <div className="text-xs text-amber-700">
            The following codes are not in the catalog:{" "}
            <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">
              {invalidCodes.join(", ")}
            </code>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Catalog Modal */}
      <FeatureCatalogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        features={features}
        selected={value}
        onSelect={handleCatalogSelect}
      />
    </div>
  );
}

