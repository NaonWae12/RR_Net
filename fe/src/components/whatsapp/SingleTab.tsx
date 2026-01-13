"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotificationStore } from "@/stores/notificationStore";
import clientService, { type Client } from "@/lib/api/clientService";
import waGatewayService from "@/lib/api/waGatewayService";
import waTemplateService, { type WATemplate } from "@/lib/api/waTemplateService";

function digitsOnly(v: string) {
  return (v ?? "").replace(/[^\d]/g, "");
}

function formatMsisdn(v: string) {
  const d = digitsOnly(v);
  if (!d) return "";
  // light formatting: keep as digits for now (wa-gateway will normalize)
  return d;
}

export function SingleTab() {
  const { showToast } = useNotificationStore();

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");

  const [templates, setTemplates] = useState<WATemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );

  useEffect(() => {
    setLoadingClients(true);
    clientService
      .getClients({ page: 1, page_size: 200 })
      .then((res) => {
        setClients(res.data ?? []);
      })
      .catch((err: any) => {
        showToast({
          title: "Failed to load clients",
          description: err?.message || "Could not load client list.",
          variant: "error",
        });
      })
      .finally(() => setLoadingClients(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoadingTemplates(true);
    waTemplateService
      .list()
      .then(setTemplates)
      .catch((err: any) => {
        // non-fatal
        showToast({
          title: "Failed to load templates",
          description: err?.message || "Could not load WA templates.",
          variant: "error",
        });
      })
      .finally(() => setLoadingTemplates(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    const phone = selectedClient.phone ?? "";
    if (!phone) return;
    setTo(formatMsisdn(phone));
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedTemplateId) return;
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    setText(tpl.content);
  }, [selectedTemplateId, templates]);

  const canSend = useMemo(() => {
    const d = digitsOnly(to);
    return d.length >= 7 && text.trim().length > 0 && !sending;
  }, [to, text, sending]);

  const handleSend = async () => {
    const d = digitsOnly(to);
    if (d.length < 7) {
      showToast({
        title: "Invalid number",
        description: "Nomor WA tidak valid. Isi minimal 7 digit.",
        variant: "error",
      });
      return;
    }
    if (!text.trim()) {
      showToast({
        title: "Message is empty",
        description: "Isi pesan dulu ya.",
        variant: "error",
      });
      return;
    }

    setSending(true);
    try {
      const res = await waGatewayService.send({
        to: d,
        text: text.trim(),
        client_id: selectedClient?.id,
        client_name: selectedClient?.name,
        template_id: selectedTemplateId || undefined,
      });
      if (res.ok) {
        showToast({
          title: "Sent",
          description: `Message sent${res.message_id ? ` (id: ${res.message_id})` : ""}.`,
          variant: "success",
        });
      } else {
        showToast({
          title: "Send failed",
          description: "Gateway returned not-ok response.",
          variant: "error",
        });
      }
    } catch (err: any) {
      showToast({
        title: "Send failed",
        description: err?.message || "Failed to send message.",
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Single message</h2>
          <p className="text-sm text-slate-600 mt-1">
            Kirim pesan ke 1 nomor. Bisa pilih client (auto ambil nomor) atau isi manual.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Select client (optional)</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              disabled={loadingClients}
            >
              <option value="">{loadingClients ? "Loading clients..." : "— None —"}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` (${c.phone})` : " (no phone)"}
                </option>
              ))}
            </select>
            {selectedClient && !selectedClient.phone && (
              <p className="text-xs text-amber-700">
                Client ini belum punya nomor telepon di field <code>phone</code>.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Use template (optional)</label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={loadingTemplates}
            >
              <option value="">{loadingTemplates ? "Loading templates..." : "— None —"}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">Pilih template untuk auto-isi pesan.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">To (WhatsApp number)</label>
            <Input
              value={to}
              onChange={(e) => setTo(formatMsisdn(e.target.value))}
              placeholder="e.g. 62812xxxxxxx"
              inputMode="numeric"
            />
            <p className="text-xs text-slate-500">Tips: pakai format internasional (contoh Indonesia: 62xxxx).</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Message</label>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tulis pesan di sini..."
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button onClick={handleSend} disabled={!canSend}>
            {sending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}


