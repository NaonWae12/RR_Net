import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import type { SuperAdminTenant, UpdateTenantRequest } from "@/lib/api/types";
import { motion } from "framer-motion";
import { Globe, Shield, Activity, Fingerprint, Plus, Phone } from "lucide-react";

const tenantFormSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  slug: z.string().min(1, "System slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase and contain only alphanumeric or hyphens"),
  domain: z.string().nullable().optional(),
  status: z.enum(["active", "suspended", "pending", "deleted"]).optional(),
  owner_phone: z.string().nullable().optional(),
});

type TenantFormValues = z.infer<typeof tenantFormSchema>;

interface TenantFormProps {
  initialData?: SuperAdminTenant;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function TenantForm({ initialData, onSubmit, onCancel, isLoading }: TenantFormProps) {
  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      domain: "",
      status: "active",
      owner_phone: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        slug: initialData.slug,
        domain: initialData.domain || "",
        status: initialData.status,
        owner_phone: initialData.owner_phone || "",
      });
    }
  }, [initialData, reset]);

  // Auto-slug generation from name if name changes and we're not editing
  const name = watch("name");
  useEffect(() => {
    if (!isEditing && name) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setValue("slug", slug);
    }
  }, [name, setValue, isEditing]);

  const handleFormSubmit = async (data: TenantFormValues) => {
    // Ensure empty strings are handled as null for the backend
    const submissionData = {
      ...data,
      owner_phone: data.owner_phone === "" ? null : data.owner_phone,
      domain: data.domain === "" ? null : data.domain,
    };
    await onSubmit(submissionData);
  };

  return (
    <motion.form 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit(handleFormSubmit)} 
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Shield size={14} /> Basic Information
          </label>
          <Input 
            placeholder="e.g. Acme Corporation" 
            {...register("name")} 
            error={errors.name?.message} 
            className="rounded-xl border-slate-200 h-12"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Fingerprint size={14} /> System Identifier
          </label>
          <div className="relative">
            <Input 
              placeholder="e.g. acme-corp" 
              {...register("slug")} 
              error={errors.slug?.message} 
              className="rounded-xl border-slate-200 h-12 pr-24"
            />
            <div className="absolute right-3 top-3.5 text-[10px] font-bold text-slate-300 pointer-events-none uppercase">
              .platform
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-medium ml-1">Unique URL path for this organization.</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Globe size={14} /> Custom Domain
          </label>
          <Input 
            placeholder="e.g. erp.acme.com" 
            {...register("domain")} 
            error={errors.domain?.message} 
            className="rounded-xl border-slate-200 h-12"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
           <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Phone size={14} /> WhatsApp Owner
          </label>
          <Input 
            placeholder="e.g. 628123456789" 
            {...register("owner_phone")} 
            error={errors.owner_phone?.message} 
            className="rounded-xl border-slate-200 h-12"
          />
          <p className="text-[10px] text-slate-400 font-medium ml-1 italic">Pake format internasional bre (62xxx).</p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Activity size={14} /> Initial Status
          </label>
          <SimpleSelect
            value={watch("status") || "active"}
            onValueChange={(value) => setValue("status", value as any)}
            className="w-full rounded-xl border-slate-200 h-12"
          >
            <option value="active">Active (Production)</option>
            <option value="suspended">Suspended (Restricted)</option>
            <option value="pending">Pending (Verification)</option>
          </SimpleSelect>
          {errors.status && <p className="text-xs text-red-500 mt-1">{errors.status.message}</p>}
        </div>
      </div>

      <div className="pt-6 flex justify-end gap-3 border-t border-slate-50">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel} 
          disabled={isLoading}
          className="rounded-xl font-bold px-6"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading}
          className="rounded-xl font-bold px-8 shadow-sm flex items-center gap-2"
        >
          {isLoading ? (
            <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isEditing ? (
            "Save Changes"
          ) : (
            <>
              <Plus size={16} /> Provision Organization
            </>
          )}
        </Button>
      </div>
    </motion.form>
  );
}

