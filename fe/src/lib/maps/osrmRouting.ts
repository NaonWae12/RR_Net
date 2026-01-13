"use client";

export type LatLng = [number, number]; // [lat, lng]

export type OsrmProfile = "driving" | "foot" | "bike";

export type OsrmRoute = {
  geometry: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
};

const DEFAULT_OSRM_BASE_URL = "https://router.project-osrm.org";
const DEFAULT_PROFILE: OsrmProfile = "driving";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function round(n: number, decimals: number) {
  const m = Math.pow(10, decimals);
  return Math.round(n * m) / m;
}

function cacheKey(profile: OsrmProfile, from: LatLng, to: LatLng) {
  // Round to reduce cache fragmentation; routing at sub-meter precision is not needed for this use case.
  const fLat = round(from[0], 6);
  const fLng = round(from[1], 6);
  const tLat = round(to[0], 6);
  const tLng = round(to[1], 6);
  return `${profile}:${fLat},${fLng}->${tLat},${tLng}`;
}

function getBaseUrl(explicit?: string) {
  const env = (process.env.NEXT_PUBLIC_OSRM_URL ?? "").trim();
  const base = (explicit ?? env) || DEFAULT_OSRM_BASE_URL;
  // Strip trailing slash for consistent URL building.
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

// Simple concurrency limiter (p-limit style)
function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    const fn = queue.shift();
    if (fn) fn();
  };

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      active--;
      next();
    }
  };
}

const limit = createLimiter(3);
const routeCache = new Map<string, Promise<OsrmRoute>>();

type OsrmResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      coordinates: Array<[number, number]>; // [lon, lat]
      type: "LineString";
    };
  }>;
  message?: string;
};

export async function getOsrmRoute(params: {
  from: LatLng;
  to: LatLng;
  profile?: OsrmProfile;
  baseUrl?: string;
  signal?: AbortSignal;
}): Promise<OsrmRoute> {
  const profile = params.profile ?? DEFAULT_PROFILE;
  const key = cacheKey(profile, params.from, params.to);

  const cached = routeCache.get(key);
  if (cached) return cached;

  const promise = limit(async () => {
    const baseUrl = getBaseUrl(params.baseUrl);

    const fromLonLat = `${params.from[1]},${params.from[0]}`;
    const toLonLat = `${params.to[1]},${params.to[0]}`;

    const url =
      `${baseUrl}/route/v1/${profile}/${fromLonLat};${toLonLat}` +
      `?overview=full&geometries=geojson&steps=false`;

    // Public OSRM is best-effort; keep timeout reasonable.
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        method: "GET",
        signal: params.signal ?? controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`OSRM HTTP ${res.status}`);
      }

      const json = (await res.json()) as OsrmResponse;
      if (json.code !== "Ok" || !json.routes || json.routes.length === 0) {
        throw new Error(json.message || `OSRM error: ${json.code}`);
      }

      const route = json.routes[0];
      const coords = route.geometry?.coordinates ?? [];
      if (!Array.isArray(coords) || coords.length < 2) {
        throw new Error("OSRM returned empty geometry");
      }

      const geometry: LatLng[] = coords.map(([lon, lat]) => [lat, lon]);

      // Small delay to reduce burstiness against public server
      await sleep(50);

      return {
        geometry,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
      };
    } finally {
      window.clearTimeout(timeout);
    }
  });

  routeCache.set(key, promise);

  try {
    return await promise;
  } catch (err) {
    // Don’t poison the cache permanently on transient failures
    routeCache.delete(key);
    throw err;
  }
}


