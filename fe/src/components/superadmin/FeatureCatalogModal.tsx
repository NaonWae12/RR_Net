"use client";

import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Search } from "lucide-react";
import type { Feature } from "@/lib/api/types";

interface FeatureCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  features: Feature[];
  selected: string[];
  onSelect: (codes: string[]) => void;
}

export function FeatureCatalogModal({
  isOpen,
  onClose,
  features,
  selected,
  onSelect,
}: FeatureCatalogModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSelected, setTempSelected] = useState<string[]>(selected);

  // Initialize tempSelected when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempSelected(selected);
      setSearchQuery("");
    }
  }, [isOpen, selected]);

  // Filter features based on search query
  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) return features;

    const query = searchQuery.toLowerCase();
    return features.filter(
      (f) =>
        f.code.toLowerCase().includes(query) ||
        f.name.toLowerCase().includes(query) ||
        f.description?.toLowerCase().includes(query) ||
        f.category?.toLowerCase().includes(query)
    );
  }, [features, searchQuery]);

  // Group features by category
  const groupedFeatures = useMemo(() => {
    const groups: Record<string, Feature[]> = {};
    filteredFeatures.forEach((feature) => {
      const category = feature.category || "Other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(feature);
    });
    return groups;
  }, [filteredFeatures]);

  const toggleFeature = (code: string) => {
    setTempSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSelectAll = () => {
    setTempSelected(filteredFeatures.map((f) => f.code));
  };

  const handleDeselectAll = () => {
    setTempSelected([]);
  };

  const handleApply = () => {
    onSelect(tempSelected);
    onClose();
  };

  const handleCancel = () => {
    setTempSelected(selected); // Reset to original selection
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Features from Catalog</DialogTitle>
          <DialogDescription>
            Search and select features to add to the plan. Selected features will be displayed with their names.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Search and Actions */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search features by name, code, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          </div>

          {/* Features List */}
          <div className="flex-1 overflow-y-auto border rounded-md p-4 space-y-6">
            {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
              <div key={category}>
                <h3 className="font-semibold text-sm text-slate-700 mb-2">{category}</h3>
                <div className="space-y-2">
                  {categoryFeatures.map((feature) => {
                    const isSelected = tempSelected.includes(feature.code);
                    return (
                      <div
                        key={feature.code}
                        className={`flex items-start p-3 rounded-md border cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50 border-blue-300"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                        onClick={() => toggleFeature(feature.code)}
                      >
                        <div className="flex items-center h-5 w-5 mr-3 mt-0.5">
                          {isSelected ? (
                            <div className="h-5 w-5 rounded border-2 border-blue-600 bg-blue-600 flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          ) : (
                            <div className="h-5 w-5 rounded border-2 border-slate-300" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-900">{feature.name}</span>
                            <code className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {feature.code}
                            </code>
                          </div>
                          {feature.description && (
                            <p className="text-xs text-slate-600 mt-1">{feature.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {filteredFeatures.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No features found matching your search.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-slate-600">
              {tempSelected.length} feature{tempSelected.length !== 1 ? "s" : ""} selected
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={handleApply}>
                Add Selected Features
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

