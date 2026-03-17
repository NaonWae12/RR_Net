"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, List, AlertTriangle, Layers, Info } from "lucide-react";
import { FeatureCatalogModal } from "./FeatureCatalogModal";
import { featureService } from "@/lib/api/featureService";
import type { Feature } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface FeatureSelectorProps {
  value: string[];
  onChange: (codes: string[]) => void;
  error?: string;
  className?: string; // Added className support
}

export function FeatureSelector({ value, onChange, error, className }: FeatureSelectorProps) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

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

  // Sync inputValue with value when value changes externally
  useEffect(() => {
    setInputValue(value.join("\n"));
  }, [value]);

  // Create a map of feature codes to feature objects for quick lookup
  const featureMap = useMemo(() => {
    const map = new Map<string, Feature>();
    features.forEach((f) => map.set(f.code, f));
    return map;
  }, [features]);

  // Get feature names for display for badges
  // We want to display badges for ALL values in the list
  const selectedFeaturesBadges = useMemo(() => {
    return value
      .filter(code => code.trim() !== "")
      .map((code) => {
        const trimmedCode = code.trim();
        const feature = featureMap.get(trimmedCode);
        return { 
             code: trimmedCode, 
             name: feature ? feature.name : trimmedCode,
             isValid: feature !== undefined || trimmedCode === "*"
        };
      });
  }, [value, featureMap]);

  const handleRemoveFeature = (codeToRemove: string) => {
    const newValue = value.filter((code) => code.trim() !== codeToRemove);
    onChange(newValue);
  };

  const handleCatalogSelect = (selectedCodes: string[]) => {
    // Merge with existing, avoiding duplicates
    const merged = Array.from(new Set([...value, ...selectedCodes]));
    onChange(merged);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
     setInputValue(e.target.value);
     const codes = e.target.value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== ""); 
      onChange(codes);
  };

  const invalidCodes = selectedFeaturesBadges.filter(f => !f.isValid);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
            <h4 className="text-sm font-medium text-slate-700 flex items-center">
                <Layers className="mr-2 h-4 w-4 text-slate-500" />
                Feature Selection
            </h4>
            <p className="text-xs text-slate-500">
                Type codes manually or select from the catalog.
            </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          disabled={loading}
        >
          <List className="h-4 w-4 mr-2" />
          Browse Catalog
        </Button>
      </div>

      <div className="space-y-4">
          <Textarea
             label="Feature Codes (One per line)"
             value={inputValue} 
             onChange={handleTextareaChange}
             placeholder="e.g.:&#10;radius_basic&#10;mikrotik_api_basic"
             className="min-h-[120px] font-mono text-xs leading-relaxed"
             error={error}
          />

          {selectedFeaturesBadges.length > 0 && (
            <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
                <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider flex items-center justify-between">
                    <span>Active Features ({selectedFeaturesBadges.length})</span>
                    {invalidCodes.length > 0 && features.length > 0 && (
                        <span className="text-amber-600 flex items-center">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {invalidCodes.length} Unrecognized
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {selectedFeaturesBadges.map(({ code, name, isValid }) => (
                        <div 
                            key={code} 
                            className={cn(
                                "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2",
                                isValid 
                                    ? "border-transparent bg-slate-900 text-slate-50 shadow hover:bg-slate-900/80" 
                                    : "border-transparent bg-amber-500 text-white shadow hover:bg-amber-600/80"
                            )}
                        >
                            <span className="mr-1">{name}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveFeature(code)}
                                className="ml-1 rounded-full p-0.5 hover:bg-white/20"
                            >
                                <X className="h-3 w-3" />
                                <span className="sr-only">Remove</span>
                            </button>
                        </div>
                    ))}
                </div>
                {invalidCodes.length > 0 && features.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-100">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        <p>
                            Some codes are not recognized in the current feature catalog. 
                            This might be intentional for future features or custom implementations.
                        </p>
                    </div>
                )}
            </div>
          )}
      </div>

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
