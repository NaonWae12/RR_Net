'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { authService } from '@/lib/api/authService';
import { useNotificationStore } from '@/stores/notificationStore';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Password lama harus diisi'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  password_confirmation: z.string().min(1, 'Konfirmasi password harus diisi'),
}).refine((data) => data.password === data.password_confirmation, {
  message: "Konfirmasi password tidak cocok",
  path: ["password_confirmation"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function PortalProfilePage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const { showToast } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<'info' | 'security'>('info');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const onChangePassword = async (data: PasswordFormValues) => {
    try {
      await authService.changePassword(data);
      showToast({
        title: 'Password Updated',
        description: 'Password anda berhasil diubah.',
        variant: 'success',
      });
      reset();
    } catch (err: any) {
      showToast({
        title: 'Gagal Mengubah Password',
        description: err.response?.data?.error || 'Terjadi kesalahan saat mengubah password',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
       <div>
         <h1 className="text-xl font-bold text-slate-900">Pengaturan Akun</h1>
         <p className="text-sm text-slate-500">Kelola informasi profil dan keamanan akun anda.</p>
       </div>

       {/* Profile Header */}
       <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-2xl font-bold text-slate-500">
                {user?.name?.charAt(0) || 'U'}
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-900">{user?.name}</h2>
                <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-500">{user?.email}</p>
                    <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                    <p className="text-sm text-slate-500 capitalize">{user?.role}</p>
                </div>
            </div>
       </div>

       {/* Tabs */}
       <div className="flex border-b border-slate-200">
            <button
                onClick={() => setActiveTab('info')}
                className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'info' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
                Informasi
            </button>
            <button
                onClick={() => setActiveTab('security')}
                className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'security' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
                Keamanan
            </button>
       </div>

       {/* Content */}
       <div className="bg-white rounded-xl border border-slate-200 p-6">
            {activeTab === 'info' && (
                <div className="space-y-5">
                    <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Informasi Pribadi</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Nama Lengkap</label>
                            <p className="text-sm font-medium text-slate-900 bg-slate-50 p-3 rounded-lg border border-slate-100">{user?.name}</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                             <p className="text-sm font-medium text-slate-900 bg-slate-50 p-3 rounded-lg border border-slate-100">{user?.email}</p>
                        </div>
                        {user?.phone && (
                             <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Nomor Telepon</label>
                                 <p className="text-sm font-medium text-slate-900 bg-slate-50 p-3 rounded-lg border border-slate-100">{user?.phone}</p>
                            </div>
                        )}
                        <div>
                             <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                              <p className="text-sm font-medium text-slate-900 bg-slate-50 p-3 rounded-lg border border-slate-100 capitalize">{user?.role}</p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'security' && (
                <div className="space-y-5">
                     <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Ubah Password</h3>
                     
                     <form onSubmit={handleSubmit(onChangePassword)} className="space-y-4 max-w-lg">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Password Saat Ini</label>
                            <input
                                type="password"
                                {...register('current_password')}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                placeholder="Masukkan password lama"
                            />
                            {errors.current_password && <p className="mt-1 text-xs text-red-600">{errors.current_password.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Password Baru</label>
                            <input
                                type="password"
                                {...register('password')}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                placeholder="Minimal 8 karakter"
                            />
                             {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password Baru</label>
                            <input
                                type="password"
                                {...register('password_confirmation')}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                placeholder="Ulangi password baru"
                            />
                             {errors.password_confirmation && <p className="mt-1 text-xs text-red-600">{errors.password_confirmation.message}</p>}
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? <><LoadingSpinner size={16} color="white" className="mr-2" /> Menyimpan...</> : 'Simpan Password Baru'}
                            </button>
                        </div>
                     </form>
                </div>
            )}
       </div>

       <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
                onClick={handleLogout}
                className="w-full text-left p-4 flex items-center gap-3 hover:bg-red-50 transition-colors text-red-600"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-sm font-medium">Keluar dari Aplikasi</span>
            </button>
       </div>
       
       <div className="text-center pb-4">
            <p className="text-xs text-slate-400">Versi Aplikasi 1.0.0</p>
       </div>
    </div>
  );
}
