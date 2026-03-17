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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-white text-slate-900 border border-slate-200 shadow-2xl p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-white">
          <DialogTitle className="text-xl font-semibold text-slate-900">Select Features from Catalog</DialogTitle>
          <DialogDescription className="text-slate-500 mt-1.5">
            Search and select features to add to the plan. Selected features will be displayed with their names.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          {/* Search and Actions */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white border-slate-200 focus-visible:ring-slate-400"
              />
            </div>
            <div className="flex gap-2 shrink-0">
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSelectAll}
                    className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                >
                Select All
                </Button>
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDeselectAll}
                    className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                >
                Deselect All
                </Button>
            </div>
          </div>

          {/* Features List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/30">
            {Object.keys(groupedFeatures).length > 0 ? (
                Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
                <div key={category} className="space-y-3">
                    <h3 className="flex items-center text-sm font-semibold text-slate-900 bg-slate-100 py-1.5 px-3 rounded-md w-fit">
                        {category}
                        <span className="ml-2 text-xs font-normal text-slate-500 bg-white px-1.5 rounded-full border border-slate-200">
                            {categoryFeatures.length}
                        </span>
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                    {categoryFeatures.map((feature) => {
                        const isSelected = tempSelected.includes(feature.code);
                        return (
                        <div
                            key={feature.code}
                            role="button"
                            tabIndex={0}
                            className={`group flex items-start p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                            isSelected
                                ? "bg-blue-50/80 border-blue-200 ring-1 ring-blue-200 shadow-sm"
                                : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-md"
                            }`}
                            onClick={() => toggleFeature(feature.code)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleFeature(feature.code);
                                }
                            }}
                        >
                            <div className={`mt-0.5 mr-3 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                                isSelected 
                                    ? "bg-blue-600 border-blue-600 text-white" 
                                    : "border-slate-300 bg-white group-hover:border-blue-400"
                            }`}>
                                {isSelected && <Check className="h-3.5 w-3.5" />}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className={`font-medium text-sm truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                                    {feature.name}
                                </span>
                                <code className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                                    isSelected 
                                        ? 'bg-blue-100 text-blue-700 border-blue-200' 
                                        : 'bg-slate-100 text-slate-500 border-slate-200 group-hover:bg-slate-200'
                                    }`}>
                                {feature.code}
                                </code>
                            </div>
                            {feature.description && (
                                <p className={`text-xs leading-relaxed ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>
                                    {feature.description}
                                </p>
                            )}
                            </div>
                        </div>
                        );
                    })}
                    </div>
                </div>
                ))
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <div className="bg-slate-100 p-3 rounded-full mb-3">
                        <Search className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="font-medium text-slate-900">No features found</p>
                    <p className="text-sm">Try adjusting your search terms.</p>
                </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
            <div className="text-sm font-medium text-slate-600">
              <span className="text-slate-900 font-bold">{tempSelected.length}</span> feature{tempSelected.length !== 1 ? "s" : ""} selected
            </div>
            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCancel}
                className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
              >
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleApply}
                className="bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all hover:shadow-lg"
              >
                Add Selected Features
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

