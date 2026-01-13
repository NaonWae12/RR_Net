"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotificationStore } from "@/stores/notificationStore";
import clientGroupService, { type ClientGroup } from "@/lib/api/clientGroupService";
import waCampaignService, { type WACampaign, type WACampaignRecipient } from "@/lib/api/waCampaignService";
import waTemplateService, { type WATemplate } from "@/lib/api/waTemplateService";

function statusPill(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "running":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "queued":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "failed":
      return "bg-rose-100 text-rose-800 border-rose-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

export function CampaignsTab() {
  const { showToast } = useNotificationStore();

  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [templates, setTemplates] = useState<WATemplate[]>([]);
  const [campaigns, setCampaigns] = useState<WACampaign[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [detail, setDetail] = useState<{ campaign: WACampaign; recipients: WACampaignRecipient[] } | null>(null);

  const [loadingInit, setLoadingInit] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [message, setMessage] = useState("");
  const [templateId, setTemplateId] = useState("");

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedId) ?? null,
    [campaigns, selectedId]
  );

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) {
      m.set(g.id, g.name);
    }
    return m;
  }, [groups]);

  const load = async () => {
    setLoadingInit(true);
    try {
      const [g, c, t] = await Promise.all([clientGroupService.list(), waCampaignService.list(), waTemplateService.list()]);
      setGroups(g);
      setCampaigns(c);
      setTemplates(t);
      if (!selectedId && c.length > 0) {
        setSelectedId(c[0].id);
      }
    } catch (err: any) {
      showToast({
        title: "Failed to load campaigns",
        description: err?.message || "Could not load WhatsApp campaigns.",
        variant: "error",
      });
    } finally {
      setLoadingInit(false);
    }
  };

  const loadDetail = async (id: string) => {
    if (!id) return;
    setLoadingDetail(true);
    try {
      const d = await waCampaignService.detail(id);
      setDetail(d);
    } catch (err: any) {
      showToast({
        title: "Failed to load campaign detail",
        description: err?.message || "Could not load campaign detail.",
        variant: "error",
      });
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Light polling while campaign is running/queued
  useEffect(() => {
    const status = selectedCampaign?.status;
    if (!selectedId) return;
    if (status !== "running" && status !== "queued") return;
    const t = window.setInterval(() => {
      loadDetail(selectedId);
      waCampaignService.list().then(setCampaigns).catch(() => { });
    }, 4000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedCampaign?.status]);

  const onCreate = async () => {
    if (!name.trim() || !groupId || !message.trim()) {
      showToast({
        title: "Incomplete",
        description: "Isi Name, Client Group, dan Message dulu.",
        variant: "error",
      });
      return;
    }
    setCreating(true);
    try {
      const c = await waCampaignService.create({
        name: name.trim(),
        group_id: groupId,
        message: message.trim(),
      });
      showToast({ title: "Campaign created", description: "Campaign berhasil dibuat dan dimulai.", variant: "success" });
      setName("");
      setMessage("");
      setTemplateId("");
      await load();
      setSelectedId(c.id);
      await loadDetail(c.id);
    } catch (err: any) {
      showToast({
        title: "Create failed",
        description: err?.message || "Failed to create campaign.",
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  };

  const onRetryFailed = async () => {
    if (!selectedId) return;
    setRetrying(true);
    try {
      const res = await waCampaignService.retryFailed(selectedId);
      showToast({
        title: "Retry queued",
        description: `Queued retry for ${res.retried} failed recipients.`,
        variant: "success",
      });
      await loadDetail(selectedId);
    } catch (err: any) {
      showToast({
        title: "Retry failed",
        description: err?.message || "Failed to retry.",
        variant: "error",
      });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Campaigns</h2>
          <p className="text-sm text-slate-600 mt-1">
            Buat campaign broadcast berbasis <span className="font-medium">Client Group</span>, diproses async (queue).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Reminder Jan 2026" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Client Group</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              disabled={loadingInit}
            >
              <option value="">Select group...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {groups.length === 0 && !loadingInit && (
              <p className="text-xs text-amber-700">
                Belum ada Client Group. Buat dulu di Service Setup / Client Groups.
              </p>
            )}
          </div>
          <div className="flex items-end justify-end gap-2">
            <Button variant="outline" onClick={load} disabled={loadingInit}>
              Refresh
            </Button>
            <Button onClick={onCreate} disabled={creating || loadingInit}>
              {creating ? "Creating..." : "Create & Start"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Message</label>
          <div className="flex items-center gap-2">
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={templateId}
              onChange={(e) => {
                const id = e.target.value;
                setTemplateId(id);
                const tpl = templates.find((t) => t.id === id);
                if (tpl) setMessage(tpl.content);
              }}
              disabled={loadingInit}
            >
              <option value="">Use template (optional)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {templateId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTemplateId("");
                }}
                disabled={loadingInit}
              >
                Clear
              </Button>
            )}
          </div>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tulis pesan broadcast..."
          />
          <p className="text-xs text-slate-500">Catatan: untuk MVP ini belum ada template variable.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Campaign list</div>
            <div className="text-xs text-slate-500">{campaigns.length} items</div>
          </div>
          <div className="mt-3 space-y-2">
            {campaigns.length === 0 ? (
              <div className="text-sm text-slate-600">Belum ada campaign.</div>
            ) : (
              campaigns.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${selectedId === c.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-slate-900 truncate">{c.name}</div>
                    <span className={`shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${statusPill(c.status)}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Group: {c.group_id ? groupNameById.get(c.group_id) ?? c.group_id : "-"}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {c.sent}/{c.total} sent • {c.failed} failed
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">Campaign detail</div>
              {detail?.campaign && (
                <div className="mt-1 text-xs text-slate-600">
                  {detail.campaign.sent}/{detail.campaign.total} sent • {detail.campaign.failed} failed
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => selectedId && loadDetail(selectedId)} disabled={!selectedId || loadingDetail}>
                {loadingDetail ? "Loading..." : "Refresh"}
              </Button>
              <Button onClick={onRetryFailed} disabled={!selectedId || retrying}>
                {retrying ? "Retrying..." : "Retry failed"}
              </Button>
            </div>
          </div>

          {!selectedId ? (
            <div className="mt-4 text-sm text-slate-600">Pilih campaign dulu.</div>
          ) : loadingDetail ? (
            <div className="mt-4 text-sm text-slate-600">Loading...</div>
          ) : !detail ? (
            <div className="mt-4 text-sm text-slate-600">No detail.</div>
          ) : (
            <div className="mt-4 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-2 pr-2">Phone / Client</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Message ID</th>
                    <th className="py-2 pr-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recipients.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">
                        <div className="font-mono text-xs">{r.phone}</div>
                        <div className="text-xs text-slate-600">{r.client_name || "-"}</div>
                      </td>
                      <td className="py-2 pr-2">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${statusPill(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-xs">{r.message_id ?? "-"}</td>
                      <td className="py-2 pr-2 text-xs text-slate-600">{r.error ?? "-"}</td>
                    </tr>
                  ))}
                  {detail.recipients.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-sm text-slate-600">
                        No recipients.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


