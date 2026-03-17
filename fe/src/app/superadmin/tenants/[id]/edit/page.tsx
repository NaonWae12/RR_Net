"use client";

import { useEffect, useState } from "react";
import { TenantForm } from "@/components/superadmin/TenantForm";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { useParams, useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { UpdateTenantRequest } from "@/lib/api/types";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { ArrowLeft, Trash2, AlertTriangle, Building2, Save, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { superAdminService } from "@/lib/api/superAdminService";

export default function EditTenantPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tenant, loading, error, fetchTenant, updateTenant, deleteTenant, clearTenant } = useSuperAdminStore();
  const { showToast } = useNotificationStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTenant(id);
    }
    return () => {
      clearTenant();
    };
  }, [id, fetchTenant, clearTenant]);

  const handleSubmit = async (data: UpdateTenantRequest) => {
    if (!id) return;
    try {
      await updateTenant(id, data);
      showToast({
        title: "Configuration Synchronized",
        description: `${tenant?.name} has been updated successfully.`,
        variant: "success",
      });
      router.push(`/superadmin/tenants/${id}`);
    } catch (err: any) {
      showToast({
        title: "Sync Failed",
        description: err?.message || "An unexpected error occurred during update.",
        variant: "error",
      });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deleteTenant(id);
      showToast({
        title: "Organization Terminated",
        description: "The organization has been successfully removed from the system.",
        variant: "success",
      });
      router.push("/superadmin/tenants");
    } catch (err: any) {
      showToast({
        title: "Termination Failed",
        description: err?.message || "Could not delete organization.",
        variant: "error",
      });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancel = () => {
    router.push(`/superadmin/tenants/${id}`);
  };

  if (loading && !tenant) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner size={48} className="text-purple-600" />
          <p className="text-slate-500 font-medium tracking-wide">Retrieving organization manifest...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-10 bg-red-50 border border-red-100 rounded-[2rem] text-center space-y-4">
        <h2 className="text-xl font-bold text-red-900">System Error</h2>
        <p className="text-red-700">{error}</p>
        <Button onClick={handleCancel} variant="outline" className="rounded-xl">
           Abort & Back
        </Button>
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-32 space-y-10">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <button 
             onClick={handleCancel}
             className="flex items-center gap-2 text-slate-400 hover:text-purple-600 transition-colors text-[10px] font-black uppercase tracking-[0.2em] mb-4"
          >
            <ArrowLeft className="w-3 h-3" /> Back to Profile
          </button>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                <Building2 className="w-5 h-5" />
             </div>
             <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Modify Settings</h1>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">{tenant.name}</p>
             </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         {/* Form Section */}
         <div className="lg:col-span-8">
            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-sm">
               <TenantForm 
                  initialData={tenant} 
                  onSubmit={handleSubmit} 
                  onCancel={handleCancel} 
                  isLoading={loading} 
               />
            </div>
         </div>

         {/* Danger Zone */}
         <div className="lg:col-span-4 space-y-6">
            <div className="bg-red-50/50 border border-red-100 rounded-[2.5rem] p-8 space-y-6">
               <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Danger Zone</span>
               </div>
               
               <div className="space-y-2">
                  <h3 className="text-sm font-bold text-red-950">Remove Organization</h3>
                  <p className="text-xs text-red-700/70 leading-relaxed font-medium">
                     This action will soft-delete the organization. All active sessions and configurations will be paused.
                  </p>
               </div>

               <AnimatePresence mode="wait">
                  {!showDeleteConfirm ? (
                    <motion.div
                       key="delete-btn"
                       initial={{ opacity: 0, scale: 0.95 }}
                       animate={{ opacity: 1, scale: 1 }}
                       exit={{ opacity: 0, scale: 0.95 }}
                    >
                       <Button 
                          variant="destructive" 
                          className="w-full h-12 rounded-2xl font-bold flex items-center gap-2 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-100"
                          onClick={() => setShowDeleteConfirm(true)}
                       >
                          <Trash2 className="w-4 h-4" />
                          Delete Organization
                       </Button>
                    </motion.div>
                  ) : (
                    <motion.div 
                       key="confirm-box"
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="space-y-3"
                    >
                       <p className="text-[10px] font-black text-red-900 uppercase text-center mb-2 animate-pulse">Confirm Termination?</p>
                       <div className="flex flex-col gap-2">
                          <Button 
                             onClick={handleDelete}
                             disabled={isDeleting}
                             className="w-full h-12 rounded-2xl bg-red-950 hover:bg-black font-black text-xs text-white"
                          >
                             {isDeleting ? <LoadingSpinner size={16} /> : "YES, DELETE PERMANENTLY"}
                          </Button>
                          <Button 
                             variant="ghost"
                             onClick={() => setShowDeleteConfirm(false)}
                             className="w-full h-10 rounded-xl text-slate-500 font-bold hover:bg-white text-xs"
                          >
                             CANCEL
                          </Button>
                       </div>
                    </motion.div>
                  )}
               </AnimatePresence>
            </div>

            <div className="bg-slate-900 rounded-[2rem] p-8 text-white">
                <div className="flex items-center gap-2 mb-4">
                   <Shield className="w-4 h-4 text-purple-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Security Audit</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                   Changes to system identifiers (slugs) may affect DNS routing and active sessions. Proceed with caution.
                </p>
            </div>
         </div>
      </div>
    </div>
  );
}

