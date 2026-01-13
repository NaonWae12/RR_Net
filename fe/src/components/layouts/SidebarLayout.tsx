"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SidebarLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  sidebarWidth?: number;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  className?: string;
  mobileBreakpoint?: number;
}

export const SidebarLayout = React.memo<SidebarLayoutProps>(
  ({
    sidebar,
    children,
    sidebarWidth = 256,
    collapsed = false,
    onCollapse,
    className,
    mobileBreakpoint = 768,
  }) => {
    const [isMobileOpen, setIsMobileOpen] = React.useState(false);
    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < mobileBreakpoint);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }, [mobileBreakpoint]);

    const handleToggle = () => {
      if (isMobile) {
        setIsMobileOpen(!isMobileOpen);
      } else {
        onCollapse?.(!collapsed);
      }
    };

    return (
      <div className={cn("flex h-screen overflow-hidden", className)}>
        {/* Mobile Overlay */}
        {isMobile && isMobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:static inset-y-0 left-0 z-50 bg-background border-r transition-transform duration-300",
            isMobile && !isMobileOpen && "-translate-x-full",
            isMobile && isMobileOpen && "translate-x-0",
            !isMobile && collapsed && "-translate-x-full lg:translate-x-0 lg:w-0",
            !isMobile && !collapsed && "translate-x-0"
          )}
          style={{
            width: isMobile ? "100%" : collapsed ? 0 : sidebarWidth,
          }}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between p-4 border-b lg:hidden">
              <span className="font-semibold">Menu</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">{sidebar}</div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile Toggle Button */}
          <div className="lg:hidden p-4 border-b">
            <Button variant="ghost" size="icon" onClick={handleToggle}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    );
  }
);

SidebarLayout.displayName = "SidebarLayout";

