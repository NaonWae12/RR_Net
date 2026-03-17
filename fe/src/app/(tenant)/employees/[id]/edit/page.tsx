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
    const [baseSalary, setBaseSalary] = useState<number>(0);
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (id) {
            loadEmployee();
        }
    }, [id]);

    const loadEmployee = async () => {
        setLoading(true);
        try {
            // Fetch all and find (or use a dedicated get endpoint if available)
            // Re-using list() for compatibility, but normally we'd have a get(id)
            const res = await employeeService.list();
            const found = res.data?.find((e) => e.id === id);
            
            if (found) {
                setEmployee(found);
                setName(found.name);
                setEmail(found.email);
                setPhone(found.phone || '');
                setRole(found.role);
                setBaseSalary(found.base_salary || 0);
                setIsInactive(false); // Can be linked to status later
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
            await employeeService.update(id, { 
                name, 
                email, 
                phone: phone || undefined, 
                role: role as any,
                base_salary: Number(baseSalary),
                password: password || undefined
            });
            showToast({ title: 'Berhasil', description: 'Employee berhasil diupdate', variant: 'success' });
            setPassword('');
            await loadEmployee();
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
            // FE-only toggle for now, can be linked to a status patch
            setIsInactive(true);
            showToast({
                title: 'Employee deactivated',
                description: 'UI status updated. Full deactivation will be linked to backend status soon.',
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
                            <p className="text-slate-500 mt-1">Update employee information and salary</p>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Basic Information</h3>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Name</label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Full name"
                                    disabled={isInactive}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    disabled={isInactive}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Phone</label>
                                <Input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="08xxxx"
                                    disabled={isInactive}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Employment & Salary</h3>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Role</label>
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
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Base Salary (IDR)</label>
                                <Input
                                    type="number"
                                    value={baseSalary}
                                    onChange={(e) => setBaseSalary(Number(e.target.value))}
                                    placeholder="5000000"
                                    disabled={isInactive}
                                />
                                <p className="text-[10px] text-slate-500 mt-1 italic">
                                    Used for monthly payroll calculations.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Reset Password (optional)</label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Leave blank to keep current"
                                    disabled={isInactive}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-6 border-t border-slate-200">
                        <Button
                            onClick={handleUpdate}
                            disabled={updating || isInactive}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[200px]"
                        >
                            {updating ? 'Updating...' : 'Save Changes'}
                        </Button>
                        {!isInactive && canSwitchRole && (
                            <Button
                                variant="outline"
                                onClick={handleDeactivate}
                                disabled={deactivating}
                                className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                                {deactivating ? 'Deactivating...' : 'Deactivate'}
                            </Button>
                        )}
                        <Link href="/employees">
                            <Button variant="ghost">Cancel</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </RoleGuard>
    );
}

