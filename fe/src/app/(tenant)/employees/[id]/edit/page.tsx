'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useRole } from '@/lib/hooks/useRole';
import { useNotificationStore } from '@/stores/notificationStore';
import { employeeService, type EmployeeUser } from '@/lib/api/employeeService';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';

export default function EditEmployeePage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const { originalRole, canSwitchRole } = useRole(); // Use originalRole for admin features
    const { showToast } = useNotificationStore();

    const [employee, setEmployee] = useState<EmployeeUser | null>(null);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const [isInactive, setIsInactive] = useState(false);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState('');

    useEffect(() => {
        if (id) {
            loadEmployee();
        }
    }, [id]);

    const loadEmployee = async () => {
        setLoading(true);
        try {
            // Note: employeeService.get might not exist yet, using list and filter for now
            // This is a placeholder - actual implementation should use proper API endpoint
            const res = await employeeService.list();
            const found = res.data?.find((e) => e.id === id);
            if (found) {
                setEmployee(found);
                setName(found.name);
                setEmail(found.email);
                setPhone(found.phone || '');
                setRole(found.role);
                // Check if employee is inactive (FE-only logic for now)
                setIsInactive(false); // Default to active, can be extended with backend support
            } else {
                showToast({ title: 'Error', description: 'Employee not found', variant: 'error' });
                router.push('/employees');
            }
        } catch (err: any) {
            const msg = err?.response?.data?.error ?? 'Failed to load employee';
            showToast({ title: 'Error', description: msg, variant: 'error' });
            router.push('/employees');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!name || !email || !role) {
            showToast({ title: 'Validation', description: 'Name, email, and role are required', variant: 'warning' });
            return;
        }

        setUpdating(true);
        try {
            // Note: employeeService.update might not exist yet
            // This is a placeholder - actual implementation should use proper API endpoint
            showToast({ title: 'Info', description: 'Update employee functionality will be implemented with backend API', variant: 'info' });
            // await employeeService.update(id, { name, email, phone, role });
            // await loadEmployee();
        } catch (err: any) {
            const msg = err?.response?.data?.error ?? 'Failed to update employee';
            showToast({ title: 'Error', description: msg, variant: 'error' });
        } finally {
            setUpdating(false);
        }
    };

    const handleDeactivate = () => {
        if (!confirm('Are you sure you want to deactivate this employee? They will not be able to access the system.')) {
            return;
        }

        setDeactivating(true);
        try {
            // FE-only: Just set UI state
            setIsInactive(true);
            showToast({
                title: 'Employee deactivated',
                description: 'This is a UI-only action. Backend implementation will be added later.',
                variant: 'success',
            });
        } catch (err: any) {
            showToast({ title: 'Error', description: 'Failed to deactivate employee', variant: 'error' });
        } finally {
            setDeactivating(false);
        }
    };

    if (loading) {
        return (
            <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <LoadingSpinner size={40} />
                </div>
            </RoleGuard>
        );
    }

    if (!employee) {
        return (
            <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
                <div className="text-center py-12">
                    <p className="text-slate-500">Employee not found</p>
                    <Link href="/employees" className="text-indigo-600 hover:underline mt-2 inline-block">
                        Back to employees
                    </Link>
                </div>
            </RoleGuard>
        );
    }

    return (
        <RoleGuard allowedRoles={["owner", "admin", "hr"]} redirectTo="/dashboard">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/employees"
                            className="text-slate-500 hover:text-slate-700"
                        >
                            <ArrowLeftIcon className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Edit Employee</h1>
                            <p className="text-slate-500 mt-1">Update employee information</p>
                        </div>
                    </div>
                </div>

                {/* Inactive Badge */}
                {isInactive && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <p className="text-sm font-medium text-red-900">Inactive Employee</p>
                                <p className="text-xs text-red-700 mt-0.5">This employee cannot access the system.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Form */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Full name"
                                disabled={isInactive}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email@example.com"
                                disabled={isInactive}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Phone (optional)</label>
                            <Input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="08xxxx"
                                disabled={isInactive}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                            <select
                                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                disabled={isInactive}
                            >
                                <option value="admin">Admin</option>
                                <option value="hr">HR</option>
                                <option value="finance">Finance</option>
                                <option value="technician">Technician</option>
                                <option value="collector">Collector</option>
                                <option value="client">Client</option>
                            </select>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                        <Button
                            onClick={handleUpdate}
                            disabled={updating || isInactive}
                            className="flex-1"
                        >
                            {updating ? 'Updating...' : 'Update Employee'}
                        </Button>
                        {!isInactive && canSwitchRole && (
                            <Button
                                variant="outline"
                                onClick={handleDeactivate}
                                disabled={deactivating}
                                className="border-red-300 text-red-600 hover:bg-red-50"
                            >
                                {deactivating ? 'Deactivating...' : 'Deactivate Employee'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </RoleGuard>
    );
}

