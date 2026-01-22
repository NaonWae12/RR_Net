"use client";

import { useEffect, useState } from "react";

import { useNotificationStore } from "@/stores/notificationStore";
import { waGatewayService, type WAGatewayStatus } from "@/lib/api/waGatewayService";
import { DeviceStatusCard } from "@/components/whatsapp/DeviceStatusCard";
import { QrCard } from "@/components/whatsapp/QrCard";

export function DeviceTab() {
  const { showToast } = useNotificationStore();

  const [status, setStatus] = useState<WAGatewayStatus>("disconnected");
  const [qr, setQr] = useState<string | null>(null);
  const [qrUpdatedAt, setQrUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pollMs, setPollMs] = useState(5000);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number>(0);

  const refresh = async () => {
    if (Date.now() < rateLimitedUntil) return;
    try {
      const s = await waGatewayService.status();
      setStatus(s.status);

      if (s.status === "needs_qr") {
        const q = await waGatewayService.qr();
        setQr(q.qr);
        setQrUpdatedAt(q.qr_updated_at);
      } else {
        setQr(null);
        setQrUpdatedAt(null);
      }
    } catch (err: any) {
      if (err?.statusCode === 429) {
        const retryAfterSec =
          (typeof err?.details?.retry_after === "number" && err.details.retry_after) || 15;
        setRateLimitedUntil(Date.now() + retryAfterSec * 1000);
        setPollMs(Math.max(15000, retryAfterSec * 1000));
        return;
      }
      showToast({
        title: "WhatsApp gateway error",
        description: err?.message || "Failed to load WhatsApp gateway status.",
        variant: "error",
      });
    }
  };

  const connect = async () => {
    setLoading(true);
    try {
      const res = await waGatewayService.connect();
      setStatus(res.status);
      setQr(res.qr);
      setQrUpdatedAt(res.qr_updated_at);

      if (res.status === "connected") {
        showToast({
          title: "WhatsApp connected",
          description: "Your WhatsApp number is connected successfully.",
          variant: "success",
        });
      } else if (res.status === "needs_qr") {
        showToast({
          title: "Scan QR to connect",
          description: "Open WhatsApp on your phone and scan the QR code.",
          variant: "info",
        });
      }
    } catch (err: any) {
      showToast({
        title: "Connect failed",
        description: err?.message || "Failed to start WhatsApp connection.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "connected") return;
    const t = window.setInterval(() => {
      refresh();
    }, pollMs);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pollMs, rateLimitedUntil]);

  return (
    <div className="space-y-4">
      <DeviceStatusCard
        status={status}
        loading={loading}
        onRefresh={refresh}
        onConnect={connect}
        pollMs={pollMs}
        rateLimitedUntil={rateLimitedUntil}
      />

      <QrCard qr={qr} qrUpdatedAt={qrUpdatedAt} />

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <div className="font-medium text-slate-900">Catatan</div>
        <ul className="mt-2 list-disc pl-5 space-y-1 text-slate-600">
          <li>
            Kalau QR tidak muncul, klik <span className="font-medium text-slate-900">Connect</span> lagi (gateway akan reset session bila perlu).
          </li>
          <li>
            Untuk produksi, sebaiknya pakai token admin yang aman dan self-host OS/WA gateway infra sesuai kapasitas.
          </li>
        </ul>
      </div>
    </div>
  );
}


