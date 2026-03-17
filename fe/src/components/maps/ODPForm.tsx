"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { ODP, CreateODPRequest, UpdateODPRequest, ODC } from "@/lib/api/types";
import { 
  Database, 
  MapPin, 
  Settings, 
  MessageSquare,
  Check,
  Send,
  Workflow,
  Box
} from "lucide-react";
import { cn } from "@/lib/utils/styles";

const odpFormSchema = z.object({
  odc_id: z.string().min(1, "ODC is required"),
  name: z.string().min(1, "Name is required"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  port_count: z.coerce.number().min(1).default(8),
  notes: z.string().optional(),
});

type ODPFormValues = z.infer<typeof odpFormSchema>;

interface ODPFormProps {
  initialData?: ODP;
  odcs: ODC[];
  onSubmit: (data: CreateODPRequest | UpdateODPRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function ODPForm({ initialData, odcs, onSubmit, onCancel, isLoading }: ODPFormProps) {
  const searchParams = useSearchParams();
  const presetLat = parseFloat(searchParams.get("lat") || "") || -6.2088;
  const presetLng = parseFloat(searchParams.get("lng") || "") || 106.8456;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ODPFormValues>({
    resolver: zodResolver(odpFormSchema),
    defaultValues: {
      odc_id: "",
      name: "",
      latitude: presetLat,
      longitude: presetLng,
      port_count: 8,
      notes: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        odc_id: initialData.odc_id,
        name: initialData.name,
        latitude: initialData.latitude,
        longitude: initialData.longitude,
        port_count: initialData.port_count,
        notes: initialData.notes || "",
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: ODPFormValues) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-10">
      {/* Step 1: Network Hierarchy */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-tight text-sm">
          <Workflow className="h-4 w-4 text-indigo-500" />
          Network Hierarchy
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-bold text-slate-700 ml-1 mb-2 block">Parent ODC</label>
            <SimpleSelect
              value={watch("odc_id")}
              onValueChange={(value) => setValue("odc_id", value)}
              className="w-full h-12 bg-white border-slate-200 text-slate-700"
            >
              <option value="">Choose ODC Source</option>
              {odcs.map((odc) => (
                <option key={odc.id} value={odc.id}>
                  {odc.name}
                </option>
              ))}
            </SimpleSelect>
            {errors.odc_id && <p className="text-xs text-red-500 mt-1">{errors.odc_id.message}</p>}
          </div>

          <div>
             <Input 
              label="ODP Name" 
              placeholder="e.g. ODP-AREA-A1-01"
              {...register("name")} 
              error={errors.name?.message} 
              className="h-12 text-base font-medium"
            />
          </div>
        </div>
      </div>

      {/* Step 2: Technicals & Location */}
      <div className="space-y-6 pt-2 border-t border-slate-50">
        <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-tight text-sm">
          <Settings className="h-4 w-4 text-emerald-500" />
          Hardware & Location
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Input
              label="Available Ports"
              type="number"
              placeholder="e.g. 8"
              {...register("port_count")}
              error={errors.port_count?.message}
              className="h-12"
            />
          </div>

          <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 ring-1 ring-slate-100 shadow-sm transition-all hover:bg-slate-50">
            <Input
              label="Latitude"
              type="number"
              step="any"
              {...register("latitude")}
              error={errors.latitude?.message}
              className="bg-white h-11"
              placeholder="-6.2088"
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              {...register("longitude")}
              error={errors.longitude?.message}
              className="bg-white h-11"
              placeholder="106.8456"
            />
          </div>
        </div>
      </div>

      {/* Step 3: Documentation */}
      <div className="space-y-6 pt-2 border-t border-slate-50">
        <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-tight text-sm">
          <MessageSquare className="h-4 w-4 text-slate-400" />
          Technical Notes
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 ml-1 mb-2 block text-xs">Internal Deployment Notes</label>
          <textarea
            {...register("notes")}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500/50 transition-all bg-white shadow-sm h-32"
            placeholder="Document spliter ratios, tube colors, or physical location reference..."
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-8 border-t border-slate-100">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={onCancel} 
          disabled={isLoading}
          className="px-6 h-12 text-slate-500 hover:text-slate-900 font-bold"
        >
          Discard
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading} 
          className={cn(
            "px-10 h-12 rounded-xl font-bold tracking-wide shadow-lg transition-all active:scale-95 flex items-center gap-2",
            initialData ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100" : "bg-slate-900 hover:bg-black shadow-slate-300"
          )}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 opacity-80">
              <span className="animate-pulse">Processing...</span>
            </span>
          ) : (
            <>
              {initialData ? (
                <>
                  <Check className="h-4 w-4" />
                  Update ODP
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Deploy ODP
                </>
              )}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

