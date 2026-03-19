"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NetworkProfile } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useNetworkStore } from "@/stores/networkStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useState } from "react";
import { Loader2, Trash2, Zap, ArrowDownCircle, ArrowUpCircle, ShieldCheck, Edit3, Eye } from "lucide-react";

interface NetworkProfileTableProps {
  profiles: NetworkProfile[] | null | undefined;
  loading: boolean;
}

function formatSpeed(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${kbps} Kbps`;
}

export function NetworkProfileTable({ profiles, loading }: NetworkProfileTableProps) {
  const router = useRouter();
  const { deleteProfile } = useNetworkStore();
  const { showToast } = useNotificationStore();
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; profile: { id: string; name: string } | null }>({
    open: false,
    profile: null,
  });
  const [deleting, setDeleting] = useState(false);

  const handleView = (id: string) => {
    router.push(`/network/profiles/${id}`);
  };

  const handleEdit = (id: string) => {
    router.push(`/network/profiles/${id}/edit`);
  };

  const openDeleteDialog = (id: string, name: string) => {
    setDeleteDialog({ open: true, profile: { id, name } });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.profile) return;
    setDeleting(true);
    try {
      await deleteProfile(deleteDialog.profile.id);
      showToast({
        title: "Profile deleted",
        description: `Profile "${deleteDialog.profile.name}" has been successfully deleted.`,
        variant: "success",
      });
      setDeleteDialog({ open: false, profile: null });
    } catch (error: any) {
      showToast({
        title: "Failed to delete profile",
        description: error.message || "An unexpected error occurred.",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (!profiles || profiles.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
        <div className="p-3 bg-white w-fit mx-auto rounded-2xl shadow-sm mb-4">
           <Zap className="h-6 w-6 text-slate-300" />
        </div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No active profiles</p>
        <p className="text-xs text-slate-400 mt-1">Deploy your first network configuration to begin.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50/50">
          <TableRow className="border-slate-100 hover:bg-transparent">
            <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Profile Name</TableHead>
            <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Download</TableHead>
            <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Upload</TableHead>
            <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Operations</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((profile) => (
            <TableRow key={profile.id} className="group border-slate-100 hover:bg-slate-50/50 transition-all duration-300">
              <TableCell className="py-5 px-6">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                      <Zap className="h-4 w-4" />
                   </div>
                   <div className="flex flex-col">
                      <span className="font-bold text-slate-900 tracking-tight">{profile.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prority {profile.priority}</span>
                        {profile.is_active ? (
                          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            Live
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">
                            Standby
                          </div>
                        )}
                      </div>
                   </div>
                </div>
              </TableCell>
              <TableCell className="py-5 px-6">
                 <div className="flex items-center gap-2 bg-emerald-50/50 text-emerald-700 px-3 py-1.5 rounded-2xl border border-emerald-100 w-fit">
                    <ArrowDownCircle className="h-3.5 w-3.5" />
                    <span className="text-xs font-black whitespace-nowrap">{formatSpeed(profile.download_speed)}</span>
                 </div>
              </TableCell>
              <TableCell className="py-5 px-6">
                 <div className="flex items-center gap-2 bg-amber-50/50 text-amber-700 px-3 py-1.5 rounded-2xl border border-amber-100 w-fit">
                    <ArrowUpCircle className="h-3.5 w-3.5" />
                    <span className="text-xs font-black whitespace-nowrap">{formatSpeed(profile.upload_speed)}</span>
                 </div>
              </TableCell>
              <TableCell className="py-5 px-6 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-indigo-600 hover:border-indigo-100 rounded-xl"
                    onClick={() => handleView(profile.id)}
                    title="View Profile"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-amber-600 hover:border-amber-100 rounded-xl"
                    onClick={() => handleEdit(profile.id)}
                    title="Edit Config"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 bg-white border border-slate-200 shadow-sm text-rose-500 hover:border-rose-100 rounded-xl"
                    onClick={() => openDeleteDialog(profile.id, profile.name)}
                    title="Purge Profile"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => !deleting && setDeleteDialog({ open, profile: deleteDialog.profile })}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          <div className="bg-rose-600 p-6 flex flex-col items-center text-center text-white space-y-4">
             <div className="p-3 bg-white/20 rounded-2xl">
               <Trash2 className="h-8 w-8 text-white" />
             </div>
             <div className="space-y-1">
               <DialogTitle className="text-xl font-black uppercase tracking-tight text-white">Profile Obliteration</DialogTitle>
               <p className="text-[10px] font-black text-rose-100/70 uppercase tracking-widest">Permanent extraction from system</p>
             </div>
          </div>
          <div className="p-8 space-y-6 bg-white">
            <p className="text-sm text-slate-500 font-medium text-center leading-relaxed">
              Are you sure about deleting configuration <span className="font-black text-slate-900">"{deleteDialog.profile?.name}"</span>? 
              This will impact all linked network nodes.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button 
                variant="destructive" 
                className="w-full h-11 bg-rose-600 hover:bg-rose-700 font-black uppercase text-xs tracking-widest shadow-lg shadow-rose-100 rounded-xl"
                onClick={handleConfirmDelete} 
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Purging Profile...
                  </>
                ) : (
                  "Execute Purge"
                )}
              </Button>
              <Button 
                variant="ghost" 
                className="w-full h-11 text-slate-400 hover:text-slate-600 font-black uppercase text-[10px] tracking-widest"
                onClick={() => setDeleteDialog({ open: false, profile: null })} 
                disabled={deleting}
              >
                Cancel Deletion
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

