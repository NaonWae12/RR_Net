export type Config = {
  port: number;
  dataDir: string;
  adminToken: string;
  sendDelayMs: number;
  sendJitterMs: number;
};

function envInt(key: string, def: number): number {
  const raw = (process.env[key] ?? "").trim();
  if (!raw) return def;
  const v = Number(raw);
  return Number.isFinite(v) ? v : def;
}

export function loadConfig(): Config {
  const port = envInt("WA_PORT", 3001);
  const dataDir = (process.env.WA_DATA_DIR ?? "./data").trim() || "./data";
  const adminToken = (process.env.WA_ADMIN_TOKEN ?? "").trim();
  const sendDelayMs = envInt("WA_SEND_DELAY_MS", 350);
  const sendJitterMs = envInt("WA_SEND_JITTER_MS", 250);

  return { port, dataDir, adminToken, sendDelayMs, sendJitterMs };
}


