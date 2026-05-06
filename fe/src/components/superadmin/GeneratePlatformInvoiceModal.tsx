'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';
import { superAdminService } from '@/lib/api/superAdminService';
import { subscriptionService } from '@/lib/api/subscriptionService';
import { toast } from 'sonner';
import { SuperAdminTenant } from '@/lib/api/types';
import { CalendarIcon, UsersIcon } from 'lucide-react';

interface GeneratePlatformInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GeneratePlatformInvoiceModal({ isOpen, onClose, onSuccess }: GeneratePlatformInvoiceModalProps) {
  const [tenants, setTenants] = useState<SuperAdminTenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [targetTenantId, setTargetTenantId] = useState<string>('all');
  const [tenantSearch, setTenantSearch] = useState<string>('');
  const [targetMonth, setTargetMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [showTenantList, setShowTenantList] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTenants();
      updateDates(targetMonth);
    }
  }, [isOpen]);

  const updateDates = (monthStr: string, tenant?: SuperAdminTenant) => {
    const [year, month] = monthStr.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    
    // Default due on 5th if no tenant, or use tenant's CreatedAt day
    let dueDay = 5;
    if (tenant?.created_at) {
      dueDay = new Date(tenant.created_at).getDate();
    }
    
    // Create due date, handling month overflow (e.g. 31st in Feb)
    let due = new Date(year, month - 1, dueDay);
    if (due.getMonth() !== month - 1) {
      due = new Date(year, month, 0); // Last day of month
    }

    setPeriodStart(start.toISOString().split('T')[0]);
    setPeriodEnd(end.toISOString().split('T')[0]);
    setDueDate(due.toISOString().split('T')[0]);
  };

  const handleMonthChange = (val: string) => {
    setTargetMonth(val);
    const tenant = targetTenantId !== 'all' ? tenants.find(t => t.id === targetTenantId) : undefined;
    updateDates(val, tenant);
  };

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await superAdminService.getTenants();
      setTenants(data || []);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
      toast.error('Could not load tenants list');
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(tenantSearch.toLowerCase()) || 
    t.slug.toLowerCase().includes(tenantSearch.toLowerCase())
  );

  const handleSelectTenant = (id: string, name: string) => {
    setTargetTenantId(id);
    setTenantSearch(name);
    setShowTenantList(false);
    
    const tenant = tenants.find(t => t.id === id);
    updateDates(targetMonth, tenant);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      await subscriptionService.generateInvoices({
        tenant_id: targetTenantId === 'all' ? undefined : targetTenantId,
        month: targetMonth,
        period_start: targetTenantId !== 'all' ? periodStart : undefined,
        period_end: targetTenantId !== 'all' ? periodEnd : undefined,
        due_date: targetTenantId !== 'all' ? dueDate : undefined,
      });
      
      toast.success('Invoice generation initiated successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Generation failed:', error);
      toast.error(error.response?.data?.error || 'Failed to generate invoices');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] bg-white border border-slate-200 shadow-2xl overflow-visible">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Generate Period Batch
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Tenant Selection with Search */}
          <div className="space-y-2 relative">
            <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-indigo-500" />
              Target Tenant
            </Label>
            
            <div className="relative">
              <input
                type="text"
                className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900"
                placeholder="Search tenant or 'all'..."
                value={tenantSearch}
                onFocus={() => setShowTenantList(true)}
                onChange={(e) => {
                  setTenantSearch(e.target.value);
                  if (e.target.value === '') setTargetTenantId('all');
                  setShowTenantList(true);
                }}
                disabled={loading || submitting}
              />
              
              {showTenantList && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-xl max-h-60 overflow-y-auto">
                  <div 
                    className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm font-medium text-indigo-600 border-b border-slate-100"
                    onClick={() => handleSelectTenant('all', 'All Active Tenants')}
                  >
                    All Active Tenants
                  </div>
                  {loading ? (
                    <div className="px-3 py-2 text-center"><LoadingSpinner size={16} /></div>
                  ) : filteredTenants.length > 0 ? (
                    filteredTenants.map(t => (
                      <div 
                        key={t.id} 
                        className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100 last:border-0"
                        onClick={() => handleSelectTenant(t.id, `${t.name} (${t.slug})`)}
                      >
                        <span className="font-medium text-slate-900">{t.name}</span>
                        <span className="ml-2 text-xs text-slate-500">{t.slug}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-500 italic">No tenants found</div>
                  )}
                </div>
              )}
            </div>
            
            {targetTenantId !== 'all' && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 font-medium">
                  Selected Tenant Locked
                </span>
                <button 
                  type="button" 
                  onClick={() => { setTargetTenantId('all'); setTenantSearch(''); }}
                  className="text-slate-400 hover:text-red-500 text-xs font-bold"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Month Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-indigo-500" />
              Billing Month
            </Label>
            <input
              type="month"
              className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900"
              value={targetMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          {/* Detailed Dates (only if specific tenant selected) */}
          {targetTenantId !== 'all' && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
               <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Period Start</Label>
                <input
                  type="date"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Period End</Label>
                <input
                  type="date"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Due Date (Tenggat Pembayaran)</Label>
                <input
                  type="date"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-indigo-500 text-slate-900 font-semibold"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="text-[11px] text-amber-800 leading-relaxed">
              <strong>Note:</strong> {targetTenantId === 'all' 
                ? "The system will automatically calculate dates for each tenant (Due on the 5th)." 
                : "The system will use the specific dates you provided for this invoice."}
            </p>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all px-6"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size={16} className="mr-2" />
                  Generating...
                </>
              ) : (
                'Generate Now'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
