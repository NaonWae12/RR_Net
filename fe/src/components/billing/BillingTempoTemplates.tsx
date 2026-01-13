'use client';

import React, { useEffect, useState } from 'react';
import type { TempoTemplate } from '@/lib/api/types';
import { billingService } from '@/lib/api/billingService';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/20/solid';

export function BillingTempoTemplates() {
  const [templates, setTemplates] = useState<TempoTemplate[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TempoTemplate | null>(null);
  const [formData, setFormData] = useState({ name: '', due_day: 1, description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const list = await billingService.getTempoTemplates();
      setTemplates(list);
    } catch (e) {
      console.error('Failed to load tempo templates', e);
      setErrors((prev) => ({ ...prev, load: 'Gagal memuat template' }));
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormData({ name: '', due_day: new Date().getDate(), description: '' });
    setErrors({});
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: TempoTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      due_day: template.due_day,
      description: template.description || '',
    });
    setErrors({});
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormData({ name: '', due_day: 1, description: '' });
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Nama template harus diisi';
    }
    if (formData.due_day < 1 || formData.due_day > 31) {
      newErrors.day = 'Tanggal harus antara 1-31';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      if (editingTemplate) {
        await billingService.updateTempoTemplate(editingTemplate.id, {
          name: formData.name.trim(),
          due_day: formData.due_day,
          description: formData.description.trim() || null,
        });
      } else {
        await billingService.createTempoTemplate({
          name: formData.name.trim(),
          due_day: formData.due_day,
          description: formData.description.trim() || null,
        });
      }
      await loadTemplates();
      closeDialog();
    } catch (error) {
      console.error('Failed to save template:', error);
      setErrors({ submit: 'Gagal menyimpan template' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus template ini?')) return;
    try {
      await billingService.deleteTempoTemplate(id);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Gagal menghapus template');
    }
  };

  const showDayWarning = formData.due_day >= 29;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Template Tempo Pembayaran</h2>
          <p className="text-sm text-slate-600 mt-1">
            Kelola template jatuh tempo pembayaran bulanan untuk digunakan saat membuat client.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <PlusIcon className="h-5 w-5 mr-2" />
          Tambah Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <p className="text-slate-600">
            {loading ? 'Memuat template...' : 'Belum ada template tempo. Klik "Tambah Template" untuk membuat.'}
          </p>
          {errors.load && <p className="mt-2 text-sm text-red-600">{errors.load}</p>}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>Tanggal {template.due_day}</TableCell>
                  <TableCell className="text-slate-600">
                    {template.description || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(template)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                      >
                        <TrashIcon className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Tambah Template'}
            </DialogTitle>
            <DialogDescription>
              Buat template untuk memudahkan pemilihan tempo pembayaran saat membuat client baru.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nama Template <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Tempo Tgl 10"
                error={errors.name}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tanggal Jatuh Tempo (1-31) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min={1}
                max={31}
                value={formData.due_day}
                onChange={(e) =>
                  setFormData({ ...formData, due_day: parseInt(e.target.value) || 1 })
                }
                error={errors.day}
              />
              {showDayWarning && (
                <Alert variant="destructive" className="mt-2">
                  <AlertDescription>
                    Beberapa bulan tidak memiliki tanggal {formData.due_day} (mis. Februari hanya sampai 28/29).
                    Sistem akan menggeser jatuh tempo ke akhir bulan pada bulan yang tidak memiliki tanggal
                    tersebut. Jika tidak ingin digeser, pilih tanggal 1–28.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Deskripsi (opsional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Keterangan tambahan tentang template ini"
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {errors.submit && (
              <Alert variant="destructive">
                <AlertDescription>{errors.submit}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Batal
            </Button>
            <Button onClick={handleSubmit}>
              {editingTemplate ? 'Update' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

