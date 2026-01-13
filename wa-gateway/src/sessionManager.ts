import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import pino from "pino";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";

import { ensureDir, tenantDir } from "./utils";

export type SessionStatus = "connected" | "connecting" | "needs_qr" | "disconnected";

export type SessionSnapshot = {
  tenantId: string;
  status: SessionStatus;
  lastQr: string | null;
  lastQrAt: string | null;
};

type Session = {
  tenantId: string;
  status: SessionStatus;
  lastQr: string | null;
  lastQrAt: Date | null;
  sock: WASocket;
  events: EventEmitter;
  reconnectAttempts: number;
  reconnectTimer?: NodeJS.Timeout;
};

export class SessionManager {
  private sessions = new Map<string, Session>();
  private log = pino({ level: process.env.LOG_LEVEL || "info" });

  constructor(private dataDir: string) {
    ensureDir(this.dataDir);
  }

  snapshot(tenantId: string): SessionSnapshot | null {
    const s = this.sessions.get(tenantId);
    if (!s) return null;
    return {
      tenantId: s.tenantId,
      status: s.status,
      lastQr: s.lastQr,
      lastQrAt: s.lastQrAt ? s.lastQrAt.toISOString() : null,
    };
  }

  async ensureSession(tenantId: string): Promise<SessionSnapshot> {
    const existing = this.sessions.get(tenantId);
    if (existing) return this.snapshot(tenantId)!;

    await this.createSession(tenantId);
    return this.snapshot(tenantId)!;
  }

  private async createSession(tenantId: string): Promise<void> {
    const dir = tenantDir(this.dataDir, tenantId);
    ensureDir(dir);

    const { state, saveCreds } = await useMultiFileAuthState(dir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: this.log.child({ tenantId }),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    const events = new EventEmitter();
    const session: Session = {
      tenantId,
      status: "connecting",
      lastQr: null,
      lastQrAt: null,
      sock,
      events,
      reconnectAttempts: 0,
    };

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
      if (u.qr) {
        session.lastQr = u.qr;
        session.lastQrAt = new Date();
        session.status = "needs_qr";
        events.emit("qr", u.qr);
      }

      if (u.connection === "open") {
        session.status = "connected";
        session.lastQr = null;
        session.lastQrAt = null;
        events.emit("connected");
      }

      if (u.connection === "connecting") {
        session.status = session.lastQr ? "needs_qr" : "connecting";
      }

      if (u.connection === "close") {
        session.status = session.lastQr ? "needs_qr" : "disconnected";
        const code = (u.lastDisconnect as any)?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          // Logged out: clear persisted auth so tenant can re-scan.
          try {
            fs.rmSync(dir, { recursive: true, force: true });
            ensureDir(dir);
          } catch {
            // ignore
          }
          session.lastQr = null;
          session.lastQrAt = null;
          session.status = "needs_qr";
        } else {
          // Transient close (e.g. stream error): restart socket in background.
          this.scheduleReconnect(tenantId);
        }
        events.emit("disconnected");
      }
    });

    this.sessions.set(tenantId, session);
  }

  private scheduleReconnect(tenantId: string) {
    const s = this.sessions.get(tenantId);
    if (!s) return;
    if (s.reconnectTimer) return;

    s.reconnectAttempts += 1;
    const backoffMs = Math.min(30_000, 1_000 * Math.pow(2, Math.min(5, s.reconnectAttempts)));
    s.reconnectTimer = setTimeout(async () => {
      s.reconnectTimer = undefined;
      try {
        // Drop old socket + recreate session
        this.sessions.delete(tenantId);
        await this.createSession(tenantId);
      } catch (e) {
        // Keep trying
        this.log.warn({ tenantId, err: (e as any)?.message }, "reconnect failed");
        this.scheduleReconnect(tenantId);
      }
    }, backoffMs);
  }

  async resetSession(tenantId: string): Promise<SessionSnapshot> {
    const dir = tenantDir(this.dataDir, tenantId);
    const existing = this.sessions.get(tenantId);
    if (existing?.reconnectTimer) {
      clearTimeout(existing.reconnectTimer);
    }
    this.sessions.delete(tenantId);

    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    ensureDir(dir);

    await this.createSession(tenantId);
    return this.snapshot(tenantId)!;
  }

  getSocket(tenantId: string): WASocket | null {
    return this.sessions.get(tenantId)?.sock ?? null;
  }

  status(tenantId: string): SessionStatus {
    const s = this.sessions.get(tenantId);
    if (!s) return "disconnected";
    // If we have a QR, treat as needs_qr even if underlying socket is disconnected.
    if (s.lastQr) return "needs_qr";
    return s.status;
  }

  async waitForQr(tenantId: string, timeoutMs: number): Promise<string | null> {
    const session = this.sessions.get(tenantId);
    if (!session) return null;
    if (session.lastQr) return session.lastQr;

    return await new Promise<string | null>((resolve) => {
      const t = setTimeout(() => {
        cleanup();
        resolve(session.lastQr);
      }, timeoutMs);

      const onQr = (qr: string) => {
        cleanup();
        resolve(qr);
      };

      const cleanup = () => {
        clearTimeout(t);
        session.events.off("qr", onQr);
      };

      session.events.on("qr", onQr);
    });
  }
}


