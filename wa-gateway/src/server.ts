import Fastify from "fastify";
import { loadConfig } from "./config";
import { SessionManager } from "./sessionManager";
import { jitter, normalizeMsisdn, sleep, toJid } from "./utils";

type SendRequest = { to: string; text: string };
type BulkRequest =
  | { text: string; to: string[] }
  | { messages: Array<{ to: string; text: string }> };

const cfg = loadConfig();
const app = Fastify({ logger: true });
const sessions = new SessionManager(cfg.dataDir);

// Simple admin-token auth (BE -> wa-gateway)
app.addHook("preHandler", async (req, reply) => {
  if (!cfg.adminToken) {
    // Allow running without auth in dev, but warn
    if (process.env.NODE_ENV !== "production") return;
    reply.code(500).send({ error: "WA_ADMIN_TOKEN not configured" });
    return;
  }

  const token = (req.headers["x-wa-admin-token"] as string | undefined) ?? "";
  if (token !== cfg.adminToken) {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

app.get("/health", async () => ({ ok: true }));

app.post<{
  Params: { tenantId: string };
}>("/v1/tenants/:tenantId/connect", async (req) => {
  const tenantId = req.params.tenantId;
  const snap = await sessions.ensureSession(tenantId);

  let qr: string | null = snap.lastQr;
  if (!qr && snap.status !== "connected") {
    qr = await sessions.waitForQr(tenantId, 10_000);
  }

  // If we still don't have a QR and we're not connected, the stored creds may be broken.
  // Auto-reset once to force a fresh QR for the tenant.
  if (!qr && (snap.status === "connecting" || snap.status === "disconnected" || snap.status === "needs_qr")) {
    const resetSnap = await sessions.resetSession(tenantId);
    if (!qr && resetSnap.status !== "connected") {
      qr = await sessions.waitForQr(tenantId, 10_000);
    }
  }

  const after = sessions.snapshot(tenantId) ?? snap;
  const effectiveStatus =
    (qr ?? after.lastQr) ? "needs_qr" : after.status;
  return {
    tenant_id: tenantId,
    status: effectiveStatus,
    qr: qr ?? after.lastQr,
    qr_updated_at: after.lastQrAt,
  };
});

app.get<{
  Params: { tenantId: string };
}>("/v1/tenants/:tenantId/qr", async (req) => {
  const tenantId = req.params.tenantId;
  const snap = sessions.snapshot(tenantId);
  return {
    tenant_id: tenantId,
    status: snap?.lastQr ? "needs_qr" : (snap?.status ?? "disconnected"),
    qr: snap?.lastQr ?? null,
    qr_updated_at: snap?.lastQrAt ?? null,
  };
});

app.get<{
  Params: { tenantId: string };
}>("/v1/tenants/:tenantId/status", async (req) => {
  const tenantId = req.params.tenantId;
  const snap = sessions.snapshot(tenantId);
  return {
    tenant_id: tenantId,
    status: snap?.lastQr ? "needs_qr" : (snap?.status ?? "disconnected"),
  };
});

app.post<{
  Params: { tenantId: string };
  Body: SendRequest;
}>("/v1/tenants/:tenantId/send", async (req, reply) => {
  const { tenantId } = req.params;
  const { to, text } = req.body ?? ({} as any);

  if (!to || !text) {
    reply.code(400);
    return { error: "to and text are required" };
  }

  await sessions.ensureSession(tenantId);
  if (sessions.status(tenantId) !== "connected") {
    reply.code(409);
    return { error: "tenant session not connected", status: sessions.status(tenantId) };
  }

  const sock = sessions.getSocket(tenantId);
  if (!sock) {
    reply.code(500);
    return { error: "socket not available" };
  }

  const msisdn = normalizeMsisdn(to);
  const jid = toJid(msisdn);
  const res = await sock.sendMessage(jid, { text });

  return { ok: true, message_id: res?.key?.id ?? null };
});

app.post<{
  Params: { tenantId: string };
  Body: BulkRequest;
}>("/v1/tenants/:tenantId/send-bulk", async (req, reply) => {
  const { tenantId } = req.params;
  const body = req.body as any;

  await sessions.ensureSession(tenantId);
  if (sessions.status(tenantId) !== "connected") {
    reply.code(409);
    return { error: "tenant session not connected", status: sessions.status(tenantId) };
  }

  const sock = sessions.getSocket(tenantId);
  if (!sock) {
    reply.code(500);
    return { error: "socket not available" };
  }

  let messages: Array<{ to: string; text: string }> = [];

  if (Array.isArray(body?.messages)) {
    messages = body.messages;
  } else if (Array.isArray(body?.to) && typeof body?.text === "string") {
    messages = body.to.map((to: string) => ({ to, text: body.text }));
  } else {
    reply.code(400);
    return { error: "Invalid payload. Provide {messages:[{to,text}]} or {to:[...], text:string}." };
  }

  const results: Array<{ to: string; ok: boolean; message_id?: string | null; error?: string }> = [];

  for (const msg of messages) {
    try {
      const msisdn = normalizeMsisdn(msg.to);
      const jid = toJid(msisdn);
      const res = await sock.sendMessage(jid, { text: msg.text });
      results.push({ to: msg.to, ok: true, message_id: res?.key?.id ?? null });
    } catch (e: any) {
      results.push({ to: msg.to, ok: false, error: e?.message || "send failed" });
    }

    await sleep(jitter(cfg.sendDelayMs, cfg.sendJitterMs));
  }

  return { ok: true, total: results.length, results };
});

async function main() {
  await app.listen({ port: cfg.port, host: "0.0.0.0" });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


