"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface DropdownItem {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  label?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  onSelect?: (value: string) => void;
}

export const Dropdown = React.memo<DropdownProps>(
  ({ trigger, items, label, align = "end", side = "bottom", className, onSelect }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} side={side} className={className}>
          {label && (
            <>
              <DropdownMenuLabel>{label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          {items.map((item, index) => {
            if (item.separator) {
              return <DropdownMenuSeparator key={`separator-${index}`} />;
            }

            return (
              <DropdownMenuItem
                key={item.value || index}
                onClick={() => {
                  item.onClick?.();
                  if (item.value) {
                    onSelect?.(item.value);
                  }
                }}
                disabled={item.disabled}
              >
                {item.icon && <span className="mr-2">{item.icon}</span>}
                {item.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

Dropdown.displayName = "Dropdown";

