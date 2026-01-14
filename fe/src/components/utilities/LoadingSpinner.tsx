"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | number;
  color?: string;
  overlay?: boolean;
  text?: string;
  variant?: "spinner" | "dots" | "pulse";
  className?: string;
}

export const LoadingSpinner = React.memo<LoadingSpinnerProps>(
  ({ size = "md", color, overlay = false, text, variant = "spinner", className }) => {
    const sizeValue =
      typeof size === "number"
        ? size
        : size === "sm"
        ? 16
        : size === "md"
        ? 24
        : 32;

    const spinnerColor = color || "currentColor";

    const renderSpinner = () => {
      switch (variant) {
        case "dots":
          return (
            <div className="flex items-center gap-1">
              <div
                className="rounded-full animate-bounce"
                style={{
                  width: sizeValue / 3,
                  height: sizeValue / 3,
                  backgroundColor: spinnerColor,
                  animationDelay: "0ms",
                }}
              />
              <div
                className="rounded-full animate-bounce"
                style={{
                  width: sizeValue / 3,
                  height: sizeValue / 3,
                  backgroundColor: spinnerColor,
                  animationDelay: "150ms",
                }}
              />
              <div
                className="rounded-full animate-bounce"
                style={{
                  width: sizeValue / 3,
                  height: sizeValue / 3,
                  backgroundColor: spinnerColor,
                  animationDelay: "300ms",
                }}
              />
            </div>
          );

        case "pulse":
          return (
            <div
              className="rounded-full animate-pulse"
              style={{
                width: sizeValue,
                height: sizeValue,
                backgroundColor: spinnerColor,
              }}
            />
          );

        default:
          return (
            <div
              className="inline-block animate-spin rounded-full border-2 border-t-transparent"
              style={{
                width: sizeValue,
                height: sizeValue,
                borderColor: spinnerColor,
                borderTopColor: spinnerColor,
              }}
              aria-label="Loading"
            />
          );
      }
    };

    const content = (
      <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
        {renderSpinner()}
        {text && (
          <p className="text-sm text-slate-600" style={{ color: spinnerColor }}>
            {text}
          </p>
        )}
      </div>
    );

    if (overlay) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          {content}
        </div>
      );
    }

    return content;
  }
);

LoadingSpinner.displayName = "LoadingSpinner";

