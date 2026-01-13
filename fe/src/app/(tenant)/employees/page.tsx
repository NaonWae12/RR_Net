'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { employeeService, type EmployeeUser } from '@/lib/api/employeeService';
import type { Role } from '@/lib/api/types';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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

  const hasRbacEmployee = useMemo(() => {
    const hasWildcard = data?.plan?.features?.includes('*') ?? false;
    if (hasWildcard) return true;
    return !!data?.features?.rbac_employee;
  }, [data?.features, data?.plan?.features]);

  const canCreateAdmin = user?.role === 'owner';
  const allowedRoles = useMemo(() => {
    if (user?.role === 'owner') return CREATABLE_ROLES;
    if (user?.role === 'admin') return CREATABLE_ROLES.filter((r) => r.value !== 'admin');
    return [];
  }, [user?.role]);

  useEffect(() => {
    if (!data && !dashboardLoading) {
      fetchDashboardData();
    }
  }, [data, dashboardLoading, fetchDashboardData]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await employeeService.list();
      setEmployees(res.data ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to load employees';
      showToast({ title: 'Error', description: msg, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasRbacEmployee && data) {
      showToast({ title: 'Tidak tersedia', description: 'Fitur RBAC Employee tidak aktif di tier ini', variant: 'warning' });
      router.replace('/dashboard');
      return;
    }
    if (hasRbacEmployee) {
      loadEmployees();
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
      setRole(user?.role === 'admin' ? 'hr' : 'admin');
      await loadEmployees();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Failed to create employee';
      showToast({ title: 'Gagal', description: msg, variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  if (dashboardLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  return (
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
              className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
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
            <Button onClick={onCreate} disabled={creating} className="w-full">
              {creating ? 'Creating...' : 'Create'}
            </Button>
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
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Email</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={3}>
                    No users found.
                  </td>
                </tr>
              ) : (
                employees.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{u.name}</td>
                    <td className="px-4 py-2">{u.email}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


