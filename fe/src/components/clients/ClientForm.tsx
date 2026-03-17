'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Client, CreateClientRequest, ClientCategory, UpdateClientRequest } from '@/lib/api/clientService';
import servicePackageService, { ServicePackage } from '@/lib/api/servicePackageService';
import clientGroupService, { ClientGroup } from '@/lib/api/clientGroupService';
import { discountService, Discount } from '@/lib/api/discountService';
import type { TempoTemplate } from '@/lib/api/types';
import { billingService } from '@/lib/api/billingService';
import { networkService } from '@/lib/api/networkService';
import { voucherService, VoucherPackage } from '@/lib/api/voucherService';
import { Router } from '@/lib/api/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Controller } from 'react-hook-form';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const clientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  category: z.enum(['regular', 'business', 'enterprise', 'lite']),
  group_id: z.string().uuid('Invalid group ID').optional().or(z.literal('')),
  discount_id: z.string().uuid('Invalid discount ID').optional().or(z.literal('')),
  isolir_mode: z.enum(['auto', 'manual']).optional(),
  connection_type: z.enum(['pppoe', 'hotspot']).optional(),
  service_package_id: z.string().optional().or(z.literal('')),
  router_id: z.string().uuid('Invalid router ID').optional().or(z.literal('')),
  pppoe_username: z.string().optional(),
  pppoe_password: z.string().optional(),
  pppoe_local_address: z.string().optional(),
  pppoe_remote_address: z.string().optional(),
  pppoe_comment: z.string().optional(),
  voucher_package_id: z.string().uuid('Invalid voucher package ID').optional().or(z.literal('')),
  device_count: z.number().int().min(1).optional().nullable(),
  auto_create_invoice: z.boolean().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: CreateClientRequest | UpdateClientRequest) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ClientForm({ client, onSubmit, onCancel, loading }: ClientFormProps) {
  const isEdit = !!client;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: client ? {
      ...client,
      pppoe_password: client.pppoe_password || '',
    } : {
      category: 'regular',
      connection_type: 'pppoe',
      isolir_mode: 'auto',
      name: '',
      email: '',
      phone: '',
      address: '',
      group_id: '',
      discount_id: '',
      service_package_id: '',
      router_id: '',
      pppoe_username: '',
      pppoe_password: '',
      pppoe_local_address: '',
      pppoe_remote_address: '',
      pppoe_comment: '',
      voucher_package_id: '',
      device_count: null,
      auto_create_invoice: false,
    },
  });

  /* useEffect(() => {
    console.log('[DEBUG] ClientForm - Received client prop:', client);
  }, [client]); */

  const [showPassword, setShowPassword] = useState(false);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [templates, setTemplates] = useState<TempoTemplate[]>([]);
  const [tempoError, setTempoError] = useState<string | null>(null);
  const [routers, setRouters] = useState<Router[]>([]);
  const [voucherPackages, setVoucherPackages] = useState<VoucherPackage[]>([]);
  const [routersLoading, setRoutersLoading] = useState(false);
  
  // Tempo payment state
  type TempoOption = 'default' | 'template' | 'manual';
  const [tempoOption, setTempoOption] = useState<TempoOption>('default');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [manualDay, setManualDay] = useState<number>(new Date().getDate());

  // React-hook-form reset when client data arrives/changes
  useEffect(() => {
    if (client) {
      reset({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        category: (client.category as ClientCategory) || 'regular',
        group_id: client.group_id || '',
        discount_id: client.discount_id || '',
        isolir_mode: (client as any).isolir_mode || 'auto',
        connection_type: client.connection_type || 'pppoe',
        service_package_id: client.service_package_id || '',
        router_id: client.router_id || '',
        pppoe_username: client.pppoe_username || '',
        pppoe_password: client.pppoe_password || '', 
        pppoe_local_address: client.pppoe_local_address || '',
        pppoe_remote_address: client.pppoe_remote_address || '',
        pppoe_comment: client.pppoe_comment || '',
        voucher_package_id: client.voucher_package_id || '',
        device_count: client.device_count || null,
      });
    }
  }, [client, reset]);

  const category = watch('category');
  const connectionType = watch('connection_type');
  
  // Debug logging
  useEffect(() => {
    console.log('[DEBUG] ClientForm State:', { category, connectionType });
  }, [category, connectionType]);

  const visiblePackages = useMemo(() => {
    return packages.filter((p) => p.category === category);
  }, [packages, category]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setPackagesLoading(true);
      try {
        // In Edit mode, we include inactive packages so the current package (if legacy) can be displayed
        const list = await servicePackageService.list(category, !isEdit);
        if (!alive) return;
        setPackages(list);
        
        // console.log(`[DEBUG] ClientForm - Loaded ${category} packages:`, list.length);
        if (client?.service_package_id) {
            // console.log(`[DEBUG] ClientForm - Existing service_package_id:`, client.service_package_id);
        }
      } catch (err) {
        // console.error('[DEBUG] ClientForm - Failed to fetch packages:', err);
      } finally {
        if (alive) setPackagesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, isEdit, setValue, client?.service_package_id]);

  useEffect(() => {
    let alive = true;

    const fetchData = async () => {
      // Fetch Groups
      setGroupsLoading(true);
      try {
        const list = await clientGroupService.list();
        if (alive) {
          setGroups(list);
          // console.log('[DEBUG] ClientForm - Loaded groups:', list.length);
        }
      } catch (e) {
        // console.error('Failed to fetch groups', e);
      } finally {
        if (alive) setGroupsLoading(false);
      }

      // Fetch Discounts
      setDiscountsLoading(true);
      try {
        // In Edit mode, include inactive discounts to show current discount if it's legacy/expired
        const list = await discountService.getDiscounts(isEdit, !isEdit);
        if (alive) {
          setDiscounts(Array.isArray(list) ? list : []);
          // console.log('[DEBUG] ClientForm - Loaded discounts:', list.length);
        }
      } catch (e) {
        // console.error('Failed to fetch discounts', e);
        if (alive) setDiscounts([]);
      } finally {
        if (alive) setDiscountsLoading(false);
      }

      // Fetch Tempo Templates
      try {
        const list = await billingService.getTempoTemplates();
        if (alive) {
          setTemplates(list);
          // console.log('[DEBUG] ClientForm - Loaded tempo templates:', list.length);
        }
      } catch (e) {
        // console.error('Failed to load tempo templates', e);
      }

      // Fetch Routers
      setRoutersLoading(true);
      try {
        const list = await networkService.getRouters();
        if (alive) {
          setRouters(list);
          // console.log('[DEBUG] ClientForm - Loaded routers:', list.length);
        }
      } catch (e) {
        // console.error('Failed to fetch routers', e);
      } finally {
        if (alive) setRoutersLoading(false);
      }

      // Fetch Voucher Packages (profiles)
      try {
        const list = await voucherService.listPackages();
        if (alive) {
          setVoucherPackages(list);
          // console.log('[DEBUG] ClientForm - Loaded voucher packages:', list.length);
        }
      } catch (e) {
        // console.error('Failed to fetch voucher packages', e);
      }
    };

    fetchData();

    return () => {
      alive = false;
    };
  }, []);

  // Initialize tempo state from existing client when editing
  useEffect(() => {
    if (!client) return;
    const opt = (client.payment_tempo_option as TempoOption) || 'default';
    if (opt === 'default' || opt === 'template' || opt === 'manual') {
      setTempoOption(opt);
    }
    if (typeof client.payment_due_day === 'number') {
      setManualDay(client.payment_due_day);
    }
    if (client.payment_tempo_template_id) {
      setSelectedTemplateId(client.payment_tempo_template_id);
    }
  }, [client]);

  const onFormSubmit = async (data: ClientFormData) => {
    // Conditional validation based on category
    if (data.category === 'lite') {
      if (!data.device_count || data.device_count < 1) {
        setError('device_count', { type: 'validate', message: 'Device count is required for Lite' });
        return;
      }
      data.pppoe_username = '';
      data.pppoe_password = '';
    } else {
      if (data.connection_type === 'hotspot') {
        if (!data.voucher_package_id) {
          setError('voucher_package_id', { type: 'validate', message: 'Voucher package is required for Hotspot' });
          return;
        }
      } else {
        // PPPoE default
        if (!data.service_package_id) { // explicit check for service package if needed, though usually handled by HTML required
             // but let's be safe
        }
      }

      if (!data.pppoe_username) {
        setError('pppoe_username', { type: 'validate', message: 'Username is required' });
        return;
      }
      if (!isEdit && !data.pppoe_password) {
        setError('pppoe_password', { type: 'validate', message: 'Password is required' });
        return;
      }
    }

    const payload: CreateClientRequest = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      category: data.category,
      service_package_id: data.connection_type === 'hotspot' ? null : (data.service_package_id || undefined),
      group_id: data.group_id ? data.group_id : undefined,
      isolir_mode: data.isolir_mode || 'auto',
      connection_type: data.connection_type || 'pppoe',
      device_count: (data.category === 'lite' || data.connection_type === 'hotspot') ? data.device_count ?? undefined : undefined,
      pppoe_username: data.category !== 'lite' ? data.pppoe_username : undefined,
      pppoe_password: data.category !== 'lite' ? (data.pppoe_password || undefined) : undefined,
      router_id: data.router_id ? data.router_id : undefined,
      pppoe_local_address: data.pppoe_local_address ? data.pppoe_local_address : undefined,
      pppoe_remote_address: data.pppoe_remote_address ? data.pppoe_remote_address : undefined,
      pppoe_comment: data.pppoe_comment ? data.pppoe_comment : undefined,
      voucher_package_id: data.voucher_package_id ? data.voucher_package_id : undefined,
      discount_id: data.discount_id ? data.discount_id : undefined,
      auto_create_invoice: data.auto_create_invoice || false,
    };

    // Attach payment tempo fields
    setTempoError(null);
    let dueDay = new Date().getDate();
    let templateId: string | undefined;
    if (tempoOption === 'default') {
      dueDay = new Date().getDate();
    } else if (tempoOption === 'manual') {
      dueDay = manualDay;
    } else if (tempoOption === 'template') {
      if (!selectedTemplateId) {
        setTempoError('Pilih template tempo terlebih dahulu.');
        return;
      }
      const t = templates.find((x) => x.id === selectedTemplateId);
      if (!t) {
        setTempoError('Template tidak ditemukan. Silakan refresh atau pilih template lain.');
        return;
      }
      dueDay = t.due_day;
      templateId = t.id;
    }

    payload.payment_tempo_option = tempoOption;
    payload.payment_due_day = dueDay;
    if (tempoOption === 'template') payload.payment_tempo_template_id = templateId;

    await onSubmit(payload);
  };

  const isLoading = loading || isSubmitting;

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              {...register('name')}
              placeholder="Client name"
              error={errors.name?.message}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              {...register('email')}
              placeholder="email@example.com"
              error={errors.email?.message}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <Input
              {...register('phone')}
              placeholder="08123456789"
              error={errors.phone?.message}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category
            </label>
            <select
              {...register('category')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="regular" className="text-slate-900">Regular</option>
              <option value="business" className="text-slate-900">Business</option>
              <option value="enterprise" className="text-slate-900">Enterprise</option>
              <option value="lite" className="text-slate-900">Lite</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Group (optional)
            </label>
            <Controller
              name="group_id"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:text-slate-500 disabled:bg-slate-50"
                  disabled={groupsLoading}
                >
                  <option value="" className="text-slate-900">{groupsLoading ? 'Loading groups...' : 'No group'}</option>
                  {Array.isArray(groups) && groups.map((g) => (
                    <option key={g.id} value={g.id} className="text-slate-900">
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.group_id && <p className="mt-1 text-xs text-red-600">{errors.group_id.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Isolir Mode
            </label>
            <select
              {...register('isolir_mode')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="auto" className="text-slate-900">Auto Isolir</option>
              <option value="manual" className="text-slate-900">Manual Isolir</option>
            </select>
            {errors.isolir_mode && <p className="mt-1 text-xs text-red-600">{errors.isolir_mode.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Connection Type
            </label>
            <select
              {...register('connection_type')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="pppoe" className="text-slate-900">PPPoE</option>
              <option value="hotspot" className="text-slate-900">Hotspot</option>
            </select>
            {errors.connection_type && <p className="mt-1 text-xs text-red-600">{errors.connection_type.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register('address')}
              rows={2}
              placeholder="Full address"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.address && (
              <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Service Information */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Service Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Package Name - hidden for Hotspot */}
          {connectionType !== 'hotspot' && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Package Name
              </label>
              <Controller
                name="service_package_id"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:text-slate-500 disabled:bg-slate-50"
                    disabled={packagesLoading}
                  >
                    <option value="" className="text-slate-900">{packagesLoading ? 'Loading packages...' : 'Select package'}</option>
                    {visiblePackages.map((p) => (
                      <option key={p.id} value={p.id} className="text-slate-900">
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.service_package_id && (
                <p className="mt-1 text-xs text-red-600">{errors.service_package_id.message}</p>
              )}
            </div>
          )}

          {/* Hotspot specific top fields */}
          {connectionType === 'hotspot' && (
            <>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Voucher Profile (Package)
                </label>
                <Controller
                  name="voucher_package_id"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="" className="text-slate-900">Select profile...</option>
                      {Array.isArray(voucherPackages) && voucherPackages.map((vp) => (
                        <option key={vp.id} value={vp.id} className="text-slate-900">
                          {vp.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.voucher_package_id && (
                  <p className="mt-1 text-xs text-red-600">{errors.voucher_package_id.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Jumlah Device
                </label>
                <Input
                  type="number"
                  {...register('device_count', { valueAsNumber: true })}
                  placeholder="e.g., 3"
                  min={1}
                  error={errors.device_count?.message}
                />
              </div>
            </>
          )}

          {/* Username & Password - Shared Fields for PPPoE and Hotspot */}
          {/* Username & Password - Shared Fields for PPPoE and Hotspot */}
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {connectionType === 'hotspot' ? 'Hotspot Username' : 'PPPoE Username'}
            </label>
            <Input
              {...register('pppoe_username')}
              placeholder={connectionType === 'hotspot' ? 'hotspot_user' : 'pppoe_user'}
              error={errors.pppoe_username?.message}
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {connectionType === 'hotspot' ? 'Hotspot Password' : 'PPPoE Password'} {isEdit ? '(optional)' : ''}
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                {...register('pppoe_password')}
                placeholder={isEdit ? 'Leave blank to keep current' : 'Password'}
                error={errors.pppoe_password?.message}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {(connectionType === 'pppoe' || connectionType === 'hotspot') && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Router
              </label>
              <Controller
                name="router_id"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:text-slate-500 disabled:bg-slate-50"
                    disabled={routersLoading}
                  >
                    <option value="" className="text-slate-900">{routersLoading ? 'Loading routers...' : 'Select router'}</option>
                    {connectionType === 'hotspot' && (
                      <option value="" className="text-slate-900">Semua Router</option>
                    )}
                    {Array.isArray(routers) && routers.map((r) => (
                      <option key={r.id} value={r.id} className="text-slate-900">
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.router_id && (
                <p className="mt-1 text-xs text-red-600">{errors.router_id.message}</p>
              )}
            </div>
          )}



          {connectionType === 'pppoe' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Local Address
                </label>
                <Input
                  {...register('pppoe_local_address')}
                  placeholder="e.g. 10.0.0.1"
                  error={errors.pppoe_local_address?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Remote Address
                </label>
                <Input
                  {...register('pppoe_remote_address')}
                  placeholder="e.g. 10.0.10.1"
                  error={errors.pppoe_remote_address?.message}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Comment
                </label>
                <textarea
                  {...register('pppoe_comment')}
                  rows={2}
                  placeholder="Notes for this PPPoE secret"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Discount Information */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Discount (Optional)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Discount
            </label>
            <Controller
              name="discount_id"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:text-slate-500 disabled:bg-slate-50"
                  disabled={discountsLoading}
                >
                  <option value="" className="text-slate-900">{discountsLoading ? 'Loading discounts...' : 'No discount'}</option>
                  {Array.isArray(discounts) && discounts.map((d) => (
                    <option key={d.id} value={d.id} className="text-slate-900">
                      {d.name} ({d.type === 'percent' ? `${d.value}%` : `Rp ${d.value.toLocaleString('id-ID')}`})
                      {d.expires_at && ` - Expires: ${new Date(d.expires_at).toLocaleDateString('id-ID')}`}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.discount_id && (
              <p className="mt-1 text-xs text-red-600">{errors.discount_id.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tempo Pembayaran */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Tempo Pembayaran</h2>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <input
                type="radio"
                id="tempo-default"
                name="tempo-option"
                checked={tempoOption === 'default'}
                onChange={() => {
                  setTempoOption('default');
                  setManualDay(new Date().getDate());
                }}
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="tempo-default" className="flex-1 cursor-pointer">
                <span className="block text-sm font-medium text-slate-700">Default (hari ini)</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Jatuh tempo bulanan mengikuti tanggal hari ini (tgl {new Date().getDate()} setiap bulan)
                </span>
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="radio"
                id="tempo-template"
                name="tempo-option"
                checked={tempoOption === 'template'}
                onChange={() => setTempoOption('template')}
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="tempo-template" className="flex-1 cursor-pointer">
                <span className="block text-sm font-medium text-slate-700">Tanggal ditetapkan</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Pilih dari template yang telah dibuat
                </span>
              </label>
            </div>
            {tempoOption === 'template' && (
              <div className="ml-7">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    setTempoError(null);
                    setSelectedTemplateId(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="" className="text-slate-900">Pilih template...</option>
                  {Array.isArray(templates) && templates.map((t) => (
                    <option key={t.id} value={t.id} className="text-slate-900">
                      {t.name} (tanggal {t.due_day})
                    </option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Belum ada template. Buat template di Billing → Settings.
                  </p>
                )}
                {tempoError && <p className="mt-1 text-xs text-red-600">{tempoError}</p>}
              </div>
            )}

            <div className="flex items-start space-x-3">
              <input
                type="radio"
                id="tempo-manual"
                name="tempo-option"
                checked={tempoOption === 'manual'}
                onChange={() => setTempoOption('manual')}
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="tempo-manual" className="flex-1 cursor-pointer">
                <span className="block text-sm font-medium text-slate-700">Isi manual</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Input tanggal jatuh tempo (1-31)
                </span>
              </label>
            </div>
            {tempoOption === 'manual' && (
              <div className="ml-7">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={manualDay}
                  onChange={(e) => {
                    setTempoError(null);
                    setManualDay(parseInt(e.target.value) || 1);
                  }}
                />
              </div>
            )}
          </div>

          {/* Preview text */}
          <div className="pt-2 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              <span className="font-medium">Jatuh tempo bulanan: </span>
              {tempoOption === 'default' && `tanggal ${new Date().getDate()}`}
              {tempoOption === 'template' &&
                (selectedTemplateId
                  ? `tanggal ${templates.find((t) => t.id === selectedTemplateId)?.due_day || '-'}`
                  : '-')}
              {tempoOption === 'manual' && `tanggal ${manualDay}`}
            </p>
          </div>

          {/* Alert untuk tanggal 29-31 */}
          {((tempoOption === 'default' && new Date().getDate() >= 29) ||
            (tempoOption === 'template' &&
              selectedTemplateId &&
              (templates.find((t) => t.id === selectedTemplateId)?.due_day || 0) >= 29) ||
            (tempoOption === 'manual' && manualDay >= 29)) && (
            <Alert variant="destructive">
              <AlertDescription>
                Beberapa bulan tidak memiliki tanggal{' '}
                {tempoOption === 'default'
                  ? new Date().getDate()
                  : tempoOption === 'template'
                    ? templates.find((t) => t.id === selectedTemplateId)?.due_day || ''
                    : manualDay}{' '}
                (mis. Februari hanya sampai 28/29). Sistem akan menggeser jatuh tempo ke akhir
                bulan pada bulan yang tidak memiliki tanggal tersebut. Jika tidak ingin digeser,
                pilih tanggal 1–28.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Auto Create Invoice Toggle (Only for New Clients) */}
      {!client && (
        <div className="flex items-center space-x-2 pb-4">
          <Controller
            control={control}
            name="auto_create_invoice"
            render={({ field }) => (
              <Switch
                id="auto-create-invoice"
                checked={field.value}
                onCheckedChange={field.onChange}
                className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300"
              />
            )}
          />
          <Label htmlFor="auto-create-invoice" className="font-medium text-slate-700">
            Auto Create First Invoice
            {watch('auto_create_invoice') ? (
              <span className="ml-2 text-xs text-emerald-600 font-normal">(Active - Invoice will be generated)</span>
            ) : (
              <span className="ml-2 text-xs text-slate-500 font-normal">(Inactive)</span>
            )}
          </Label>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <LoadingSpinner size={16} className="mr-2" />
              Saving...
            </>
          ) : client ? (
            'Update Client'
          ) : (
            'Create Client'
          )}
        </Button>
      </div>
    </form>
  );
}


