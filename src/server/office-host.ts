/**
 * Host-split office/Sync until Lovable sunset (16 Dec 2026).
 *
 * - Lovable Cloud has SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (old jobs).
 * - Netlify www must NEVER have those; www /office is Blobs-only (new Syncs).
 *   Do not merge old Lovable jobs onto www.
 */

export type OfficeJobSource = "blobs" | "lovable";

/** True when this process can talk to Supabase with a service role (Lovable Cloud). */
export function isLovableOfficeRuntime(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/** www / Netlify desk + field host (no service role). */
export function isNetlifyOfficeRuntime(): boolean {
  return !isLovableOfficeRuntime();
}

export function exportsListTokenConfigured(): boolean {
  return Boolean(process.env.EXPORTS_LIST_TOKEN?.trim());
}
