"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  arrow?: boolean;
  className?: string;
  modal?: boolean;
}

export const Popover = React.memo<PopoverProps>(
  ({
    trigger,
    content,
    open,
    onOpenChange,
    side = "bottom",
    align = "center",
    sideOffset = 4,
    arrow = true,
    className,
    modal = true,
  }) => {
    return (
      <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange} modal={modal}>
        <PopoverPrimitive.Trigger asChild>
          {trigger}
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            side={side}
            align={align}
            sideOffset={sideOffset}
            className={cn(
              "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
              className
            )}
          >
            {content}
            {arrow && (
              <PopoverPrimitive.Arrow className="fill-popover" />
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  }
);

Popover.displayName = "Popover";

