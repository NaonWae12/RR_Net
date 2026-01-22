"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotificationStore } from "@/stores/notificationStore";
import waLogService, { type WAMessageLog } from "@/lib/api/waLogService";

function statusPill(status: string) {
  switch (status) {
    case "sent":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "failed":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "queued":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

function sourcePill(source: string) {
  switch (source) {
    case "single":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "campaign":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "system":
      return "bg-slate-100 text-slate-800 border-slate-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

export function LogsTab() {
  const { showToast } = useNotificationStore();

  const [items, setItems] = useState<WAMessageLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");

  const filtersKey = useMemo(() => `${search}|${status}|${source}`, [search, status, source]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await waLogService.list({
        search: search.trim() || undefined,
        status: status || undefined,
        source: source || undefined,
        limit: 50,
      });
      setItems(res.data ?? []);
      setNextCursor(res.next_cursor ?? null);
    } catch (err: any) {
      showToast({
        title: "Failed to load logs",
        description: err?.message || "Could not load WhatsApp logs.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await waLogService.list({
        search: search.trim() || undefined,
        status: status || undefined,
        source: source || undefined,
        limit: 50,
        cursor: nextCursor,
      });
      setItems((prev) => [...prev, ...(res.data ?? [])]);
      setNextCursor(res.next_cursor ?? null);
    } catch (err: any) {
      showToast({
        title: "Failed to load more",
        description: err?.message || "Could not load more logs.",
        variant: "error",
      });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload when filters change (debounced-ish via 300ms)
  useEffect(() => {
    const t = window.setTimeout(() => {
      load();
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4 text-slate-900">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Logs</h2>
          <p className="text-sm text-slate-600 mt-1">Riwayat pengiriman WA (Single / Campaign / System).</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Search</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="phone / client name" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Source</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={loading}
            >
              <option value="">All</option>
              <option value="single">single</option>
              <option value="campaign">campaign</option>
              <option value="system">system</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={loading}
            >
              <option value="">All</option>
              <option value="queued">queued</option>
              <option value="sent">sent</option>
              <option value="failed">failed</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-900">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Log list</div>
          <div className="text-xs text-slate-500">{items.length} rows</div>
        </div>

        <div className="mt-3 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-2">Time</th>
                <th className="py-2 pr-2">Source</th>
                <th className="py-2 pr-2">To / Client</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Message</th>
                <th className="py-2 pr-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-slate-200 last:border-b-0 align-top">
                  <td className="py-2 pr-2 text-xs text-slate-600 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-2">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${sourcePill(r.source)}`}>
                      {r.source}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="font-mono text-xs text-slate-900">{r.to_phone}</div>
                    <div className="text-xs text-slate-600">{r.client_name || "-"}</div>
                  </td>
                  <td className="py-2 pr-2">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${statusPill(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-xs text-slate-700">
                    <div className="max-w-[520px] whitespace-pre-wrap line-clamp-3">{r.message_text}</div>
                  </td>
                  <td className="py-2 pr-2 text-xs text-rose-700">
                    <div className="max-w-[420px] whitespace-pre-wrap line-clamp-2">{r.error || "-"}</div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-sm text-slate-600">
                    {loading ? "Loading..." : "No logs yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-end">
          <Button variant="outline" onClick={loadMore} disabled={!nextCursor || loadingMore}>
            {loadingMore ? "Loading..." : nextCursor ? "Load more" : "No more"}
          </Button>
        </div>
      </div>
    </div>
  );
}


