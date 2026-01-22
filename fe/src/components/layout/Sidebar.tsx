'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useRole } from '@/lib/hooks/useRole';
import { Role } from '@/lib/api/types';
import { SiWhatsapp } from 'react-icons/si';
import { clearRoleContext } from '@/lib/utils/roleContext';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  requiredAnyFeatures?: string[]; // if provided, at least one must be enabled
  implemented?: boolean; // allow hiding routes that are not implemented yet
  // Role-based filtering (hybrid strategy)
  allowedRoles?: Role[]; // Whitelist: only these roles can see this menu
  restrictedRoles?: Role[]; // Blacklist: these roles cannot see this menu
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    // All roles can see Dashboard, but HR and Finance see their own Dashboard instead
    restrictedRoles: ['hr', 'finance'], // HR and Finance roles see their own Dashboard menu items instead
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Clients',
    href: '/clients',
    // All roles except client, hr, and finance (hr and finance see only their own menus)
    restrictedRoles: ['client', 'hr', 'finance'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Billing',
    href: '/billing',
    // All roles except technician, client, hr, and finance (finance sees Finance menus)
    restrictedRoles: ['technician', 'client', 'hr', 'finance'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: 'Settlement',
    href: '/settlement',
    // Admin, finance bisa akses, tapi technician dan hr tidak
    allowedRoles: ['owner', 'admin', 'finance'],
    restrictedRoles: ['technician', 'hr'], // Explicitly exclude technician and hr
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Network',
    href: '/network',
    requiredAnyFeatures: ['mikrotik_api_basic', 'mikrotik_api'],
    allowedRoles: ['owner', 'admin'],
    restrictedRoles: ['hr', 'finance'], // HR and Finance don't need network access
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
  {
    label: 'Vouchers',
    href: '/vouchers',
    requiredAnyFeatures: ['mikrotik_api_basic', 'mikrotik_api'],
    allowedRoles: ['owner', 'admin'],
    restrictedRoles: ['hr', 'finance'], // HR and Finance don't need vouchers access
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10a3 3 0 01-3 3H6a3 3 0 01-3-3V8a3 3 0 013-3h12a3 3 0 013 3v2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 13v6m10-6v6M9 19h6" />
      </svg>
    ),
  },
  {
    label: 'Maps',
    href: '/maps',
    requiredAnyFeatures: ['odp_maps', 'client_maps'],
    allowedRoles: ['owner', 'admin', 'technician'],
    restrictedRoles: ['hr', 'finance'], // HR and Finance don't need maps access
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  // HR-specific menu items (only shown when role is HR)
  {
    label: 'HR Dashboard',
    href: '/hr/dashboard',
    requiredAnyFeatures: ['rbac_employee', 'rbac_full', 'rbac_basic'],
    allowedRoles: ['hr'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Employees',
    href: '/hr/employees',
    requiredAnyFeatures: ['rbac_employee', 'rbac_full', 'rbac_basic'],
    allowedRoles: ['hr'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: 'Attendance',
    href: '/hr/attendance',
    requiredAnyFeatures: ['rbac_employee', 'rbac_full', 'rbac_basic'],
    allowedRoles: ['hr'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Leave Requests',
    href: '/hr/leave-requests',
    requiredAnyFeatures: ['rbac_employee', 'rbac_full', 'rbac_basic'],
    allowedRoles: ['hr'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Payroll',
    href: '/hr/payroll',
    requiredAnyFeatures: ['rbac_employee', 'rbac_full', 'rbac_basic'],
    allowedRoles: ['hr'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'HR Reports',
    href: '/hr/reports',
    requiredAnyFeatures: ['rbac_employee', 'rbac_full', 'rbac_basic'],
    allowedRoles: ['hr'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  // Finance-specific menu items (only shown when role is finance)
  {
    label: 'Finance Dashboard',
    href: '/finance/dashboard',
    allowedRoles: ['finance'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Invoices',
    href: '/finance/invoices',
    allowedRoles: ['finance'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Payments',
    href: '/finance/payments',
    allowedRoles: ['finance'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    href: '/finance/reports',
    allowedRoles: ['finance'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'Deposits',
    href: '/finance/deposits',
    allowedRoles: ['finance'],
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Employees',
    href: '/employees',
    requiredAnyFeatures: ['rbac_employee', 'rbac_full', 'rbac_basic'],
    allowedRoles: ['owner', 'admin'],
    restrictedRoles: ['hr'], // Hide from HR role (they see HR/employees above)
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: 'Service Setup',
    href: '/service-setup',
    requiredAnyFeatures: ['service_packages'],
    allowedRoles: ['owner', 'admin'],
    restrictedRoles: ['hr', 'finance'], // HR and Finance don't need service setup
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    label: 'Technician',
    href: '/technician/tasks',
    requiredAnyFeatures: ['odp_maps', 'client_maps'],
    allowedRoles: ['owner', 'admin', 'technician'],
    restrictedRoles: ['hr', 'finance'], // HR and Finance don't need technician menu
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Collector',
    href: '/collector',
    allowedRoles: ['technician'],
    restrictedRoles: ['hr', 'finance'], // HR and Finance don't need collector
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'WhatsApp',
    href: '/whatsapp',
    allowedRoles: ['owner', 'admin'],
    restrictedRoles: ['hr', 'finance'], // HR and Finance don't need WhatsApp
    icon: <SiWhatsapp className="w-5 h-5" />,
  },
  {
    label: 'Reports',
    href: '/reports',
    requiredAnyFeatures: ['payment_reporting_advanced', 'dashboard_pendapatan', 'reports_advanced'],
    implemented: false, // no tenant reports routes/pages yet
    allowedRoles: ['owner', 'admin'],
    restrictedRoles: ['hr', 'finance'], // HR and Finance have their own Reports menus
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    allowedRoles: ['owner'],
    restrictedRoles: ['hr', 'finance'], // HR and Finance don't need settings
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useDashboardStore();
  const { role, originalRole, switched, roleContext } = useRole();
  const effectiveRole = role; // Effective role (switched if applicable)

  const hasWildcard = data?.plan?.features?.includes('*') ?? false;
  const featuresMap = data?.features ?? {};

  const hasAnyFeature = (codes?: string[]) => {
    if (!codes || codes.length === 0) return true;
    if (hasWildcard) return true;
    return codes.some((c) => !!featuresMap[c]);
  };

  /**
   * Check if user role has access to a menu item
   * Uses hybrid strategy: allowedRoles (whitelist) and restrictedRoles (blacklist)
   * Note: Technician can also access collector menus (collector is subset of technician)
   * IMPORTANT: When admin is switched, ONLY show menus for the switched role (strict mode)
   */
  function hasRoleAccess(item: NavItem, role?: Role, isSwitched?: boolean, originalRole?: Role): boolean {
    if (!role) return false;

    // STRICT MODE: When admin is switched, ONLY show menus for the switched role
    // Do NOT show admin-only menus when switched
    if (isSwitched && originalRole && (originalRole === 'admin' || originalRole === 'owner')) {
      // Only show menus that are allowed for the switched role
      if (item.allowedRoles && item.allowedRoles.length > 0) {
        const hasDirectAccess = item.allowedRoles.includes(role);
        const isTechnicianAccessingCollector = role === 'technician' && item.allowedRoles.includes('collector');
        if (!hasDirectAccess && !isTechnicianAccessingCollector) {
          return false;
        }
      }

      // Hide admin-only menus when switched
      if (item.allowedRoles && item.allowedRoles.length > 0) {
        const isAdminOnly = item.allowedRoles.every(r => r === 'admin' || r === 'owner');
        if (isAdminOnly && role !== 'admin' && role !== 'owner') {
          return false;
        }
      }
    }

    // If allowedRoles is specified, role must be in the list
    // Technician can also access collector menus
    if (item.allowedRoles && item.allowedRoles.length > 0) {
      const hasDirectAccess = item.allowedRoles.includes(role);
      const isTechnicianAccessingCollector = role === 'technician' && item.allowedRoles.includes('collector');
      if (!hasDirectAccess && !isTechnicianAccessingCollector) {
        return false;
      }
    }

    // If restrictedRoles is specified, role must NOT be in the list
    if (item.restrictedRoles && item.restrictedRoles.length > 0) {
      if (item.restrictedRoles.includes(role)) {
        return false;
      }
    }

    return true;
  }

  const visibleNavItems = navItems.filter((item) => {
    // Skip if not implemented
    if (item.implemented === false) return false;

    // Feature-based filtering (existing)
    if (!hasAnyFeature(item.requiredAnyFeatures)) return false;

    // Role-based filtering - uses effectiveRole with strict mode when switched
    if (!hasRoleAccess(item, effectiveRole, switched, originalRole)) return false;

    return true;
  });

  const handleReturnToOriginalRole = () => {
    clearRoleContext();
    router.push('/dashboard');
    router.refresh();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo & Role Context */}
        <div className="border-b border-slate-800">
          <div className="h-16 flex items-center px-6">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">RR</span>
              </div>
              <span className="text-lg font-bold">RRNet</span>
            </Link>
          </div>
          {switched && roleContext && (
            <div className="px-6 pb-3 space-y-2">
              <div className="bg-amber-900/50 border border-amber-700/50 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-amber-200">
                  {originalRole === "owner" ? "Owner" : "Admin"}
                </p>
                <p className="text-xs text-amber-300 mt-0.5">
                  Working as: <span className="capitalize font-medium">{roleContext.activeRole}</span>
                </p>
              </div>
              <Button
                onClick={handleReturnToOriginalRole}
                variant="outline"
                size="sm"
                className="w-full text-xs bg-amber-800/30 border-amber-700/50 text-amber-200 hover:bg-amber-800/50 hover:text-amber-100"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Return to {originalRole === 'owner' ? 'Owner' : 'Admin'} Mode
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                  ${isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}


