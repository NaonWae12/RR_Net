"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotificationStore } from "@/stores/notificationStore";
import waTemplateService, { type WATemplate } from "@/lib/api/waTemplateService";

export function TemplatesTab() {
  const { showToast } = useNotificationStore();

  const [templates, setTemplates] = useState<WATemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string>("");

  const editingTemplate = useMemo(
    () => templates.find((t) => t.id === editingId) ?? null,
    [editingId, templates]
  );

  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await waTemplateService.list();
      setTemplates(data);
    } catch (err: any) {
      showToast({
        title: "Failed to load templates",
        description: err?.message || "Could not load templates.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editingTemplate) return;
    setName(editingTemplate.name);
    setContent(editingTemplate.content);
  }, [editingTemplate]);

  const resetForm = () => {
    setEditingId("");
    setName("");
    setContent("");
  };

  const onSave = async () => {
    if (!name.trim() || !content.trim()) {
      showToast({
        title: "Incomplete",
        description: "Isi Name dan Content dulu.",
        variant: "error",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await waTemplateService.update(editingId, { name: name.trim(), content: content.trim() });
        showToast({ title: "Template updated", variant: "success" });
      } else {
        await waTemplateService.create({ name: name.trim(), content: content.trim() });
        showToast({ title: "Template created", variant: "success" });
      }
      resetForm();
      await load();
    } catch (err: any) {
      showToast({
        title: "Save failed",
        description: err?.message || "Failed to save template.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (id: string) => {
    setLoading(true);
    try {
      await waTemplateService.remove(id);
      showToast({ title: "Template deleted", variant: "success" });
      if (editingId === id) resetForm();
      await load();
    } catch (err: any) {
      showToast({
        title: "Delete failed",
        description: err?.message || "Failed to delete template.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Templates</h2>
          <p className="text-sm text-slate-600 mt-1">Template pesan plain text untuk dipakai ulang di Single/Campaign.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Reminder invoice" />
          </div>
          <div className="flex items-end justify-end gap-2">
            <Button variant="outline" onClick={resetForm} disabled={loading}>
              Reset
            </Button>
            <Button onClick={onSave} disabled={loading}>
              {editingId ? "Update" : "Create"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Content</label>
          <textarea
            className="min-h-[140px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tulis isi template..."
          />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Template list</div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500">{templates.length} items</div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-3 divide-y">
          {templates.length === 0 ? (
            <div className="py-3 text-sm text-slate-600">Belum ada template.</div>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">{t.name}</div>
                  <div className="mt-1 text-xs text-slate-600 line-clamp-2 whitespace-pre-wrap">{t.content}</div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingId(t.id)}
                    disabled={loading}
                    title="Edit template"
                  >
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => onDelete(t.id)} disabled={loading} title="Delete template">
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


