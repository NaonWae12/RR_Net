"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { baseRoutes, filterRoutesByCapabilities } from "@/lib/navigation/routes";

interface DynamicSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DynamicSidebar({ isOpen, onClose }: DynamicSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const filteredRoutes = useMemo(() => {
    if (!user?.capabilities) return [];
    return filterRoutesByCapabilities(baseRoutes, user.capabilities);
  }, [user?.capabilities]);

  const renderNavItem = (route: typeof baseRoutes[0], level = 0) => {
    const isActive = pathname === route.path || pathname.startsWith(route.path + "/");
    const padding = level > 0 ? `pl-${(level + 1) * 4}` : "";

    return (
      <div key={route.path}>
        <Link
          href={route.path}
          onClick={onClose}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${padding}
            ${isActive
              ? "bg-indigo-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }
          `}
        >
          {route.icon}
          <span className="font-medium">{route.name}</span>
        </Link>
        {route.children && route.children.length > 0 && (
          <div className="ml-4 mt-1 space-y-1">
            {route.children.map((child) => renderNavItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">RR</span>
            </div>
            <span className="text-lg font-bold">RRNet</span>
          </Link>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto">
          {filteredRoutes.map((route) => renderNavItem(route))}
        </nav>
      </aside>
    </>
  );
}

