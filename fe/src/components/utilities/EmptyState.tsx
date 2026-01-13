"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  illustration?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    text: string;
    onClick: () => void;
  };
  search?: boolean;
  help?: {
    text: string;
    link: string;
  };
  className?: string;
}

export const EmptyState = React.memo<EmptyStateProps>(
  ({ illustration, title, description, action, search, help, className }) => {
    const [searchQuery, setSearchQuery] = React.useState("");

    return (
      <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
        {illustration && (
          <div className="mb-6 text-muted-foreground" aria-hidden="true">
            {illustration}
          </div>
        )}

        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>

        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          {description}
        </p>

        {search && (
          <div className="w-full max-w-sm mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        )}

        {action && (
          <Button onClick={action.onClick} className="mb-4">
            {action.text}
          </Button>
        )}

        {help && (
          <a
            href={help.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            {help.text}
          </a>
        )}
      </div>
    );
  }
);

EmptyState.displayName = "EmptyState";

