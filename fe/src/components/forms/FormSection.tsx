"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function FormSection({
  title,
  description,
  children,
  className,
  collapsible = false,
  defaultCollapsed = false,
}: FormSectionProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  return (
    <div className={cn("space-y-4 border-b pb-6 last:border-b-0", className)}>
      {(title || description || collapsible) && (
        <div className="flex items-center justify-between">
          <div>
            {title && (
              <h3 className="text-lg font-semibold">{title}</h3>
            )}
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {collapsible && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {isCollapsed ? "Expand" : "Collapse"}
            </button>
          )}
        </div>
      )}
      {!isCollapsed && <div className="space-y-4">{children}</div>}
    </div>
  );
}

