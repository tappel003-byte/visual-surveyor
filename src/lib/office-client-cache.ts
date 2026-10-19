import type { OfficeJobFolder, OfficeJobListResult } from "@/lib/office-jobs.functions";

const JOBS_KEY = "pgg_office_jobs_cache_v1";
const SIGN_KEY = "pgg_office_sign_cache_v1";

/** Soft TTL — Refresh still force-fetches; Open uses cache to skip Lovable list walk. */
const JOBS_TTL_MS = 90_000;
/** Signed URLs typically last ~1h; keep a safety margin. */
const SIGN_TTL_MS = 45 * 60 * 1000;

type JobsCache = {
  savedAt: number;
  listAvailable: boolean;
  jobs: OfficeJobFolder[];
};

type SignCache = Record<string, { url: string; expiresAt: number }>;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function readJobsCache(): OfficeJobListResult | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(JOBS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JobsCache;
    if (!parsed || !Array.isArray(parsed.jobs)) return null;
    return { listAvailable: !!parsed.listAvailable, jobs: parsed.jobs, locker: null };
  } catch {
    return null;
  }
}

export function jobsCacheAgeMs(): number | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(JOBS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JobsCache;
    if (!parsed?.savedAt) return null;
    return Date.now() - parsed.savedAt;
  } catch {
    return null;
  }
}

export function jobsCacheIsFresh(maxAgeMs = JOBS_TTL_MS): boolean {
  const age = jobsCacheAgeMs();
  return age != null && age < maxAgeMs;
}

export function writeJobsCache(result: OfficeJobListResult): void {
  if (!canUseStorage()) return;
  try {
    const payload: JobsCache = {
      savedAt: Date.now(),
      listAvailable: result.listAvailable,
      jobs: result.jobs,
    };
    sessionStorage.setItem(JOBS_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function patchJobsCache(jobs: OfficeJobFolder[], listAvailable = true): void {
  writeJobsCache({ listAvailable, jobs, locker: null });
}

export function clearJobsCache(): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(JOBS_KEY);
  } catch {
    /* ignore */
  }
}

function signCacheKey(jobId: string, path: string): string {
  return `${jobId}::${path}`;
}

export function readSignedUrl(jobId: string, path: string): string | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(SIGN_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as SignCache;
    const hit = all[signCacheKey(jobId, path)];
    if (!hit?.url || !hit.expiresAt) return null;
    if (Date.now() >= hit.expiresAt) return null;
    return hit.url;
  } catch {
    return null;
  }
}

export function writeSignedUrl(
  jobId: string,
  path: string,
  url: string,
  expiresInSeconds?: number,
): void {
  if (!canUseStorage()) return;
  try {
    const raw = sessionStorage.getItem(SIGN_KEY);
    const all: SignCache = raw ? (JSON.parse(raw) as SignCache) : {};
    const ttlMs =
      typeof expiresInSeconds === "number" && expiresInSeconds > 60
        ? Math.min(expiresInSeconds * 1000 - 60_000, SIGN_TTL_MS)
        : SIGN_TTL_MS;
    all[signCacheKey(jobId, path)] = { url, expiresAt: Date.now() + Math.max(ttlMs, 60_000) };
    // Cap entries to avoid bloating sessionStorage
    const keys = Object.keys(all);
    if (keys.length > 400) {
      keys
        .sort((a, b) => (all[a]?.expiresAt || 0) - (all[b]?.expiresAt || 0))
        .slice(0, keys.length - 300)
        .forEach((k) => delete all[k]);
    }
    sessionStorage.setItem(SIGN_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function loadSignedUrlMapForJob(jobId: string): Record<string, string> {
  if (!canUseStorage()) return {};
  try {
    const raw = sessionStorage.getItem(SIGN_KEY);
    if (!raw) return {};
    const all = JSON.parse(raw) as SignCache;
    const prefix = `${jobId}::`;
    const now = Date.now();
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(all)) {
      if (!k.startsWith(prefix) || !v?.url || now >= v.expiresAt) continue;
      out[k.slice(prefix.length)] = v.url;
    }
    return out;
  } catch {
    return {};
  }
}
