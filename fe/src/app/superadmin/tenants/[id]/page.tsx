"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSuperAdminStore } from "@/stores/superAdminStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { TenantStatusBadge } from "@/components/superadmin/TenantStatusBadge";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Pencil, 
  Building2, 
  Globe, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Shield, 
  Zap,
  Clock,
  ExternalLink,
  ChevronRight,
  Fingerprint,
  CheckCircle,
  XCircle,
  RefreshCcw,
  AlertTriangle,
  Server,
  AlertCircle
} from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { 
    tenant, loading, error, fetchTenant, clearTenant, 
    approveTenant, rejectTenant, unsuspendTenant, decommissionRouter 
  } = useSuperAdminStore();
  const { showToast } = useNotificationStore();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [unsuspending, setUnsuspending] = useState(false);
  const [decommissioningId, setDecommissioningId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchTenant(id);
    }
    return () => {
      clearTenant();
    };
  }, [id, fetchTenant, clearTenant]);

  const handleApprove = async () => {
    if (!tenant || approving) return;
    
    setApproving(true);
    try {
      await approveTenant(tenant.id);
      showToast('Tenant approved successfully!', 'success');
      // Refresh tenant data
      fetchTenant(id);
    } catch (err: any) {
      showToast(err.message || 'Failed to approve tenant', 'error');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!tenant || rejecting) return;
    
    const reason = prompt('Enter rejection reason (optional):');
    
    setRejecting(true);
    try {
      await rejectTenant(tenant.id, reason || 'No reason provided');
      showToast('Tenant rejected/suspended successfully', 'success');
      // Refresh tenant data
      fetchTenant(id);
    } catch (err: any) {
      showToast(err.message || 'Failed to reject tenant', 'error');
    } finally {
      setRejecting(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!tenant || unsuspending) return;
    
    setUnsuspending(true);
    try {
      await unsuspendTenant(tenant.id);
      showToast('Tenant access restored successfully!', 'success');
      fetchTenant(id);
    } catch (err: any) {
      showToast(err.message || 'Failed to unsuspend tenant', 'error');
    } finally {
      setUnsuspending(false);
    }
  };

  const handleDecommission = async (routerId: string) => {
    if (!confirm("Are you sure you want to FORCE decommission this router? This will remove all configurations from VPS and MikroTik.")) return;
    
    setDecommissioningId(routerId);
    try {
      await decommissionRouter(routerId);
      showToast('Router decommissioning initiated', 'success');
      fetchTenant(id);
    } catch (err: any) {
      showToast(err.message || 'Failed to decommission router', 'error');
    } finally {
      setDecommissioningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner size={48} className="text-purple-600" />
          <p className="text-slate-500 font-medium animate-pulse">Loading organization data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-10 bg-red-50 border border-red-100 rounded-3xl text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
           <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-red-900">Error Loading Organization</h2>
        <p className="text-red-700">{error}</p>
        <Button onClick={() => router.back()} variant="outline" className="rounded-xl">
           Go Back
        </Button>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-10 bg-slate-50 border border-slate-100 rounded-3xl text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Organization Not Found</h2>
        <p className="text-slate-500">The requested organization could not be found in our systems.</p>
        <Button onClick={() => router.back()} variant="outline" className="rounded-xl">
           Return to List
        </Button>
      </div>
    );
  }

  const sections = [
    {
      title: "CORE IDENTITY",
      icon: <Building2 className="w-4 h-4" />,
      items: [
        { label: "Organization Name", value: tenant.name, icon: <Building2 className="w-4 h-4 text-purple-600" /> },
        { label: "System Slug", value: tenant.slug, icon: <Fingerprint className="w-4 h-4 text-purple-600" /> },
        { label: "Custom Domain", value: tenant.domain || "-", icon: <Globe className="w-4 h-4 text-purple-600" />, secondary: tenant.domain ? "Custom DNS Active" : "Using System Domain" },
      ]
    },
    {
      title: "ADMINISTRATIVE OWNER",
      icon: <User className="w-4 h-4" />,
      items: [
        { label: "Primary Contact", value: tenant.owner_name || "-", icon: <User className="w-4 h-4 text-purple-600" /> },
        { label: "Email Address", value: tenant.owner_email || "-", icon: <Mail className="w-4 h-4 text-purple-600" />, className: "text-purple-600 font-bold" },
        { label: "WhatsApp Phone", value: tenant.owner_phone || "-", icon: <Phone className="w-4 h-4 text-purple-600" />, className: "text-emerald-600 font-bold" },
      ]
    },
    {
      title: "SUBSCRIPTION PLAN",
      icon: <Zap className="w-4 h-4" />,
      items: [
        { 
          label: "Plan Name", 
          value: tenant.plan_name || "No Plan Assigned", 
          icon: <Shield className="w-4 h-4 text-purple-600" />,
          className: tenant.plan_name ? "text-purple-600 font-bold" : "text-slate-400"
        },
        { 
          label: "Plan Code", 
          value: tenant.plan_code || "-", 
          icon: <Fingerprint className="w-4 h-4 text-purple-600" />,
          className: "font-mono text-sm"
        },
        { 
          label: "Monthly Price", 
          value: tenant.plan_price ? `Rp ${tenant.plan_price.toLocaleString('id-ID')}` : "-", 
          icon: <Zap className="w-4 h-4 text-purple-600" />,
          className: tenant.plan_price ? "text-emerald-600 font-black text-lg" : "text-slate-400"
        },
      ]
    },
    {
      title: "LIFECYCLE & SUBSCRIPTION",
      icon: <Clock className="w-4 h-4" />,
      items: [
        { label: "Provisioned Date", value: tenant.created_at ? format(new Date(tenant.created_at), "PPP") : "-", icon: <Calendar className="w-4 h-4 text-purple-600" /> },
        { label: "Last System Update", value: tenant.updated_at ? format(new Date(tenant.updated_at), "PPP p") : "-", icon: <Clock className="w-4 h-4 text-purple-600" /> },
        { 
          label: "Trial Period", 
          value: tenant.trial_ends_at ? format(new Date(tenant.trial_ends_at), "PPP") : "No Active Trial", 
          icon: <Zap className="w-4 h-4 text-purple-600" />,
          isWarning: tenant.trial_ends_at ? new Date(tenant.trial_ends_at) < new Date() : false
        },
      ]
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-10 pb-24">
      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6"
      >
        <div className="space-y-4">
          <button 
            onClick={() => router.push("/superadmin/tenants")}
            className="flex items-center gap-2 text-slate-400 hover:text-purple-600 transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Organizations
          </button>
          <div className="flex items-center gap-4">
             <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-purple-200">
                <Building2 className="w-8 h-8" />
             </div>
             <div>
                <div className="flex items-center gap-3 mb-1">
                   <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">{tenant.name}</h1>
                   <TenantStatusBadge status={tenant.status} />
                </div>
                <p className="text-slate-500 font-medium flex items-center gap-2">
                   <Zap className="w-4 h-4 text-amber-500" />
                   {tenant.plan_id ? `Premium Plan Active` : "No Subscription Plan"} • {tenant.slug}.rrnet.local
                </p>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
           {/* Approve button - only for pending tenants */}
           {tenant.status === 'pending' && (
             <Button 
               variant="default" 
               className="rounded-2xl bg-green-600 hover:bg-green-700 font-bold px-6 h-12 shadow-lg shadow-green-200 text-white"
               onClick={handleApprove}
               disabled={approving}
             >
               {approving ? (
                 <>
                   <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                   Approving...
                 </>
               ) : (
                 <>
                   <CheckCircle className="h-4 w-4 mr-2" /> 
                   Approve Tenant
                 </>
               )}
             </Button>
           )}

           {/* Unsuspend button - only for suspended tenants */}
           {tenant.status === 'suspended' && (
             <Button 
               variant="default" 
               className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-bold px-6 h-12 shadow-lg shadow-emerald-200 text-white"
               onClick={handleUnsuspend}
               disabled={unsuspending}
             >
               {unsuspending ? (
                 <>
                   <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                   Restoring...
                 </>
               ) : (
                 <>
                   <CheckCircle className="h-4 w-4 mr-2" /> 
                   Restore Access
                 </>
               )}
             </Button>
           )}
           
           {/* Reject/Suspend button - only for pending or active tenants */}
           {(tenant.status === 'pending' || tenant.status === 'active') && (
             <Button 
               variant="destructive" 
               className="rounded-2xl font-bold px-6 h-12 shadow-lg"
               onClick={handleReject}
               disabled={rejecting}
             >
               {rejecting ? (
                 <>
                   <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                   Rejecting...
                 </>
               ) : (
                 <>
                   <XCircle className="h-4 w-4 mr-2" /> 
                   Reject/Suspend
                 </>
               )}
             </Button>
           )}

           <Button 
              variant="outline" 
              className="rounded-2xl border-slate-200 hover:bg-slate-50 font-bold px-6 h-12 shadow-sm"
              onClick={() => router.push(`/superadmin/tenants/${tenant.id}/edit`)}
           >
              <Pencil className="h-4 w-4 mr-2" /> 
              Update Configuration
           </Button>
           <Button 
              className="rounded-2xl bg-slate-900 border-slate-900 hover:bg-slate-800 font-bold px-6 h-12 shadow-lg shadow-slate-200 text-white"
              onClick={() => window.open(`http://${tenant.slug}.rrnet.local:3000`, '_blank')}
           >
              <ExternalLink className="h-4 w-4 mr-2" />
              Access Dashboard
           </Button>
        </div>
      </motion.div>

      {/* Compliance Alert - Only shown if NOT compliant */}
      {tenant && tenant.is_compliant === false && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-50 border-2 border-amber-500/20 rounded-[2rem] p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl shadow-amber-900/5"
        >
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-amber-200">
             <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="flex-1 text-center md:text-left space-y-1">
             <h3 className="text-xl font-black text-amber-900">Compliance Warning: Limit Exceeded</h3>
             <p className="text-amber-700 font-medium">Ini terjadi karena tenant melakukan downgrade plan namun resource lama masih aktif. Segera sesuaikan jumlah router agar sesuai dengan limit plan baru.</p>
          </div>
          <div className="flex items-center gap-4 bg-white/50 p-4 rounded-2xl border border-amber-200">
             {tenant.usage_stats?.map(stat => (
                <div key={stat.resource_name} className="text-center px-4 border-r last:border-0 border-amber-200">
                   <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">{stat.resource_name}</p>
                   <p className="text-lg font-black text-amber-900">{stat.usage} / {stat.limit}</p>
                </div>
             ))}
          </div>
        </motion.div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-8">
            {sections.map((section, idx) => (
               <motion.div 
                  key={section.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="space-y-4"
               >
                  <div className="flex items-center gap-2 text-xs font-black text-slate-400 tracking-[0.2em]">
                     {section.icon}
                     {section.title}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {section.items.map((item, i) => (
                        <div key={item.label} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative group">
                           <div className="absolute right-6 top-6 text-slate-100 group-hover:text-slate-200 transition-colors">
                              {item.icon}
                           </div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                           <p className={cn(
                              "text-lg font-black tracking-tight",
                              item.className || "text-slate-900",
                              item.isWarning && "text-amber-600"
                           )}>
                              {item.value}
                           </p>
                           {/* @ts-ignore */}
                           {item.secondary && <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase">{item.secondary}</p>}
                        </div>
                     ))}
                  </div>
               </motion.div>
            ))}

            {/* Router Compliance Management Section - Only shown if NOT compliant */}
            {tenant && tenant.is_compliant === false && (
               <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
               >
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-400 tracking-[0.2em]">
                     <Server className="w-4 h-4" />
                     ROUTER COMPLIANCE MANAGEMENT
                  </div>
                  {tenant.routers && (
                    <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500">
                      Total: {tenant.routers.length} Active Routers
                    </div>
                  )}
               </div>

               <div className="grid grid-cols-1 gap-4">
                  {tenant.routers && tenant.routers.length > 0 ? (
                    tenant.routers.map((router, idx) => (
                      <div key={router.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-6 group">
                         <div className="flex items-center gap-6">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors",
                              router.status === "online" ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                            )}>
                               <Server className="w-6 h-6" />
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                  <h4 className="font-black text-slate-900 uppercase tracking-tight">{router.name}</h4>
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                                    router.status === "online" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                                  )}>
                                    {router.status}
                                  </span>
                               </div>
                               <p className="text-xs font-mono text-slate-400">{router.host}:{router.port} • ID: {router.id.substring(0,8)}</p>
                            </div>
                         </div>

                         <div className="flex items-center gap-3">
                            <div className="text-right hidden md:block">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">VPN Tunnel</p>
                               <p className="text-sm font-black text-purple-600">{router.vpn_username || "Direct"}</p>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="rounded-xl h-10 px-4 font-bold bg-white border-2 border-red-100 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                              disabled={decommissioningId === router.id}
                              onClick={() => handleDecommission(router.id)}
                            >
                              {decommissioningId === router.id ? (
                                <RefreshCcw className="w-4 h-4 animate-spin" />
                              ) : (
                                "Force Stop"
                              )}
                            </Button>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center space-y-2">
                       <Server className="w-8 h-8 text-slate-300 mx-auto opacity-20" />
                       <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active routers detected</p>
                    </div>
                  )}
               </div>
            </motion.div>
            )}
         </div>

         {/* Sidebar Stats/Info */}
         <div className="space-y-8">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200 space-y-6 relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Shield size={120} />
               </div>
               
               <div className="space-y-2 relative z-10">
                  <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Billing Engine</p>
                  <h3 className="text-3xl font-black italic tracking-tighter">FINANCIAL STATUS</h3>
               </div>

               <div className="p-6 bg-white/10 backdrop-blur-md rounded-3xl space-y-4 relative z-10">
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-medium text-white/80">Account Status</span>
                     <span className="text-sm font-black uppercase bg-white/20 px-3 py-1 rounded-full">{tenant.billing_status}</span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-medium text-white/80">Active Plan</span>
                     <span className="text-sm font-black uppercase flex items-center gap-1">
                        <Zap className={cn("w-3 h-3", tenant.plan_name ? "text-amber-400 fill-amber-400" : "text-slate-400")} />
                        {tenant.plan_name || "NO PLAN"}
                     </span>
                  </div>
               </div>

               <Button className="w-full h-14 bg-white text-indigo-600 hover:bg-slate-50 font-black rounded-2xl shadow-xl transition-all active:scale-95 relative z-10">
                  View Billing Ledger
                  <ChevronRight className="w-4 h-4 ml-2" />
               </Button>
            </motion.div>

            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
                <h4 className="text-sm font-bold flex items-center gap-2 mb-6">
                   <Fingerprint className="w-4 h-4 text-purple-400" />
                   Metadata
                </h4>
                <div className="space-y-4 text-xs font-medium text-slate-400">
                   <div className="flex justify-between">
                      <span>Unique ID</span>
                      <span className="text-white font-mono break-all text-[10px]">{tenant.id}</span>
                   </div>
                   <div className="flex justify-between">
                      <span>API Access</span>
                      <span className="text-emerald-400">Restricted</span>
                   </div>
                   <div className="flex justify-between">
                      <span>Traffic Mode</span>
                      <span className="text-white">Isolated</span>
                   </div>
                </div>
            </div>
         </div>
      </div>
    </div>
  );
}



