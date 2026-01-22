'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { TabLayout } from '@/components/layouts/TabLayout';
import servicePackageService, { ServicePackage, ServicePackageCategory } from '@/lib/api/servicePackageService';
import clientGroupService, { ClientGroup } from '@/lib/api/clientGroupService';
import { networkService } from '@/lib/api/networkService';
import { discountService, Discount } from '@/lib/api/discountService';
import type { NetworkProfile } from '@/lib/api/types';
import { useNotificationStore } from '@/stores/notificationStore';

// ========== Service Package Types & Forms ==========
type PackageFormState = {
  id?: string;
  name: string;
  category: ServicePackageCategory;
  network_profile_id: string;
  billing_day_default?: number | null;
  is_active: boolean;
  price_monthly: number;
  price_per_device: number;
};

function defaultPackageForm(category: ServicePackageCategory = 'regular'): PackageFormState {
  return {
    name: '',
    category,
    network_profile_id: '',
    billing_day_default: null,
    is_active: true,
    price_monthly: 0,
    price_per_device: 0,
  };
}

export default function ServiceSetupPage() {
  const { showToast } = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [profiles, setProfiles] = useState<NetworkProfile[]>([]); // Only for dropdown in service package form
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  // Service Package state
  const [packageOpen, setPackageOpen] = useState(false);
  const [packageSaving, setPackageSaving] = useState(false);
  const [packageForm, setPackageForm] = useState<PackageFormState>(defaultPackageForm());

  // Discount state
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountForm, setDiscountForm] = useState<{
    id?: string;
    name: string;
    description: string;
    type: 'percent' | 'nominal';
    value: number;
    expires_at?: string | null;
    is_active: boolean;
  }>({
    name: '',
    description: '',
    type: 'percent',
    value: 0,
    expires_at: null,
    is_active: true,
  });

  // Client Group state
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupForm, setGroupForm] = useState<{ id?: string; name: string; description: string }>({
    name: '',
    description: '',
  });

  const reload = async () => {
    setLoading(true);
    try {
      const [pkgs, profs, grp, disc] = await Promise.all([
        servicePackageService.list(undefined, false),
        networkService.getNetworkProfiles(), // Fetch profiles only for dropdown in service package form
        clientGroupService.list(),
        discountService.getDiscounts(true, false), // Include inactive discounts
      ]);
      setPackages(pkgs ?? []);
      setProfiles(profs ?? []);
      setGroups(grp ?? []);
      setDiscounts(disc ?? []);
    } catch (e: unknown) {
      const error = e as { message?: string };
      showToast({ title: 'Error', description: error?.message || 'Failed to load data', variant: 'error' });
      // Set to empty arrays on error to prevent null/undefined issues
      setPackages([]);
      setProfiles([]);
      setGroups([]);
      setDiscounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== Service Package Handlers ==========
  const onNewPackage = () => {
    setPackageForm(defaultPackageForm('regular'));
    setPackageOpen(true);
  };

  const onEditPackage = (p: ServicePackage) => {
    setPackageForm({
      id: p.id,
      name: p.name,
      category: p.category,
      network_profile_id: p.network_profile_id,
      billing_day_default: p.billing_day_default ?? null,
      is_active: p.is_active,
      price_monthly: p.price_monthly ?? 0,
      price_per_device: p.price_per_device ?? 0,
    });
    setPackageOpen(true);
  };

  const onSavePackage = async () => {
    if (!packageForm.name.trim()) {
      showToast({ title: 'Validation', description: 'Package name is required', variant: 'error' });
      return;
    }
    if (!packageForm.network_profile_id) {
      showToast({ title: 'Validation', description: 'Network profile is required', variant: 'error' });
      return;
    }
    const pricingModel = packageForm.category === 'lite' ? 'per_device' : 'flat_monthly';
    if (pricingModel === 'flat_monthly' && packageForm.price_monthly < 0) {
      showToast({ title: 'Validation', description: 'Monthly price must be >= 0', variant: 'error' });
      return;
    }
    if (pricingModel === 'per_device' && packageForm.price_per_device < 0) {
      showToast({ title: 'Validation', description: 'Price per device must be >= 0', variant: 'error' });
      return;
    }

    setPackageSaving(true);
    try {
      const payload = {
        name: packageForm.name.trim(),
        category: packageForm.category,
        pricing_model: pricingModel as 'flat_monthly' | 'per_device',
        price_monthly: pricingModel === 'flat_monthly' ? packageForm.price_monthly : 0,
        price_per_device: pricingModel === 'per_device' ? packageForm.price_per_device : 0,
        billing_day_default: packageForm.billing_day_default ?? null,
        network_profile_id: packageForm.network_profile_id,
        is_active: packageForm.is_active,
      };

      if (packageForm.id) {
        await servicePackageService.update(packageForm.id, payload);
        showToast({ title: 'Updated', description: 'Service package updated', variant: 'success' });
      } else {
        await servicePackageService.create(payload);
        showToast({ title: 'Created', description: 'Service package created', variant: 'success' });
      }
      setPackageOpen(false);
      await reload();
    } catch (e: unknown) {
      const error = e as { response?: { data?: { error?: string } } };
      showToast({ title: 'Failed', description: error?.response?.data?.error || 'Failed to save', variant: 'error' });
    } finally {
      setPackageSaving(false);
    }
  };

  const onDeletePackage = async (p: ServicePackage) => {
    if (!confirm(`Delete package "${p.name}"?`)) return;
    try {
      await servicePackageService.remove(p.id);
      showToast({ title: 'Deleted', description: 'Service package deleted', variant: 'success' });
      await reload();
    } catch (e: unknown) {
      const error = e as { response?: { data?: { error?: string } } };
      showToast({ title: 'Failed', description: error?.response?.data?.error || 'Failed to delete', variant: 'error' });
    }
  };

  // ========== Discount Handlers ==========
  const onNewDiscount = () => {
    setDiscountForm({
      name: '',
      description: '',
      type: 'percent',
      value: 0,
      expires_at: null,
      is_active: true,
    });
    setDiscountOpen(true);
  };

  const onEditDiscount = (d: Discount) => {
    setDiscountForm({
      id: d.id,
      name: d.name,
      description: d.description || '',
      type: d.type,
      value: d.value,
      expires_at: d.expires_at || null,
      is_active: d.is_active,
    });
    setDiscountOpen(true);
  };

  const onSaveDiscount = async () => {
    if (!discountForm.name.trim()) {
      showToast({ title: 'Validation', description: 'Discount name is required', variant: 'error' });
      return;
    }
    if (discountForm.value < 0) {
      showToast({ title: 'Validation', description: 'Discount value must be >= 0', variant: 'error' });
      return;
    }
    if (discountForm.type === 'percent' && discountForm.value > 100) {
      showToast({ title: 'Validation', description: 'Percentage discount must be <= 100', variant: 'error' });
      return;
    }
    // Ensure nominal values are rounded (integers only)
    if (discountForm.type === 'nominal') {
      discountForm.value = Math.round(discountForm.value);
    }
    setDiscountSaving(true);
    try {
      const payload = {
        name: discountForm.name.trim(),
        description: discountForm.description?.trim() ? discountForm.description.trim() : null,
        type: discountForm.type,
        value: discountForm.value,
        expires_at: discountForm.expires_at || null,
        is_active: discountForm.is_active,
      };
      if (discountForm.id) {
        await discountService.updateDiscount(discountForm.id, payload);
        showToast({ title: 'Updated', description: 'Discount updated', variant: 'success' });
      } else {
        await discountService.createDiscount(payload);
        showToast({ title: 'Created', description: 'Discount created', variant: 'success' });
      }
      setDiscountOpen(false);
      await reload();
    } catch (e: unknown) {
      const error = e as { response?: { data?: { error?: string } } };
      showToast({ title: 'Failed', description: error?.response?.data?.error || 'Failed to save discount', variant: 'error' });
    } finally {
      setDiscountSaving(false);
    }
  };

  const onDeleteDiscount = async (d: Discount) => {
    if (!confirm(`Delete discount "${d.name}"?`)) return;
    try {
      await discountService.deleteDiscount(d.id);
      showToast({ title: 'Deleted', description: 'Discount deleted', variant: 'success' });
      await reload();
    } catch (e: unknown) {
      const error = e as { response?: { data?: { error?: string } } };
      showToast({ title: 'Failed', description: error?.response?.data?.error || 'Failed to delete discount', variant: 'error' });
    }
  };

  const formatSpeed = (kbps: number): string => {
    if (kbps >= 1000) {
      return `${(kbps / 1000).toFixed(1)} Mbps`;
    }
    return `${kbps} Kbps`;
  };

  const pricingModel = packageForm.category === 'lite' ? 'per_device' : 'flat_monthly';

  // ========== Tab Content Components ==========
  const servicePackageTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Service Packages</h2>
        <Button onClick={onNewPackage}>New Package</Button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : (
        <Card className="p-6 bg-white border-slate-200 text-slate-900">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200">
                <TableHead className="text-slate-700">Name</TableHead>
                <TableHead className="text-slate-700">Category</TableHead>
                <TableHead className="text-slate-700">Pricing</TableHead>
                <TableHead className="text-slate-700">Network Profile</TableHead>
                <TableHead className="text-slate-700">Active</TableHead>
                <TableHead className="text-right text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!packages || packages.length === 0 ? (
                <TableRow className="border-slate-200">
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    No service packages found
                  </TableCell>
                </TableRow>
              ) : (
                packages.map((p) => (
                  <TableRow key={p.id} className="border-slate-200">
                    <TableCell className="font-medium text-slate-900">{p.name}</TableCell>
                    <TableCell className="text-slate-700">{p.category}</TableCell>
                    <TableCell className="text-slate-700">
                      {p.pricing_model === 'per_device'
                        ? `Rp ${Number(p.price_per_device || 0).toLocaleString('id-ID')}/device`
                        : `Rp ${Number(p.price_monthly || 0).toLocaleString('id-ID')}/month`}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {profiles?.find((x) => x.id === p.network_profile_id)?.name || '-'}
                    </TableCell>
                    <TableCell className="text-slate-700">{p.is_active ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-right text-slate-900">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEditPackage(p)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onDeletePackage(p)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Service Package Dialog */}
      <Dialog open={packageOpen} onOpenChange={setPackageOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900">{packageForm.id ? 'Edit Service Package' : 'New Service Package'}</DialogTitle>
            <DialogDescription>
              {packageForm.id ? 'Update service package details' : 'Create a new service package for your clients'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <Input value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={packageForm.category}
                  onChange={(e) => {
                    const cat = e.target.value as ServicePackageCategory;
                    setPackageForm({
                      ...packageForm,
                      category: cat,
                      price_monthly: cat === 'lite' ? 0 : packageForm.price_monthly,
                      price_per_device: cat === 'lite' ? packageForm.price_per_device : 0,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
                >
                  <option value="regular">Regular</option>
                  <option value="business">Business</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="lite">Lite</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Network Profile *</label>
                <select
                  value={packageForm.network_profile_id}
                  onChange={(e) => setPackageForm({ ...packageForm, network_profile_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
                >
                  <option value="">Select profile</option>
                  {profiles?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatSpeed(p.download_speed)}/{formatSpeed(p.upload_speed)})
                    </option>
                  )) ?? []}
                </select>
              </div>
            </div>

            {pricingModel === 'per_device' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price per device (IDR) *</label>
                <Input
                  type="number"
                  value={packageForm.price_per_device}
                  onChange={(e) => setPackageForm({ ...packageForm, price_per_device: Number(e.target.value) })}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monthly price (IDR) *</label>
                  <Input
                    type="number"
                    value={packageForm.price_monthly}
                    onChange={(e) => setPackageForm({ ...packageForm, price_monthly: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Billing day default (1-28)</label>
                  <Input
                    type="number"
                    value={packageForm.billing_day_default ?? ''}
                    onChange={(e) =>
                      setPackageForm({
                        ...packageForm,
                        billing_day_default: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    min={1}
                    max={28}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Active</label>
              <select
                value={packageForm.is_active ? 'yes' : 'no'}
                onChange={(e) => setPackageForm({ ...packageForm, is_active: e.target.value === 'yes' })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPackageOpen(false)} disabled={packageSaving}>
              Cancel
            </Button>
            <Button onClick={onSavePackage} disabled={packageSaving}>
              {packageSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const discountTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Discounts</h2>
        <Button onClick={onNewDiscount}>New Discount</Button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : (
        <Card className="p-6 bg-white border-slate-200 text-slate-900">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200">
                <TableHead className="text-slate-700">Name</TableHead>
                <TableHead className="text-slate-700">Type</TableHead>
                <TableHead className="text-slate-700">Value</TableHead>
                <TableHead className="text-slate-700">Expires At</TableHead>
                <TableHead className="text-slate-700">Status</TableHead>
                <TableHead className="text-right text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!discounts || discounts.length === 0 ? (
                <TableRow className="border-slate-200">
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    No discounts found
                  </TableCell>
                </TableRow>
              ) : (
                discounts.map((d) => (
                  <TableRow key={d.id} className="border-slate-200">
                    <TableCell className="font-medium text-slate-900">{d.name}</TableCell>
                    <TableCell className="text-slate-700">{d.type === 'percent' ? 'Percent' : 'Nominal'}</TableCell>
                    <TableCell className="text-slate-700">
                      {d.type === 'percent' ? `${d.value}%` : `Rp ${d.value.toLocaleString('id-ID')}`}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {d.expires_at ? new Date(d.expires_at).toLocaleDateString('id-ID') : 'Never'}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      <span className={`px-2 py-1 rounded text-xs ${d.is_valid ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                        {d.is_valid ? 'Valid' : d.is_active ? 'Expired' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-slate-900">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEditDiscount(d)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onDeleteDiscount(d)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent className="max-w-xl bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900">{discountForm.id ? 'Edit Discount' : 'New Discount'}</DialogTitle>
            <DialogDescription>
              {discountForm.id ? 'Update discount details' : 'Create a new discount that can be applied to clients'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <Input
                value={discountForm.name}
                onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={discountForm.description}
                onChange={(e) => setDiscountForm({ ...discountForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                <select
                  value={discountForm.type}
                  onChange={(e) => {
                    const newType = e.target.value as 'percent' | 'nominal';
                    // If switching to nominal, round the value to integer
                    const newValue = newType === 'nominal' ? Math.round(discountForm.value) : discountForm.value;
                    setDiscountForm({ ...discountForm, type: newType, value: newValue });
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
                >
                  <option value="percent">Percent (%)</option>
                  <option value="nominal">Nominal (IDR)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Value * {discountForm.type === 'nominal' && '(Rupiah)'}
                </label>
                <Input
                  type="number"
                  value={discountForm.value}
                  onChange={(e) => {
                    const inputValue = Number(e.target.value);
                    // For nominal, only allow integers (round if needed)
                    const finalValue = discountForm.type === 'nominal' ? Math.round(inputValue) : inputValue;
                    setDiscountForm({ ...discountForm, value: finalValue });
                  }}
                  min={0}
                  max={discountForm.type === 'percent' ? 100 : undefined}
                  step={discountForm.type === 'nominal' ? '1' : '0.01'}
                />
                {discountForm.type === 'nominal' && discountForm.value > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Rp {discountForm.value.toLocaleString('id-ID')}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expires At (Optional)</label>
              <Input
                type="datetime-local"
                value={discountForm.expires_at ? new Date(discountForm.expires_at).toISOString().slice(0, 16) : ''}
                onChange={(e) =>
                  setDiscountForm({
                    ...discountForm,
                    expires_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Active</label>
              <select
                value={discountForm.is_active ? 'yes' : 'no'}
                onChange={(e) => setDiscountForm({ ...discountForm, is_active: e.target.value === 'yes' })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountOpen(false)} disabled={discountSaving}>
              Cancel
            </Button>
            <Button onClick={onSaveDiscount} disabled={discountSaving}>
              {discountSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const businessEnterpriseTab = (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Business / Enterprise Settings</h2>
      <Card className="p-6 bg-white border-slate-200 text-slate-900">
        <p className="text-sm text-slate-500">
          Placeholder section—kita taruh setting khusus Business/Enterprise di sini biar sidebar tidak rame.
        </p>
      </Card>
    </div>
  );

  // ========== Client Group Tab ==========
  const onNewGroup = () => {
    setGroupForm({ name: '', description: '' });
    setGroupOpen(true);
  };

  const onEditGroup = (g: ClientGroup) => {
    setGroupForm({ id: g.id, name: g.name, description: g.description || '' });
    setGroupOpen(true);
  };

  const onSaveGroup = async () => {
    if (!groupForm.name.trim()) {
      showToast({ title: 'Validation', description: 'Group name is required', variant: 'error' });
      return;
    }
    setGroupSaving(true);
    try {
      const payload = {
        name: groupForm.name.trim(),
        description: groupForm.description?.trim() ? groupForm.description.trim() : null,
      };
      if (groupForm.id) {
        await clientGroupService.update(groupForm.id, payload);
        showToast({ title: 'Updated', description: 'Client group updated', variant: 'success' });
      } else {
        await clientGroupService.create(payload);
        showToast({ title: 'Created', description: 'Client group created', variant: 'success' });
      }
      setGroupOpen(false);
      await reload();
    } catch (e: unknown) {
      const error = e as { response?: { data?: { error?: string } } };
      showToast({ title: 'Failed', description: error?.response?.data?.error || 'Failed to save group', variant: 'error' });
    } finally {
      setGroupSaving(false);
    }
  };

  const onDeleteGroup = async (g: ClientGroup) => {
    if (!confirm(`Delete group "${g.name}"?`)) return;
    try {
      await clientGroupService.remove(g.id);
      showToast({ title: 'Deleted', description: 'Client group deleted', variant: 'success' });
      await reload();
    } catch (e: unknown) {
      const error = e as { response?: { data?: { error?: string } } };
      showToast({ title: 'Failed', description: error?.response?.data?.error || 'Failed to delete group', variant: 'error' });
    }
  };

  const groupSetupTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Group Setup</h2>
        <Button onClick={onNewGroup}>New Group</Button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : (
        <Card className="p-6 bg-white border-slate-200 text-slate-900">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200">
                <TableHead className="text-slate-700">Name</TableHead>
                <TableHead className="text-slate-700">Description</TableHead>
                <TableHead className="text-right text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!groups || groups.length === 0 ? (
                <TableRow className="border-slate-200">
                  <TableCell colSpan={3} className="text-center text-slate-500 py-8">
                    No groups found
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((g) => (
                  <TableRow key={g.id} className="border-slate-200">
                    <TableCell className="font-medium text-slate-900">{g.name}</TableCell>
                    <TableCell className="text-slate-700">{g.description || '-'}</TableCell>
                    <TableCell className="text-right text-slate-900">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEditGroup(g)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onDeleteGroup(g)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent className="max-w-xl bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900">{groupForm.id ? 'Edit Group' : 'New Group'}</DialogTitle>
            <DialogDescription>
              {groupForm.id ? 'Update client group details' : 'Create a new client group for organizing your clients'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupOpen(false)} disabled={groupSaving}>
              Cancel
            </Button>
            <Button onClick={onSaveGroup} disabled={groupSaving}>
              {groupSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Service Setup</h1>
        <p className="text-slate-500 mt-1">Manage service packages, discounts, and settings</p>
      </div>

      <TabLayout
        tabs={[
          {
            id: 'service-packages',
            label: 'Service Packages',
            content: servicePackageTab,
          },
          {
            id: 'discount',
            label: 'Discount',
            content: discountTab,
          },
          {
            id: 'business-enterprise',
            label: 'Business/Enterprise',
            content: businessEnterpriseTab,
          },
          {
            id: 'group-setup',
            label: 'Group Setup',
            content: groupSetupTab,
          },
        ]}
        defaultTab="service-packages"
      />
    </div>
  );
}