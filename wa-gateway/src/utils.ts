import fs from "node:fs";
import path from "node:path";

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function tenantDir(baseDir: string, tenantId: string) {
  // Keep path traversal out
  const safe = tenantId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(baseDir, safe);
}

export function normalizeMsisdn(to: string): string {
  const digits = (to || "").replace(/[^\d]/g, "");
  if (digits.length < 7) {
    throw new Error("Invalid phone number");
  }
  return digits;
}

export function toJid(msisdnDigits: string): string {
  return `${msisdnDigits}@s.whatsapp.net`;
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function jitter(baseMs: number, jitterMs: number) {
  const j = Math.floor(Math.random() * (jitterMs + 1));
  return baseMs + j;
}


