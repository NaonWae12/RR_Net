'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClientStore } from '@/stores/clientStore';
import { billingService } from '@/lib/api/billingService';
import { toast } from 'sonner';
import { PlusIcon, TrashIcon } from '@heroicons/react/20/solid';
import { LoadingSpinner } from '@/components/utilities/LoadingSpinner';

const formatDisplayValue = (val: number | string) => {
  if (!val && val !== 0) return '';
  return val.toString().replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseDisplayValue = (val: string) => {
  const rawValue = val.replace(/\D/g, '');
  return rawValue === '' ? 0 : parseInt(rawValue, 10);
};

interface ManualInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface InvoiceItemState {
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function ManualInvoiceModal({ isOpen, onClose, onSuccess }: ManualInvoiceModalProps) {
  const { clients, fetchClients, loading: loadingClients } = useClientStore();
  const [loading, setLoading] = useState(false);

  // Form State
  const [clientId, setClientId] = useState('');
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().split('T')[0]);
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<InvoiceItemState[]>([
    { description: 'Layanan Internet', quantity: 1, unitPrice: 0 }
  ]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');
  
  // Search state for client autocomplete
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchClients({ page: 1, page_size: 100 }); // Fetch first 100 clients
      // Set defaults
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const due = new Date(now.getFullYear(), now.getMonth(), 10); // Default due date 10th
      
      setPeriodStart(firstDay.toISOString().split('T')[0]);
      setPeriodEnd(lastDay.toISOString().split('T')[0]);
      setDueDate(due.toISOString().split('T')[0]);
    }
  }, [isOpen, fetchClients]);

  const handleSelectClient = (client: any) => {
    setClientId(client.id);
    setClientSearch(`${client.name} (${client.client_code})`);
    
    // Auto-populate items based on client's package/plan
    if (client.monthly_fee && client.monthly_fee > 0) {
      setItems([
        { 
          description: client.package_name || client.service_plan || 'Layanan Internet', 
          quantity: 1, 
          unitPrice: client.monthly_fee 
        }
      ]);
    }

    // Auto-populate discount if any
    if (client.discount_value) {
      if (client.discount_type === 'fixed') {
        setDiscountAmount(client.discount_value);
      } else if (client.discount_type === 'percent') {
        const subtotal = client.monthly_fee || 0;
        setDiscountAmount(Math.round(subtotal * (client.discount_value / 100)));
      }
    } else {
      setDiscountAmount(0);
    }

    // Auto-populate due date if payment_due_day is set
    if (client.payment_due_day) {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Safety check: for months like February with 28/29 days, or 30-day months
      // ensure we don't pick a day that doesn't exist.
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const actualDueDay = Math.min(client.payment_due_day, lastDayOfMonth);
      
      const due = new Date(currentYear, currentMonth, actualDueDay);
      setDueDate(due.toISOString().split('T')[0]);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItemState, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = subtotal * (taxPercent / 100);
    return subtotal + tax - discountAmount;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error('Please select a client');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setLoading(true);
    try {
      await billingService.createInvoice({
        client_id: clientId,
        period_start: new Date(periodStart).toISOString(),
        period_end: new Date(periodEnd).toISOString(),
        due_date: new Date(dueDate).toISOString(),
        items: items.map(item => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unitPrice),
        })),
        tax_percent: Number(taxPercent),
        discount_amount: Number(discountAmount),
        notes: notes,
      });
      toast.success('Invoice created successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
    c.client_code.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-slate-900 font-bold text-xl">Create Manual Invoice</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Client</Label>
            <div className="relative">
              <Input 
                placeholder="Search Client..." 
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 bg-white"
              />
              {clientSearch && !clientId && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {loadingClients ? (
                    <div className="p-2 text-center text-sm text-slate-500"><LoadingSpinner size={16} /></div>
                  ) : filteredClients.length > 0 ? (
                    filteredClients.map(client => (
                      <div 
                        key={client.id}
                        className="p-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100 last:border-0"
                        onClick={() => handleSelectClient(client)}
                      >
                        <span className="font-medium text-slate-900">{client.name}</span> <span className="text-slate-500">({client.client_code})</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-slate-500">No clients found</div>
                  )}
                </div>
              )}
               {clientId && (
                <div className="flex gap-2 mt-2">
                   <div className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded text-sm flex items-center gap-2">
                      <span className="font-medium">Selected:</span> {clients.find(c => c.id === clientId)?.name}
                      <button type="button" onClick={() => { setClientId(''); setClientSearch(''); }} className="text-indigo-400 hover:text-indigo-600 font-bold text-lg ml-1">×</button>
                   </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Period Start</Label>
              <Input 
                type="date" 
                value={periodStart} 
                onChange={(e) => setPeriodStart(e.target.value)} 
                required 
                className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Period End</Label>
              <Input 
                type="date" 
                value={periodEnd} 
                onChange={(e) => setPeriodEnd(e.target.value)} 
                required 
                className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Due Date</Label>
              <Input 
                type="date" 
                value={dueDate} 
                onChange={(e) => setDueDate(e.target.value)} 
                required 
                className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
              <Label className="text-slate-700 font-bold">Items</Label>
              <Button 
                type="button" 
                size="sm" 
                variant="outline" 
                onClick={handleAddItem}
                className="bg-white hover:bg-slate-50 text-indigo-600 border-indigo-200 hover:border-indigo-300"
              >
                <PlusIcon className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>
            
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-start p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-slate-300 transition-colors">
                  <div className="flex-grow space-y-1">
                    <Label className="text-xs text-slate-500">Description</Label>
                    <Input 
                      placeholder="Item Description" 
                      className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 bg-white" 
                      value={item.description}
                      onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-24 space-y-1">
                     <Label className="text-xs text-slate-500">Qty</Label>
                    <Input 
                      type="number" 
                      placeholder="Qty" 
                      className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 bg-white" 
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="w-40 space-y-1">
                     <Label className="text-xs text-slate-500">Price (IDR)</Label>
                    <Input 
                      type="text" 
                      placeholder="Price" 
                      className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 bg-white" 
                      value={formatDisplayValue(item.unitPrice)}
                      onChange={(e) => handleItemChange(index, 'unitPrice', parseDisplayValue(e.target.value))}
                      required
                    />
                  </div>
                   <div className="pt-6">
                      <Button 
                        type="button" 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleRemoveItem(index)} 
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </Button>
                   </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Tax (%)</Label>
              <Input 
                type="number" 
                min="0" 
                max="100" 
                step="0.1" 
                value={taxPercent} 
                onChange={(e) => setTaxPercent(Number(e.target.value))} 
                className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Discount (Rp)</Label>
              <Input 
                type="text" 
                value={formatDisplayValue(discountAmount)} 
                onChange={(e) => setDiscountAmount(parseDisplayValue(e.target.value))} 
                className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Notes</Label>
            <Input 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Optional notes for client..." 
              className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>

          <div className="bg-slate-50 p-4 rounded-lg space-y-2 border border-slate-200">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal:</span>
              <span className="text-slate-900 font-medium">Rp {calculateSubtotal().toLocaleString()}</span>
            </div>
             <div className="flex justify-between text-sm">
              <span className="text-slate-600">Tax ({taxPercent}%):</span>
              <span className="text-slate-900 font-medium">Rp {(calculateSubtotal() * taxPercent / 100).toLocaleString()}</span>
            </div>
             <div className="flex justify-between text-sm">
              <span className="text-slate-600">Discount:</span>
              <span className="text-emerald-600 font-medium">- Rp {discountAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-3 border-t border-slate-200 mt-2">
              <span className="text-slate-900">Total:</span>
              <span className="text-indigo-600">Rp {calculateTotal().toLocaleString()}</span>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={loading}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
            >
              {loading ? <LoadingSpinner size={16} /> : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
