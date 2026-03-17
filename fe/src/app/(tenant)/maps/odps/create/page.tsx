"use client";

import { useEffect } from "react";
import { ODPForm } from "@/components/maps/ODPForm";
import { useMapsStore } from "@/stores/mapsStore";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { 
  Box, 
  ArrowLeft, 
  ChevronRight, 
  Home,
  PlusSquare,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils/styles";

export default function CreateODPPage() {
  const router = useRouter();
  const { createODP, loading, fetchODCs, odcs } = useMapsStore();
  const { showToast } = useNotificationStore();

  useEffect(() => {
    fetchODCs();
  }, [fetchODCs]);

  const handleSubmit = async (data: CreateODPRequest | UpdateODPRequest) => {
    try {
      await createODP(data as CreateODPRequest);
      showToast({
        title: "ODP created",
        description: "New ODP has been successfully added.",
        variant: "success",
      });
      router.push("/maps/odps");
    } catch (err: any) {
      showToast({
        title: "Failed to create ODP",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    }
  };

  const handleCancel = () => {
    router.push("/maps/odps");
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumbs & Navigation */}
        <div className="flex flex-col gap-4">
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-widest">
            <Home className="h-3 w-3" />
            <ChevronRight className="h-3 w-3" />
            <span>Maps</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-indigo-600">ODP Setup</span>
          </nav>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleCancel}
                className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 transition-all text-slate-600 hover:text-indigo-600 group"
                title="Back to ODPs"
              >
                <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Box className="h-6 w-6 text-indigo-600" />
                  </div>
                  Configure ODP Node
                </h1>
                <p className="text-slate-500 text-sm mt-1">Add a new Optical Distribution Point for subscriber termination</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 text-indigo-900 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Info className="h-5 w-5 text-indigo-600" />
          </div>
          <p className="text-sm font-medium opacity-90 text-indigo-800">
            Please make sure the ODP is parented to the correct ODC for optimal topology visualization.
          </p>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
          <div className="bg-slate-50/50 border-b border-slate-100 p-6 flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-wider">
            <PlusSquare className="h-4 w-4 text-indigo-500" />
            ODP Configuration Details
          </div>
          <div className="p-8 md:p-10">
            <ODPForm odcs={odcs} onSubmit={handleSubmit} onCancel={handleCancel} isLoading={loading} />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-slate-400 text-xs py-4">
          <p>© 2026 ERP Net Infrastructure — Network Intelligence Unit</p>
        </div>
      </div>
    </div>
  );
}

