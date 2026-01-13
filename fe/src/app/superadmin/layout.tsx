"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { SuperAdminHeader } from "@/components/layout/SuperAdminHeader";

interface SuperAdminLayoutProps {
  children: ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/superadmin", label: "Dashboard" },
    { href: "/superadmin/tenants", label: "Tenants" },
    { href: "/superadmin/plans", label: "Plans" },
    { href: "/superadmin/addons", label: "Addons" },
  ];

  const isActive = (href: string) => {
    if (href === "/superadmin") {
      return pathname === "/superadmin";
    }
    return pathname?.startsWith(href);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50">
        <div className="flex">
          {/* Sidebar */}
          <aside className="w-64 bg-white shadow-sm min-h-screen">
            <div className="p-6">
              <h1 className="text-xl font-bold text-slate-900">Super Admin</h1>
            </div>
            <nav className="px-4 space-y-2">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-4 py-2 rounded-md transition-colors ${
                      active
                        ? "bg-slate-100 text-slate-900 font-medium"
                        : "hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            <SuperAdminHeader />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

