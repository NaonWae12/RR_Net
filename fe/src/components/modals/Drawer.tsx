"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  side?: "top" | "right" | "bottom" | "left";
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Drawer({
  isOpen,
  onClose,
  side = "right",
  title,
  subtitle,
  footer,
  className,
  children,
}: DrawerProps) {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sideClasses = {
    top: "inset-x-0 top-0 border-b",
    right: "inset-y-0 right-0 border-l h-full",
    bottom: "inset-x-0 bottom-0 border-t",
    left: "inset-y-0 left-0 border-r h-full",
  };

  const sideWidths = {
    top: "h-auto max-h-[80vh]",
    right: "w-full sm:w-[400px]",
    bottom: "h-auto max-h-[80vh]",
    left: "w-full sm:w-[400px]",
  };

  const animations = {
    top: "animate-in slide-in-from-top",
    right: "animate-in slide-in-from-right",
    bottom: "animate-in slide-in-from-bottom",
    left: "animate-in slide-in-from-left",
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Drawer Content */}
      <div
        className={cn(
          "fixed z-50 bg-background p-6 shadow-lg transition ease-in-out",
          sideClasses[side],
          sideWidths[side],
          animations[side],
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "drawer-title" : undefined}
        aria-describedby={subtitle ? "drawer-description" : undefined}
      >
        {(title || subtitle) && (
          <div className="flex items-center justify-between mb-4">
            <div>
              {title && (
                <h2 id="drawer-title" className="text-lg font-semibold leading-none tracking-tight">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p id="drawer-description" className="mt-2 text-sm text-slate-600">
                  {subtitle}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        )}

        <div className="overflow-y-auto max-h-[calc(100vh-200px)]">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t pt-4 mt-4">{footer}</div>
        )}
      </div>
    </>
  );
}

