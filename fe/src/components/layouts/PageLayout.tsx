"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageLayoutProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  padding?: number;
  className?: string;
  children: React.ReactNode;
}

export const PageLayout = React.memo<PageLayoutProps>(
  ({
    title,
    subtitle,
    breadcrumbs,
    actions,
    header,
    sidebar,
    padding = 6,
    className,
    children,
  }) => {
    return (
      <div className={cn("flex flex-col min-h-screen", className)}>
        {/* Header */}
        {(title || subtitle || breadcrumbs || actions || header) && (
          <div className="border-b bg-background">
            <div className="mx-auto w-full" style={{ paddingLeft: `${padding * 4}px`, paddingRight: `${padding * 4}px` }}>
              <div className="flex items-center justify-between py-4">
                <div className="flex-1">
                  {breadcrumbs && breadcrumbs.length > 0 && (
                    <Breadcrumb items={breadcrumbs} className="mb-2" />
                  )}
                  {title && (
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                  )}
                  {subtitle && (
                    <p className="text-muted-foreground mt-1">{subtitle}</p>
                  )}
                  {header}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-1">
          {sidebar && (
            <aside className="w-64 border-r bg-muted/40 flex-shrink-0">
              {sidebar}
            </aside>
          )}
          <main
            className="flex-1 overflow-auto"
            style={{ padding: `${padding * 4}px` }}
          >
            {children}
          </main>
        </div>
      </div>
    );
  }
);

PageLayout.displayName = "PageLayout";

