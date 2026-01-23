"use client";

import { useEffect, useState } from "react";
import { pppoeService, PPPoESecret } from "@/lib/api/pppoeService";
import { clientService, Client } from "@/lib/api/clientService";
import { useNetworkStore } from "@/stores/networkStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RotateCw,
  Plus,
  Search,
  Router as RouterIcon,
  Power,
  PowerOff,
  Edit,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/utilities/LoadingSpinner";
import { useAuth } from "@/lib/hooks/useAuth";
import { Input } from "@/components/ui/input";

export default function PPPoEPage() {
  const { showToast } = useNotificationStore();
  const { routers, profiles, fetchRouters, fetchProfiles } = useNetworkStore();
  const { isAuthenticated } = useAuth();

  const [secrets, setSecrets] = useState<PPPoESecret[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRouter, setSelectedRouter] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");

  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    secret: PPPoESecret | null;
  }>({ open: false, secret: null });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    secret: { id: string; username: string } | null;
  }>({ open: false, secret: null });

  const [formData, setFormData] = useState({
    client_id: "",
    router_id: "",
    profile_id: "",
    username: "",
    password: "",
    service: "pppoe",
    caller_id: "",
    remote_address: "",
    local_address: "",
    comment: "",
  });

  const load = async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      await Promise.all([fetchRouters(), fetchProfiles()]);
      const params: any = { limit: 500 };
      if (selectedRouter) params.router_id = selectedRouter;
      if (selectedClient) params.client_id = selectedClient;

      const res = await pppoeService.listSecrets(params);
      setSecrets(res.data || []);
    } catch (err: any) {
      showToast({ title: "Load failed", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const res = await clientService.getClients({ page: 1, page_size: 500 });
      setClients(res.data || []);
    } catch (err: any) {
      showToast({ title: "Failed to load clients", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoadingClients(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      load();
      loadClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, selectedRouter, selectedClient]);

  const handleCreate = async () => {
    if (!formData.client_id || !formData.router_id || !formData.profile_id || !formData.username || !formData.password) {
      showToast({ title: "Validation Error", description: "Please fill all required fields", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      await pppoeService.createSecret(formData);
      showToast({ title: "Success", description: "PPPoE secret created successfully", variant: "success" });
      setCreateDialog(false);
      setFormData({
        client_id: "",
        router_id: "",
        profile_id: "",
        username: "",
        password: "",
        service: "pppoe",
        caller_id: "",
        remote_address: "",
        local_address: "",
        comment: "",
      });
      await load();
    } catch (err: any) {
      showToast({ title: "Failed", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (secret: PPPoESecret) => {
    setLoading(true);
    try {
      await pppoeService.toggleStatus(secret.id);
      showToast({
        title: "Status updated",
        description: `PPPoE secret "${secret.username}" is now ${secret.is_disabled ? "enabled" : "disabled"}`,
        variant: "success",
      });
      await load();
    } catch (err: any) {
      showToast({ title: "Failed", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (secret: PPPoESecret) => {
    setLoading(true);
    try {
      await pppoeService.syncToRouter(secret.id);
      showToast({ title: "Synced", description: `PPPoE secret "${secret.username}" synced to router`, variant: "success" });
    } catch (err: any) {
      showToast({ title: "Sync failed", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.secret) return;
    setLoading(true);
    try {
      await pppoeService.deleteSecret(deleteDialog.secret.id);
      showToast({ title: "Deleted", description: `PPPoE secret "${deleteDialog.secret.username}" deleted`, variant: "success" });
      setDeleteDialog({ open: false, secret: null });
      await load();
    } catch (err: any) {
      showToast({ title: "Failed", description: err?.message || "Error", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const filteredSecrets = secrets.filter((s) => {
    if (searchTerm && !s.username.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto text-slate-900">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <RouterIcon className="w-8 h-8 text-indigo-600" /> PPPoE Management
          </h1>
          <p className="text-slate-500 mt-1">Manage PPPoE client accounts and sync to routers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button onClick={() => setCreateDialog(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Create Secret
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50/50 border-b border-slate-200 py-4 px-6 gap-4">
          <CardTitle className="text-lg font-bold text-slate-900 px-0">PPPoE Secrets</CardTitle>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                placeholder="Search username..."
                className="w-full sm:w-64 bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedRouter}
              onChange={(e) => setSelectedRouter(e.target.value)}
            >
              <option value="" className="text-slate-900">All Routers</option>
              {routers.map((r) => (
                <option key={r.id} value={r.id} className="text-slate-900">
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Username</th>
                <th className="px-6 py-4 text-left font-semibold">Router</th>
                <th className="px-6 py-4 text-left font-semibold">Profile</th>
                <th className="px-6 py-4 text-center font-semibold">Status</th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSecrets.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 text-slate-900 font-mono font-bold">{s.username}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {routers.find((r) => r.id === s.router_id)?.name || "Unknown"}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {profiles.find((p) => p.id === s.profile_id)?.name || "Unknown"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge className={s.is_disabled ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}>
                      {s.is_disabled ? "Disabled" : "Enabled"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(s)}
                        className={`h-9 w-9 ${s.is_disabled ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700"}`}
                        title={s.is_disabled ? "Enable" : "Disable"}
                      >
                        {s.is_disabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSync(s)}
                        className="h-9 w-9 text-blue-600 hover:text-blue-700"
                        title="Sync to Router"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDialog({ open: true, secret: { id: s.id, username: s.username } })}
                        className="h-9 w-9 text-red-600 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSecrets.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400 italic">
                    No PPPoE secrets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-[600px] bg-white">
          <DialogHeader>
            <DialogTitle>Create PPPoE Secret</DialogTitle>
            <DialogDescription>Create a new PPPoE user account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Router *</label>
              <select
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.router_id}
                onChange={(e) => setFormData({ ...formData, router_id: e.target.value })}
              >
                <option value="" className="text-slate-900">Select Router</option>
                {routers.map((r) => (
                  <option key={r.id} value={r.id} className="text-slate-900">
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Profile *</label>
              <select
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.profile_id}
                onChange={(e) => setFormData({ ...formData, profile_id: e.target.value })}
              >
                <option value="" className="text-slate-900">Select Profile</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id} className="text-slate-900">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Username *</label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Password *</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Client *</label>
              <select
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:text-slate-500 disabled:bg-slate-50"
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                disabled={loadingClients}
              >
                <option value="" className="text-slate-900">{loadingClients ? "Loading clients..." : "Select Client"}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="text-slate-900">
                    {c.client_code} — {c.name}
                    {c.phone ? ` (${c.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Comment</label>
              <Input
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={loading}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, secret: deleteDialog.secret })}>
        <DialogContent className="sm:max-w-[400px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete PPPoE Secret</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog.secret?.username}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, secret: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

