"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  arrow?: boolean;
  trigger?: "hover" | "click" | "focus";
  className?: string;
  sideOffset?: number;
}

export const Tooltip = React.memo<TooltipProps>(
  ({
    content,
    children,
    position = "top",
    delay = 300,
    arrow = true,
    trigger = "hover",
    className,
    sideOffset = 4,
  }) => {
    const [open, setOpen] = React.useState(false);

    const handleOpenChange = (newOpen: boolean) => {
      if (trigger === "click") {
        setOpen(newOpen);
      }
    };

    return (
      <TooltipPrimitive.Provider delayDuration={delay}>
        <TooltipPrimitive.Root open={open} onOpenChange={handleOpenChange}>
          <TooltipPrimitive.Trigger asChild>
            {children}
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side={position}
              sideOffset={sideOffset}
              className={cn(
                "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                className
              )}
            >
              {content}
              {arrow && (
                <TooltipPrimitive.Arrow className="fill-primary" />
              )}
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    );
  }
);

Tooltip.displayName = "Tooltip";

