"use client";

import dynamic from "next/dynamic";

const QRCodeCanvas = dynamic(
  async () => {
    const mod = await import("qrcode.react");
    return mod.QRCodeCanvas;
  },
  { ssr: false }
);

export function QrCard(props: { qr: string | null; qrUpdatedAt: string | null }) {
  const { qr, qrUpdatedAt } = props;

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900">QR untuk scan</h3>
          <ol className="list-decimal pl-5 text-sm text-slate-700 space-y-1">
            <li>Buka WhatsApp di HP.</li>
            <li>Masuk ke Linked devices / Perangkat tertaut.</li>
            <li>Scan QR di kanan.</li>
          </ol>
          {qrUpdatedAt && (
            <p className="text-xs text-slate-500">
              QR updated at: {new Date(qrUpdatedAt).toLocaleString()}
            </p>
          )}
          {!qr && (
            <p className="text-sm text-slate-600">
              QR belum tersedia. Klik <span className="font-medium">Connect</span> /{" "}
              <span className="font-medium">Refresh QR</span>.
            </p>
          )}
        </div>

        <div className="flex justify-center md:justify-end">
          <div className="rounded-lg border bg-white p-4">
            {qr ? <QRCodeCanvas value={qr} size={240} includeMargin /> : <div className="h-[240px] w-[240px]" />}
          </div>
        </div>
      </div>
    </div>
  );
}


