"use client";

import React from "react";
import { Modal } from "@/components/modals/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  SimpleSelect
} from "@/components/ui/select";
import { 
  PlusIcon, 
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { inventoryService } from "@/lib/api/inventoryService";

interface NewAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewAssetModal({ isOpen, onClose }: NewAssetModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("router");
  const [condition, setCondition] = React.useState("new");
  const [stock, setStock] = React.useState("0");
  const [unit, setUnit] = React.useState("pcs");
  const [minStock, setMinStock] = React.useState("5");
  const [description, setDescription] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await inventoryService.createAsset({
        name,
        category,
        description,
        min_stock: parseInt(minStock),
        unit,
        code: `${Date.now().toString().slice(-4)}`, // Numeric suffix only for cleaner IDs
        initial_stock: parseInt(stock),
        initial_condition: condition,
      });

      toast.success("New asset has been added successfully!");
      onClose();
      // Optionally trigger a refresh if we had a refresh callback
      window.location.reload(); // Simple way to refresh the list
    } catch (error) {
      toast.error("Failed to add new asset");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Asset"
      subtitle="Fill in the details below to add a new item to your inventory system."
      size="lg"
      className="bg-slate-50/80 backdrop-blur-xl border-slate-200/60 shadow-2xl"
      footer={
        <div className="flex gap-3 w-full justify-end">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="rounded-xl border-slate-200 hover:bg-slate-100 transition-all font-bold text-slate-600">
            Cancel
          </Button>
          <Button 
            className="bg-slate-900 hover:bg-black gap-2 px-8 rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/10" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <PlusIcon className="w-4 h-4" />
            )}
            Save Asset
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6 py-4">
        {/* Basic Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-2">
            <Label htmlFor="asset-name" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Asset Name
            </Label>
            <Input 
              id="asset-name" 
              placeholder="e.g. Mikrotik RB5009" 
              className="h-12 bg-white/50 border-slate-200 focus:ring-2 focus:ring-slate-900 rounded-xl transition-all"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Category
            </Label>
            <SimpleSelect 
              className="h-12 bg-white/50 border-slate-200 focus:ring-2 focus:ring-slate-900 rounded-xl transition-all"
              placeholder="Select Category"
              value={category}
              onValueChange={setCategory}
            >
              <option value="router">Router & Networking</option>
              <option value="olt">OLT & Infrastructure</option>
              <option value="accessories">Accessories</option>
              <option value="cables">Cables & Fiber</option>
              <option value="others">Others</option>
            </SimpleSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="condition" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Initial Condition
            </Label>
            <SimpleSelect 
              className="h-12 bg-white/50 border-slate-200 focus:ring-2 focus:ring-slate-900 rounded-xl transition-all"
              value={condition}
              onValueChange={setCondition}
            >
              <option value="new">🆕 New / Baru</option>
              <option value="second">🔄 Second / Bekas</option>
              <option value="broken">⚠️ Broken / Rusak</option>
              <option value="refurbished">🛠️ Refurbished</option>
            </SimpleSelect>
          </div>
        </div>

        {/* Stock & Unit Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label htmlFor="initial-stock" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Initial Stock
            </Label>
            <Input 
              id="initial-stock" 
              type="number" 
              placeholder="0" 
              className="h-12 bg-white/50 border-slate-200 focus:ring-2 focus:ring-slate-900 rounded-xl transition-all"
              required
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Unit
            </Label>
            <SimpleSelect 
              className="h-12 bg-white/50 border-slate-200 focus:ring-2 focus:ring-slate-900 rounded-xl transition-all"
              value={unit}
              onValueChange={setUnit}
            >
              <option value="pcs">Pieces (Pcs)</option>
              <option value="meter">Meter (m)</option>
              <option value="roll">Roll</option>
              <option value="box">Box</option>
            </SimpleSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="min-stock" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Low Stock Alert
            </Label>
            <Input 
              id="min-stock" 
              type="number" 
              placeholder="5" 
              className="h-12 bg-white/50 border-slate-200 focus:ring-2 focus:ring-slate-900 rounded-xl transition-all"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
          </div>
        </div>

        {/* Additional Info */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
            Description/Notes
          </Label>
          <textarea 
            id="description" 
            placeholder="Technical specs, serial number patterns, or storage location..."
            className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-3 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Info Box */}
        <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 flex gap-3 items-start backdrop-blur-sm">
          <InformationCircleIcon className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <p className="text-[12px] text-indigo-700 leading-relaxed font-medium">
            <strong className="font-bold underline">System Intelligence:</strong> Upon saving, the tracking engine will automatically generate a 
            unique <span className="font-italic bg-indigo-100 px-1 rounded mx-0.5">Asset Tag QR</span> and a synchronized <span className="font-italic bg-indigo-100 px-1 rounded mx-0.5">System SKU Code</span> for this item.
          </p>
        </div>
      </form>
    </Modal>
  );
}
