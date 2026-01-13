"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface GridLayoutProps {
  columns?: number;
  rows?: number;
  gap?: number;
  autoRows?: boolean;
  autoColumns?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const GridLayout = React.memo<GridLayoutProps>(
  ({
    columns,
    rows,
    gap = 4,
    autoRows = false,
    autoColumns = false,
    className,
    children,
  }) => {
    const gridStyle: React.CSSProperties = {
      display: "grid",
      gap: `${gap * 4}px`,
    };

    if (columns) {
      gridStyle.gridTemplateColumns = autoColumns
        ? `repeat(auto-fill, minmax(${columns}px, 1fr))`
        : `repeat(${columns}, 1fr)`;
    }

    if (rows) {
      gridStyle.gridTemplateRows = autoRows
        ? `repeat(auto-fill, minmax(${rows}px, 1fr))`
        : `repeat(${rows}, 1fr)`;
    }

    return (
      <div className={cn("grid", className)} style={gridStyle}>
        {children}
      </div>
    );
  }
);

GridLayout.displayName = "GridLayout";

