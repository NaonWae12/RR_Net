"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ResponsiveConfig {
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

export interface CardLayoutProps {
  columns?: number;
  gap?: number;
  responsive?: ResponsiveConfig;
  children: React.ReactNode;
  className?: string;
}

export const CardLayout = React.memo<CardLayoutProps>(
  ({ columns = 3, gap = 4, responsive, children, className }) => {
    const getGridColumns = () => {
      if (responsive) {
        return {
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          "@media (min-width: 640px)": {
            gridTemplateColumns: `repeat(${responsive.sm || columns}, 1fr)`,
          },
          "@media (min-width: 768px)": {
            gridTemplateColumns: `repeat(${responsive.md || columns}, 1fr)`,
          },
          "@media (min-width: 1024px)": {
            gridTemplateColumns: `repeat(${responsive.lg || columns}, 1fr)`,
          },
          "@media (min-width: 1280px)": {
            gridTemplateColumns: `repeat(${responsive.xl || columns}, 1fr)`,
          },
        };
      }
      return {
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      };
    };

    return (
      <div
        className={cn("grid", `gap-${gap}`, className)}
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: `${gap * 4}px`,
        }}
      >
        {React.Children.map(children, (child, index) => (
          <div key={index}>{child}</div>
        ))}
      </div>
    );
  }
);

CardLayout.displayName = "CardLayout";

