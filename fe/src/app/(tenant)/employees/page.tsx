'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useRole } from '@/lib/hooks/useRole';
import { employeeService, type EmployeeUser } from '@/lib/api/employeeService';
import type { Role } from '@/lib/api/types';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { setActiveRole } from '@/lib/utils/roleContext';

const CREATABLE_ROLES: Array<{ value: Exclude<Role, 'super_admin' | 'owner'>; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' },
  { value: 'technician', label: 'Technician' },
  { value: 'collector', label: 'Collector' },
  { value: 'client', label: 'Client' },
];

export default function EmployeesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { originalRole, canSwitchRole } = useRole(); // Use originalRole for admin features
  const { showToast } = useNotificationStore();
  const { data, loading: dashboardLoading, fetchDashboardData } = useDashboardStore();

  const [employees, setEmployees] = useState<EmployeeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Exclude<Role, 'super_admin' | 'owner'>>('admin');

  // Feature flag for UI actions only (not for blocking fetch)
  const hasRbacEmployee = useMemo(() => {
    const hasWildcard = data?.plan?.features?.includes('*') ?? false;
    if (hasWildcard) return true;
    return !!data?.features?.rbac_employee;
  }, [data?.features, data?.plan?.features]);

  // Use originalRole for admin-only features (role switching, creating admin users)
  const canCreateAdmin = originalRole === 'owner';
  const allowedRoles = useMemo(() => {
    if (originalRole === 'owner') return CREATABLE_ROLES;
    if (originalRole === 'admin') return CREATABLE_ROLES.filter((r) => r.value !== 'admin');
    return [];
  }, [originalRole]);

  // Wait for authStore.ready before fetching - consistent with dashboard pattern
  // This ensures token is fully synced to apiClient before making requests
  useEffect(() => {
    const { ready } = useAuthStore.getState();
    
    if (ready) {
      // Auth is ready, fetch immediately
      loadEmployees();
    } else {
      // Wait for auth ready using subscribe pattern (like dashboard)
      const unsubscribe = useAuthStore.subscribe((state) => {
        if (state.ready && !loading) {
          loadEmployees();
          unsubscribe(); // Clean up after first ready signal
        }
      });
      
      // Cleanup on unmount
      return () => {
        unsubscribe();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEmployees = async () => {
    // Prevent concurrent calls - guard against multiple simultaneous requests
    if (loading) {
      return; // Already loading, skip this call
    }
    
    setLoading(true);
    
    try {
      // Timeout safety net: 15 seconds
      // If API hangs, this will reject and prevent infinite loading
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout: Employees data took too long to load. Please try again.'));
        }, 15000); // 15 seconds
      });
      
      // Race between API call and timeout
      const apiPromise = employeeService.list();
      const res = await Promise.race([apiPromise, timeoutPromise]);
      
      setEmployees(res.data ?? []);
    } catch (err: any) {
      // Handle both API errors and timeout errors
      let errorMessage = 'Failed to load employees';
      
      if (err?.message && err.message.includes('timeout')) {
        errorMessage = err.message;
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      showToast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'error' 
      });
    } finally {
      // Always set loading to false, even if error or timeout
      // This prevents infinite spinner scenario
      setLoading(false);
    }
  };

  // Feature flag check for UI actions only (not blocking)
  // Show warning if feature not available, but don't redirect immediately
  useEffect(() => {
    if (data && !hasRbacEmployee) {
      // Only show warning, don't redirect - let users see the page
      // Redirect only happens via RoleGuard if user doesn't have permission
      showToast({ 
        title: 'Fitur terbatas', 
        description: 'Beberapa fitur RBAC Employee mungkin tidak tersedia di tier ini', 
        variant: 'warning' 
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRbacEmployee, data]);

  const onCreate = async () => {
    if (!email || !password || !name || !role) {
      showToast({ title: 'Validasi', description: 'Email, password, nama, dan role wajib diisi', variant: 'warning' });
      return;
    }
    if (role === 'admin' && !canCreateAdmin) {
      showToast({ title: 'Akses ditolak', description: 'Hanya owner yang boleh membuat user role admin', variant: 'error' });
      return;
    }
    if (!allowedRoles.some((r) => r.value === role)) {
      showToast({ title: 'Akses ditolak', description: 'Role tersebut tidak boleh dibuat oleh user ini', variant: 'error' });
      return;
    }

    setCreating(true);
    try {
      await employeeService.create({
        email,
        password,
        name,
        phone: phone || undefined,
        role,
      });
      showToast({ title: 'Berhasil', description: 'Employee berhasil dibuat', variant: 'success' });
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
      setRole(originalRole === 'admin' ? 'hr' : 'admin');
      await loadEmployees();
    } catch (err: any) {
      // Better error handling with more specific messages
      let errorMessage = 'Failed to create employee';
      
      // Check for specific error messages from backend
      if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (err?.code === 'DASHBOARD_UNAUTHORIZED' || err?.code === 'UNAUTHORIZED') {
        errorMessage = 'Authentication error. Please refresh the page and try again.';
      } else if (err?.statusCode === 500) {
        errorMessage = 'Server error occurred. Please check the server logs or try again later.';
      } else if (err?.statusCode === 400) {
        errorMessage = 'Invalid request. Please check your input and try again.';
      } else if (err?.statusCode === 403) {
        errorMessage = 'You do not have permission to create this employee.';
      }
      
      showToast({ 
        title: 'Gagal', 
        description: errorMessage, 
        variant: 'error' 
      });
    } finally {
      setCreating(false);
    }
  };

  // Don't block page render waiting for dashboard data
  // Dashboard is best-effort enhancement, employees page is critical path

  return (
    <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
            <p className="text-slate-500 mt-1">Manage user accounts inside your tenant (RBAC tiers only)</p>
          </div>
          <Button variant="outline" onClick={loadEmployees} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>

        {/* Create form (MVP) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">Create Employee/User</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone (optional)</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxx" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select
                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
              >
                {allowedRoles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {!canCreateAdmin && role === 'admin' && (
                <p className="text-xs text-red-600 mt-1">Only owner can create admin.</p>
              )}
            </div>
            <div className="flex items-end">
              <Button onClick={onCreate} disabled={creating || !hasRbacEmployee} className="w-full">
                {creating ? 'Creating...' : 'Create'}
              </Button>
              {!hasRbacEmployee && (
                <p className="text-xs text-slate-500 mt-1">Fitur ini memerlukan RBAC Employee tier</p>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-800">Users ({employees.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-700">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-700">Email</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-700">Role</th>
                  {canSwitchRole ? (
                    <th className="text-left px-4 py-2 font-medium text-slate-700">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-slate-500" colSpan={canSwitchRole ? 4 : 3}>
                      No users found.
                    </td>
                  </tr>
                ) : (
                  employees.map((u) => (
                    <tr key={u.id} className="border-t border-slate-200 text-slate-900">
                      <td className="px-4 py-2 text-slate-900">{u.name}</td>
                      <td className="px-4 py-2 text-slate-900">{u.email}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {u.role}
                        </span>
                      </td>
                      {canSwitchRole && (
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/employees/${u.id}/edit`}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </Link>
                            {u.role !== "admin" && u.role !== "owner" && originalRole && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setActiveRole(originalRole, u.role);
                                  showToast({
                                    title: "Role switched",
                                    description: `Now working as ${u.role}`,
                                    variant: "success",
                                  });
                                  router.push("/dashboard");
                                  router.refresh();
                                }}
                                className="text-xs"
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                                Work As
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}


