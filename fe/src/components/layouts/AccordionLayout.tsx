"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
}

export interface AccordionLayoutProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  className?: string;
}

export const AccordionLayout = React.memo<AccordionLayoutProps>(
  ({ items, allowMultiple = false, className }) => {
    const [openItems, setOpenItems] = React.useState<Set<string>>(
      new Set(items.filter((item) => item.defaultOpen).map((item) => item.id))
    );

    const toggleItem = (itemId: string) => {
      setOpenItems((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          if (!allowMultiple) {
            next.clear();
          }
          next.add(itemId);
        }
        return next;
      });
    };

    return (
      <div className={cn("space-y-2", className)}>
        {items.map((item) => {
          const isOpen = openItems.has(item.id);

          return (
            <div key={item.id} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => !item.disabled && toggleItem(item.id)}
                disabled={item.disabled}
                className={cn(
                  "w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors",
                  item.disabled && "opacity-50 cursor-not-allowed"
                )}
                aria-expanded={isOpen}
                aria-controls={`accordion-content-${item.id}`}
              >
                <span className="font-medium">{item.title}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isOpen && "transform rotate-180"
                  )}
                />
              </button>
              {isOpen && (
                <div
                  id={`accordion-content-${item.id}`}
                  className="p-4 border-t bg-muted/30"
                >
                  {item.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);

AccordionLayout.displayName = "AccordionLayout";

