"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ODC, CreateODCRequest, UpdateODCRequest } from "@/lib/api/types";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Database, 
  MapPin, 
  BarChart3, 
  MessageSquare,
  Check,
  Send
} from "lucide-react";
import { cn } from "@/lib/utils/styles";

const odcFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  capacity_info: z.string().optional(),
  notes: z.string().optional(),
});

type ODCFormValues = z.infer<typeof odcFormSchema>;

interface ODCFormProps {
  initialData?: ODC;
  onSubmit: (data: CreateODCRequest | UpdateODCRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function ODCForm({ initialData, onSubmit, onCancel, isLoading }: ODCFormProps) {
  const searchParams = useSearchParams();
  const presetLat = parseFloat(searchParams.get("lat") || "") || -6.2088;
  const presetLng = parseFloat(searchParams.get("lng") || "") || 106.8456;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ODCFormValues>({
    resolver: zodResolver(odcFormSchema),
    defaultValues: {
      name: "",
      latitude: presetLat,
      longitude: presetLng,
      capacity_info: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        latitude: initialData.latitude,
        longitude: initialData.longitude,
        capacity_info: initialData.capacity_info || "",
        notes: initialData.notes || "",
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: ODCFormValues) => {
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-10">
      {/* Basic Info Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-tight text-sm">
          <Database className="h-4 w-4 text-indigo-500" />
          General Information
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Input 
              label="ODC Name" 
              placeholder="e.g. ODC-CENTRAL-01"
              {...register("name")} 
              error={errors.name?.message} 
              className="h-12 text-base font-medium"
            />
          </div>
          <div>
            <Input
              label="Capacity Info (optional)"
              placeholder="e.g. 288 Core"
              {...register("capacity_info")}
              error={errors.capacity_info?.message}
              className="h-12"
            />
          </div>
        </div>
      </div>

      {/* Geospatial Section */}
      <div className="space-y-6 pt-2 border-t border-slate-50">
        <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-tight text-sm">
          <MapPin className="h-4 w-4 text-rose-500" />
          Infrastructure Location
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 ring-1 ring-slate-100 shadow-sm transition-all hover:bg-slate-50">
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

      {/* Additional Details */}
      <div className="space-y-6 pt-2 border-t border-slate-50">
        <div className="flex items-center gap-2 text-slate-900 font-bold uppercase tracking-tight text-sm">
          <MessageSquare className="h-4 w-4 text-slate-400" />
          Technical Notes
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 ml-1 mb-2 block">Notes & Internal Documentation</label>
          <textarea
            {...register("notes")}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500/50 transition-all bg-white shadow-sm h-32"
            placeholder="Document installation details, cabinet type, or specific location pointers..."
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
                  Update ODC
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Deploy ODC
                </>
              )}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

