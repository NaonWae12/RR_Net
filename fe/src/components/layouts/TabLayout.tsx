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
            "flex border-b",
            vertical && "flex-col border-b-0 border-r",
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
                  "px-4 py-2 text-sm font-medium transition-colors border-b-4 -mb-px",
                  activeTab === tab.id
                    ? "border-primary/10 text-primary bg-primary/5"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-400",
                  tab.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:border-transparent",
                  vertical && "border-b-0 border-r-2 -mr-px",
                  !vertical && "border-b-2"
                )}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  {tab.badge && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                      {tab.badge}
                    </span>
                  )}
                  {hasError && (
                    <span className="text-destructive" title={hasError}>
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
          className="flex-1 p-4"
        >
          {lazy ? (
            <React.Suspense fallback={<div>Loading...</div>}>
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

