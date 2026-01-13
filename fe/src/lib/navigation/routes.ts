import { ReactNode } from "react";

export interface RouteConfig {
  path: string;
  name: string;
  icon?: ReactNode;
  component?: React.ComponentType;
  requiredCapabilities?: string[];
  requiredRoles?: string[];
  requiredFeatures?: string[];
  children?: RouteConfig[];
  hidden?: boolean;
  external?: boolean;
}

// Base route configuration
export const baseRoutes: RouteConfig[] = [
  {
    path: "/dashboard",
    name: "Dashboard",
    requiredCapabilities: [],
  },
  {
    path: "/clients",
    name: "Clients",
    requiredCapabilities: ["client.view"],
    children: [
      {
        path: "/clients/create",
        name: "Create Client",
        requiredCapabilities: ["client.create"],
        hidden: true,
      },
    ],
  },
  {
    path: "/billing",
    name: "Billing",
    requiredCapabilities: ["billing.view"],
    children: [
      {
        path: "/billing/invoices",
        name: "Invoices",
        requiredCapabilities: ["billing.view"],
      },
      {
        path: "/billing/payments",
        name: "Payments",
        requiredCapabilities: ["billing.view"],
      },
    ],
  },
  {
    path: "/network",
    name: "Network",
    requiredCapabilities: ["network.view"],
  },
  {
    path: "/maps",
    name: "Maps",
    requiredCapabilities: ["maps.view"],
  },
  {
    path: "/technician",
    name: "Technician",
    requiredCapabilities: ["technician.view"],
  },
];

export function filterRoutesByCapabilities(
  routes: RouteConfig[],
  userCapabilities: string[]
): RouteConfig[] {
  return routes
    .filter((route) => {
      if (route.hidden) return false;
      if (!route.requiredCapabilities || route.requiredCapabilities.length === 0) {
        return true;
      }
      return route.requiredCapabilities.some((cap) => userCapabilities.includes(cap));
    })
    .map((route) => ({
      ...route,
      children: route.children
        ? filterRoutesByCapabilities(route.children, userCapabilities)
        : undefined,
    }));
}

export function filterRoutesByRoles(
  routes: RouteConfig[],
  userRole: string
): RouteConfig[] {
  return routes
    .filter((route) => {
      if (route.hidden) return false;
      if (!route.requiredRoles || route.requiredRoles.length === 0) {
        return true;
      }
      return route.requiredRoles.includes(userRole);
    })
    .map((route) => ({
      ...route,
      children: route.children
        ? filterRoutesByRoles(route.children, userRole)
        : undefined,
    }));
}

