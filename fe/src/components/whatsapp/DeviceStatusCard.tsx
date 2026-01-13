"use client";

import { Button } from "@/components/ui/button";
import type { WAGatewayStatus } from "@/lib/api/waGatewayService";

function statusLabel(status: WAGatewayStatus) {
  switch (status) {
    case "connected":
      return "Connected";
    case "needs_qr":
      return "Needs QR Scan";
    case "connecting":
      return "Connecting";
    case "disconnected":
      return "Disconnected";
    default:
      return status;
  }
}

function statusColor(status: WAGatewayStatus) {
  switch (status) {
    case "connected":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "needs_qr":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "connecting":
      return "bg-sky-100 text-sky-800 border-sky-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}

export function DeviceStatusCard(props: {
  status: WAGatewayStatus;
  loading: boolean;
  onRefresh: () => void;
  onConnect: () => void;
  pollMs: number;
  rateLimitedUntil: number;
}) {
  const { status, loading, onRefresh, onConnect, pollMs, rateLimitedUntil } = props;

  const badgeClass = statusColor(status);
  const rateLimited = Date.now() < rateLimitedUntil;
  const untilText = rateLimited ? new Date(rateLimitedUntil).toLocaleTimeString() : null;

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Perangkat tertaut</h2>
            <span
              className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${badgeClass}`}
              title={status}
            >
              {statusLabel(status)}
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Hubungkan nomor WhatsApp tenant ini. QR hanya muncul jika status <span className="font-medium">Needs QR Scan</span>.
          </p>
          <div className="text-xs text-slate-500">
            Polling: {Math.round(pollMs / 1000)}s{rateLimited ? ` • rate-limited sampai ${untilText}` : ""}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onRefresh} disabled={loading || rateLimited}>
            Refresh
          </Button>
          <Button onClick={onConnect} disabled={loading || rateLimited}>
            {loading ? "Connecting..." : status === "needs_qr" ? "Refresh QR" : "Connect"}
          </Button>
        </div>
      </div>
    </div>
  );
}


