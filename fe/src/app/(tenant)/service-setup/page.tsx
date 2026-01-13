'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TabLayout } from '@/components/layouts/TabLayout';
import servicePackageService, { ServicePackage, ServicePackageCategory } from '@/lib/api/servicePackageService';
import clientGroupService, { ClientGroup } from '@/lib/api/clientGroupService';
import { networkService } from '@/lib/api/networkService';
import type { NetworkProfile, CreateNetworkProfileRequest, UpdateNetworkProfileRequest } from '@/lib/api/types';
import { useNotificationStore } from '@/stores/notificationStore';

// ========== Network Profile Types & Forms ==========
type NetworkProfileFormState = {
  id?: string;
  name: string;
  description: string;
  download_speed: number;
  upload_speed: number;
  burst_download: number;
  burst_upload: number;
  priority: number;
  shared_users: number;
  address_pool: string;
  local_address: string;
  remote_address: string;
  dns_servers: string;
  is_active: boolean;
};

function defaultNetworkProfileForm(): NetworkProfileFormState {
  return {
    name: '',
    description: '',
    download_speed: 10000,
    upload_speed: 5000,
    burst_download: 0,
    burst_upload: 0,
    priority: 8,
    shared_users: 1,
    address_pool: '',
    local_address: '',
    remote_address: '',
    dns_servers: '',
    is_active: true,
  };
}

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
  const [profiles, setProfiles] = useState<NetworkProfile[]>([]);
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [discountLoading, setDiscountLoading] = useState(false);

  // Network Profile state
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState<NetworkProfileFormState>(defaultNetworkProfileForm());

  // Service Package state
  const [packageOpen, setPackageOpen] = useState(false);
  const [packageSaving, setPackageSaving] = useState(false);
  const [packageForm, setPackageForm] = useState<PackageFormState>(defaultPackageForm());

  // Discount state
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'nominal'>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);

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
      const [pkgs, profs, settings, grp] = await Promise.all([
        servicePackageService.list(undefined, false),
        networkService.getNetworkProfiles(),
        servicePackageService.getSettings(),
        clientGroupService.list(),
      ]);
      setPackages(pkgs ?? []);
      setProfiles(profs ?? []);
      setDiscountEnabled(!!settings?.service_discount?.enabled);
      setDiscountType(settings?.service_discount?.type ?? 'percent');
      setDiscountValue(settings?.service_discount?.value ?? 0);
      setGroups(grp ?? []);
    } catch (e: unknown) {
      const error = e as { message?: string };
      showToast({ title: 'Error', description: error?.message || 'Failed to load data', variant: 'error' });
      // Set to empty arrays on error to prevent null/undefined issues
      setPackages([]);
      setProfiles([]);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== Network Profile Handlers ==========
  const onNewProfile = () => {
    setProfileForm(defaultNetworkProfileForm());
    setProfileOpen(true);
  };

  const onEditProfile = (p: NetworkProfile) => {
    setProfileForm({
      id: p.id,
      name: p.name,
      description: p.description || '',
      download_speed: p.download_speed,
      upload_speed: p.upload_speed,
      burst_download: p.burst_download || 0,
      burst_upload: p.burst_upload || 0,
      priority: p.priority,
      shared_users: p.shared_users || 1,
      address_pool: p.address_pool || '',
      local_address: p.local_address || '',
      remote_address: p.remote_address || '',
      dns_servers: p.dns_servers || '',
      is_active: p.is_active,
    });
    setProfileOpen(true);
  };

  const onSaveProfile = async () => {
    if (!profileForm.name.trim()) {
      showToast({ title: 'Validation', description: 'Profile name is required', variant: 'error' });
      return;
    }
    if (profileForm.download_speed <= 0 || profileForm.upload_speed <= 0) {
      showToast({ title: 'Validation', description: 'Download and upload speeds must be greater than 0', variant: 'error' });
      return;
    }

    setProfileSaving(true);
    try {
      const payload: CreateNetworkProfileRequest | UpdateNetworkProfileRequest = {
        name: profileForm.name.trim(),
        description: profileForm.description || undefined,
        download_speed: profileForm.download_speed,
        upload_speed: profileForm.upload_speed,
        burst_download: profileForm.burst_download || undefined,
        burst_upload: profileForm.burst_upload || undefined,
        priority: profileForm.priority,
        shared_users: profileForm.shared_users,
        address_pool: profileForm.address_pool || undefined,
        local_address: profileForm.local_address || undefined,
        remote_address: profileForm.remote_address || undefined,
        dns_servers: profileForm.dns_servers || undefined,
        is_active: profileForm.is_active,
      };

      if (profileForm.id) {
        await networkService.updateNetworkProfile(profileForm.id, payload);
        showToast({ title: 'Updated', description: 'Network profile updated', variant: 'success' });
      } else {
        await networkService.createNetworkProfile(payload as CreateNetworkProfileRequest);
        showToast({ title: 'Created', description: 'Network profile created', variant: 'success' });
      }
      setProfileOpen(false);
      await reload();
    } catch (e: unknown) {
      const error = e as { response?: { data?: { error?: string } } };
      showToast({ title: 'Failed', description: error?.response?.data?.error || 'Failed to save profile', variant: 'error' });
    } finally {
      setProfileSaving(false);
    }
  };

  const onDeleteProfile = async (p: NetworkProfile) => {
    if (!confirm(`Delete profile "${p.name}"?`)) return;
    try {
      await networkService.deleteNetworkProfile(p.id);
      showToast({ title: 'Deleted', description: 'Network profile deleted', variant: 'success' });
      await reload();
    } catch (e: unknown) {
      const error = e as { response?: { data?: { error?: string } } };
      showToast({ title: 'Failed', description: error?.response?.data?.error || 'Failed to delete profile', variant: 'error' });
    }
  };

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
  const onSaveDiscount = async () => {
    setDiscountLoading(true);
    try {
      await servicePackageService.updateDiscount({
        enabled: discountEnabled,
        type: discountType,
        value: discountValue,
      });
      showToast({ title: 'Saved', description: 'Global discount updated', variant: 'success' });
    } catch (e: unknown) {
      const error = e as { response?: { data?: { error?: string } } };
      showToast({ title: 'Failed', description: error?.response?.data?.error || 'Failed to update discount', variant: 'error' });
    } finally {
      setDiscountLoading(false);
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
  const networkProfileTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Network Profiles</h2>
        <Button onClick={onNewProfile}>New Profile</Button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : (
        <Card className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Download</TableHead>
                <TableHead>Upload</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!profiles || profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    No network profiles found
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-slate-900">{p.name}</TableCell>
                    <TableCell className="text-slate-700">{formatSpeed(p.download_speed)}</TableCell>
                    <TableCell className="text-slate-700">{formatSpeed(p.upload_speed)}</TableCell>
                    <TableCell className="text-slate-700">{p.priority}</TableCell>
                    <TableCell className="text-slate-700">{p.is_active ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEditProfile(p)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onDeleteProfile(p)}>
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

      {/* Network Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>{profileForm.id ? 'Edit Network Profile' : 'New Network Profile'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <Input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={profileForm.description}
                onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Download Speed (Kbps) *</label>
                <Input
                  type="number"
                  value={profileForm.download_speed}
                  onChange={(e) => setProfileForm({ ...profileForm, download_speed: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Upload Speed (Kbps) *</label>
                <Input
                  type="number"
                  value={profileForm.upload_speed}
                  onChange={(e) => setProfileForm({ ...profileForm, upload_speed: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Burst Download (Kbps)</label>
                <Input
                  type="number"
                  value={profileForm.burst_download}
                  onChange={(e) => setProfileForm({ ...profileForm, burst_download: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Burst Upload (Kbps)</label>
                <Input
                  type="number"
                  value={profileForm.burst_upload}
                  onChange={(e) => setProfileForm({ ...profileForm, burst_upload: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <Input
                  type="number"
                  value={profileForm.priority}
                  onChange={(e) => setProfileForm({ ...profileForm, priority: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shared Users</label>
                <Input
                  type="number"
                  value={profileForm.shared_users}
                  onChange={(e) => setProfileForm({ ...profileForm, shared_users: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address Pool</label>
              <Input value={profileForm.address_pool} onChange={(e) => setProfileForm({ ...profileForm, address_pool: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Local Address</label>
                <Input value={profileForm.local_address} onChange={(e) => setProfileForm({ ...profileForm, local_address: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remote Address</label>
                <Input value={profileForm.remote_address} onChange={(e) => setProfileForm({ ...profileForm, remote_address: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">DNS Servers</label>
              <Input value={profileForm.dns_servers} onChange={(e) => setProfileForm({ ...profileForm, dns_servers: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Active</label>
              <select
                value={profileForm.is_active ? 'yes' : 'no'}
                onChange={(e) => setProfileForm({ ...profileForm, is_active: e.target.value === 'yes' })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)} disabled={profileSaving}>
              Cancel
            </Button>
            <Button onClick={onSaveProfile} disabled={profileSaving}>
              {profileSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const servicePackageTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Service Packages</h2>
        <Button onClick={onNewPackage}>New Package</Button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : (
        <Card className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Network Profile</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!packages || packages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    No service packages found
                  </TableCell>
                </TableRow>
              ) : (
                packages.map((p) => (
                  <TableRow key={p.id}>
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
                    <TableCell className="text-right">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>{packageForm.id ? 'Edit Service Package' : 'New Service Package'}</DialogTitle>
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
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
      <h2 className="text-lg font-semibold text-slate-900">Global Discount (Tenant)</h2>
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Enabled</label>
            <select
              value={discountEnabled ? 'yes' : 'no'}
              onChange={(e) => setDiscountEnabled(e.target.value === 'yes')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="no">Disabled</option>
              <option value="yes">Enabled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percent' | 'nominal')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              disabled={!discountEnabled}
            >
              <option value="percent">Percent (%)</option>
              <option value="nominal">Nominal (IDR)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
            <Input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value))}
              disabled={!discountEnabled}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={onSaveDiscount} disabled={discountLoading}>
            {discountLoading ? 'Saving...' : 'Save Discount'}
          </Button>
        </div>
      </Card>
    </div>
  );

  const businessEnterpriseTab = (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Business / Enterprise Settings</h2>
      <Card className="p-6">
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
        <Card className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!groups || groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500 py-8">
                    No groups found
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium text-slate-900">{g.name}</TableCell>
                    <TableCell className="text-slate-700">{g.description || '-'}</TableCell>
                    <TableCell className="text-right">
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{groupForm.id ? 'Edit Group' : 'New Group'}</DialogTitle>
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
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
        <p className="text-slate-500 mt-1">Manage network profiles, service packages, discounts, and settings</p>
      </div>

      <TabLayout
        tabs={[
          {
            id: 'network-profiles',
            label: 'Network Profiles',
            content: networkProfileTab,
          },
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
        defaultTab="network-profiles"
      />
    </div>
  );
}