"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface TabConfig {
  id: string;
  label: string;
  content: React.ReactNode;
  badge?: number | string;
  disabled?: boolean;
}

export interface TabValidation {
  [tabId: string]: {
    isValid: boolean;
    error?: string;
  };
}

export interface TabLayoutProps {
  tabs: TabConfig[];
  defaultTab?: string;
  vertical?: boolean;
  lazy?: boolean;
  validation?: TabValidation;
  onTabChange?: (tabId: string) => void;
  className?: string;
}

export const TabLayout = React.memo<TabLayoutProps>(
  ({
    tabs,
    defaultTab,
    vertical = false,
    lazy = false,
    validation,
    onTabChange,
    className,
  }) => {
    const [activeTab, setActiveTab] = React.useState(defaultTab || tabs[0]?.id);

    React.useEffect(() => {
      if (defaultTab) {
        setActiveTab(defaultTab);
      }
    }, [defaultTab]);

    const handleTabChange = (tabId: string) => {
      if (tabs.find((t) => t.id === tabId)?.disabled) return;
      setActiveTab(tabId);
      onTabChange?.(tabId);
    };

    const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

    return (
      <div
        className={cn(
          "flex",
          vertical ? "flex-row" : "flex-col",
          className
        )}
      >
        {/* Tab Headers */}
        <div
          className={cn(
            "flex border-b border-slate-200",
            vertical && "flex-col border-b-0 border-r border-slate-200",
            !vertical && "flex-row"
          )}
          role="tablist"
        >
          {tabs.map((tab) => {
            const isValid = validation?.[tab.id]?.isValid !== false;
            const hasError = validation?.[tab.id]?.error;

            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tab-panel-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                disabled={tab.disabled}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors relative",
                  // Active tab styling
                  activeTab === tab.id && "text-slate-900 bg-slate-100",
                  // Inactive tab styling
                  activeTab !== tab.id && "text-slate-400 hover:text-slate-900 hover:bg-slate-100",
                  // Border for horizontal tabs
                  !vertical && activeTab === tab.id && "border-b-2 border-slate-500 -mb-px",
                  !vertical && activeTab !== tab.id && "border-b-2 border-transparent",
                  // Border for vertical tabs
                  vertical && "border-b-0 border-r-2 -mr-px",
                  vertical && activeTab === tab.id && "border-indigo-500",
                  vertical && activeTab !== tab.id && "border-slate-200",
                  // Disabled state
                  tab.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:border-transparent"
                )}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  {tab.badge && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
                      {tab.badge}
                    </span>
                  )}
                  {hasError && (
                    <span className="text-red-600" title={hasError}>
                      ⚠
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div
          id={`tab-panel-${activeTab}`}
          role="tabpanel"
          className="flex-1 p-4 text-slate-900"
        >
          {lazy ? (
            <React.Suspense fallback={<div className="text-slate-500">Loading...</div>}>
              {activeTabContent}
            </React.Suspense>
          ) : (
            activeTabContent
          )}
        </div>
      </div>
    );
  }
);

TabLayout.displayName = "TabLayout";

