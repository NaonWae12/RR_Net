"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonLoaderProps {
  type?: "text" | "avatar" | "card" | "custom";
  lines?: number;
  width?: string | number;
  height?: string | number;
  animated?: boolean;
  className?: string;
}

export const SkeletonLoader = React.memo<SkeletonLoaderProps>(
  ({ type = "text", lines = 1, width, height, animated = true, className }) => {
    const getRandomWidth = () => {
      const min = 60;
      const max = 100;
      return `${Math.floor(Math.random() * (max - min) + min)}%`;
    };

    const renderSkeleton = () => {
      switch (type) {
        case "avatar":
          return (
            <div
              className={cn(
                "rounded-full bg-muted",
                animated && "animate-pulse"
              )}
              style={{
                width: width || 40,
                height: height || 40,
              }}
            />
          );

        case "card":
          return (
            <div
              className={cn(
                "rounded-lg bg-muted p-4 space-y-3",
                animated && "animate-pulse"
              )}
              style={{ width, height }}
            >
              <div className="h-4 bg-muted-foreground/20 rounded w-3/4" />
              <div className="h-4 bg-muted-foreground/20 rounded w-1/2" />
              <div className="h-4 bg-muted-foreground/20 rounded w-5/6" />
            </div>
          );

        case "custom":
          return (
            <div
              className={cn("bg-muted rounded", animated && "animate-pulse", className)}
              style={{ width, height }}
            />
          );

        default:
          return (
            <div className="space-y-2">
              {Array.from({ length: lines }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-4 bg-muted rounded",
                    animated && "animate-pulse"
                  )}
                  style={{
                    width: width || (index === lines - 1 ? getRandomWidth() : "100%"),
                  }}
                />
              ))}
            </div>
          );
      }
    };

    return <div className={cn("w-full", className)}>{renderSkeleton()}</div>;
  }
);

SkeletonLoader.displayName = "SkeletonLoader";

