"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  maxItems?: number;
  className?: string;
}

export function Breadcrumb({ items, maxItems = 5, className }: BreadcrumbProps) {
  const pathname = usePathname();

  const breadcrumbItems = React.useMemo(() => {
    if (items) return items;

    // Auto-generate from pathname
    const paths = pathname.split("/").filter(Boolean);
    const generated: BreadcrumbItem[] = [
      { label: "Home", href: "/" },
    ];

    let currentPath = "";
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ");
      generated.push({
        label,
        href: index === paths.length - 1 ? undefined : currentPath,
      });
    });

    if (generated.length > maxItems) {
      const first = generated[0];
      const last = generated.slice(-2);
      return [first, { label: "..." }, ...last];
    }

    return generated;
  }, [pathname, items, maxItems]);

  return (
    <nav aria-label="Breadcrumb" className={["flex items-center space-x-2 text-sm", className].filter(Boolean).join(" ")}>
      {breadcrumbItems.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

